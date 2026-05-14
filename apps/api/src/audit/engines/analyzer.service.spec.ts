import { AnalyzerService } from './analyzer.service';

const makeContract = (source: string, fileName = 'Test.sol') =>
  ({ id: 'c1', fileName, source, auditId: 'a1', ast: null, createdAt: new Date() } as any);

describe('AnalyzerService', () => {
  let svc: AnalyzerService;

  beforeEach(() => {
    svc = new AnalyzerService();
  });

  // --- mapSeverity (via heuristicFindings) ---
  describe('mapSeverity (private, tested via heuristicFindings fallback)', () => {
    it('maps "High" → HIGH', async () => {
      const contract = makeContract('contract X { function f() public { require(tx.origin == msg.sender); } }');
      // force heuristicFindings by calling runSlither which will fail (binary absent)
      const findings = await svc.runSlither([contract]);
      // tx.origin pattern should trigger HIGH
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
    it('detects tx.origin', async () => {
      const contract = makeContract('contract X { function f() public { if (tx.origin == msg.sender) {} } }');
      const findings = await svc.runSlither([contract]);
      expect(findings.some((f) => f.category === 'TX_ORIGIN')).toBe(true);
    });

    it('detects delegatecall', async () => {
      const contract = makeContract('contract X { function f(address t) public { t.delegatecall(""); } }');
      const findings = await svc.runSlither([contract]);
      expect(findings.some((f) => f.category === 'DELEGATECALL')).toBe(true);
    });

    it('detects unsafe external value call', async () => {
      const contract = makeContract('contract X { function f(address t) public { t.call{value: 1}(""); } }');
      const findings = await svc.runSlither([contract]);
      expect(findings.some((f) => f.category === 'EXTERNAL_CALL')).toBe(true);
    });

    it('detects for-loop gas risk', async () => {
      const contract = makeContract('contract X { function f(uint n) public { for (uint i=0;i<n;i++) {} } }');
      const findings = await svc.runSlither([contract]);
      expect(findings.some((f) => f.category === 'DOS_GAS')).toBe(true);
    });

    it('detects oracle pattern', async () => {
      const contract = makeContract('contract X { uint price; function getPrice() public view returns (uint) { return price; } }');
      const findings = await svc.runSlither([contract]);
      expect(findings.some((f) => f.category === 'ORACLE')).toBe(true);
    });

    it('returns ANALYZER_FALLBACK when no patterns match and tool failed', async () => {
      const contract = makeContract('pragma solidity ^0.8.0; contract Clean {}');
      const findings = await svc.runSlither([contract]);
      expect(findings.some((f) => f.category === 'ANALYZER_FALLBACK')).toBe(true);
    });

    it('does NOT return duplicate findings when same pattern appears twice (no stale g-flag)', async () => {
      // Two separate contracts each with tx.origin — should find it in both without g-flag stale state
      const c1 = makeContract('contract A { function f() public { if (tx.origin == msg.sender) {} } }', 'A.sol');
      const c2 = makeContract('contract B { function g() public { require(tx.origin == msg.sender); } }', 'B.sol');
      const findings = await svc.runSlither([c1, c2]);
      const txOriginFindings = findings.filter((f) => f.category === 'TX_ORIGIN');
      // Each contract should detect tx.origin independently
      expect(txOriginFindings.length).toBe(2);
    });
  });
});
