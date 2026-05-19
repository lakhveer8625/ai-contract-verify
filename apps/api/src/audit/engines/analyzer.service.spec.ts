import { AnalyzerService } from './analyzer.service';
import { AnalyzerFinding } from '../types';

const makeContract = (source: string, fileName = 'Test.sol') =>
  ({ id: 'c1', fileName, source, auditId: 'a1', ast: null, createdAt: new Date() } as any);

describe('AnalyzerService', () => {
  let svc: AnalyzerService;

  beforeEach(() => {
    svc = new AnalyzerService();
  });

  const scan = (contracts: ReturnType<typeof makeContract>[]): AnalyzerFinding[] =>
    (svc as any).heuristicFindings(contracts, 'ast', new Error('tool unavailable'));

  // --- mapSeverity (via heuristicFindings) ---
  describe('mapSeverity (private, tested via heuristicFindings fallback)', () => {
    it('maps high-risk heuristic findings to HIGH', () => {
      const contract = makeContract('contract X { function f() public { require(tx.origin == msg.sender); } }');
      const findings = scan([contract]);
      const txOrigin = findings.find((f) => f.category === 'TX_ORIGIN');
      expect(txOrigin?.severity).toBe('HIGH');
    });
  });

  // --- parseContracts ---
  describe('parseContracts', () => {
    it('returns AST for valid Solidity', async () => {
      const contract = makeContract('pragma solidity ^0.8.0; contract A {}');
      const results = await svc.parseContracts([contract]);
      expect(results[0].id).toBe('c1');
      expect(results[0].ast).toBeDefined();
      expect((results[0].ast as any).parserError).toBeUndefined();
    });

    it('returns parserError for invalid Solidity', async () => {
      const contract = makeContract('this is not solidity { broken }');
      const results = await svc.parseContracts([contract]);
      expect((results[0].ast as any).parserError).toBeDefined();
    });
  });

  // --- heuristicFindings (tested via runSlither/runMythril when binaries absent) ---
  describe('heuristicFindings', () => {
    it('detects tx.origin', () => {
      const contract = makeContract('contract X { function f() public { if (tx.origin == msg.sender) {} } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'TX_ORIGIN')).toBe(true);
    });

    it('detects delegatecall', () => {
      const contract = makeContract('contract X { function f(address t) public { t.delegatecall(""); } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'DELEGATECALL')).toBe(true);
    });

    it('detects unsafe external value call', () => {
      const contract = makeContract('contract X { function f(address t) public { t.call{value: 1}(""); } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'EXTERNAL_CALL')).toBe(true);
    });

    it('detects for-loop gas risk', () => {
      const contract = makeContract('contract X { function f(uint n) public { for (uint i=0;i<n;i++) {} } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'DOS_GAS')).toBe(true);
    });

    it('detects oracle pattern', () => {
      const contract = makeContract('contract X { uint price; function getPrice() public view returns (uint) { return price; } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'ORACLE')).toBe(true);
    });

    it('returns ANALYZER_FALLBACK when no patterns match and tool failed', () => {
      const contract = makeContract('pragma solidity ^0.8.0; contract Clean {}');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'ANALYZER_FALLBACK')).toBe(true);
    });

    it('does NOT return duplicate findings when same pattern appears twice (no stale g-flag)', () => {
      // Two separate contracts each with tx.origin — should find it in both without g-flag stale state
      const c1 = makeContract('contract A { function f() public { if (tx.origin == msg.sender) {} } }', 'A.sol');
      const c2 = makeContract('contract B { function g() public { require(tx.origin == msg.sender); } }', 'B.sol');
      const findings = scan([c1, c2]);
      const txOriginFindings = findings.filter((f) => f.category === 'TX_ORIGIN');
      // Each contract should detect tx.origin independently
      expect(txOriginFindings.length).toBe(2);
    });

    it('adds line and snippet metadata for heuristic findings', () => {
      const contract = makeContract(
        ['pragma solidity ^0.8.20;', 'contract X {', '  function f() public { selfdestruct(payable(msg.sender)); }', '}'].join('\n')
      );
      const findings = scan([contract]);
      const selfdestruct = findings.find((f) => f.category === 'SELFDESTRUCT');
      expect(selfdestruct?.lineStart).toBe(3);
      expect(selfdestruct?.snippet).toContain('selfdestruct');
    });

    it('detects reentrancy-shaped state writes after value calls', () => {
      const contract = makeContract(`
        contract Vault {
          mapping(address => uint) balances;
          function withdraw() public {
            msg.sender.call{value: balances[msg.sender]}("");
            balances[msg.sender] = 0;
          }
        }
      `);
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'REENTRANCY' && f.severity === 'CRITICAL')).toBe(true);
    });

    it('detects unchecked ERC20 transfers', () => {
      const contract = makeContract('contract X { function pay(IERC20 token, address to) public { token.transfer(to, 1); } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'UNCHECKED_ERC20_TRANSFER')).toBe(true);
    });

    it('detects timestamp-dependent logic', () => {
      const contract = makeContract('contract X { function expired(uint d) public view returns (bool) { return block.timestamp > d; } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'TIMESTAMP_DEPENDENCE')).toBe(true);
    });

    it('detects weak on-chain randomness', () => {
      const contract = makeContract('contract X { function roll() public view returns (bytes32) { return keccak256(abi.encode(block.timestamp, msg.sender)); } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'WEAK_RANDOMNESS')).toBe(true);
    });

    it('detects selfdestruct and inline assembly', () => {
      const contract = makeContract('contract X { function kill() public { assembly { pop(0) } selfdestruct(payable(msg.sender)); } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'SELFDESTRUCT')).toBe(true);
      expect(findings.some((f) => f.category === 'INLINE_ASSEMBLY')).toBe(true);
    });

    it('detects unprotected initializer functions', () => {
      const contract = makeContract('contract X { address owner; function initialize(address o) external { owner = o; } }');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'UNPROTECTED_INITIALIZER')).toBe(true);
    });

    it('detects outdated compiler ranges', () => {
      const contract = makeContract('pragma solidity ^0.7.6; contract X {}');
      const findings = scan([contract]);
      expect(findings.some((f) => f.category === 'OUTDATED_COMPILER')).toBe(true);
    });
  });
});
