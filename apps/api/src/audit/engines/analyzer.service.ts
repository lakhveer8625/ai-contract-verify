import { Injectable } from '@nestjs/common';
import { Contract } from '@prisma/client';
import { execFile } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import * as parser from 'solidity-parser-antlr';
import { AnalyzerFinding } from '../types';

const execFileAsync = promisify(execFile);

type HeuristicCheck = {
  pattern: RegExp;
  title: string;
  category: string;
  severity: AnalyzerFinding['severity'];
  recommendation: string;
  confidence?: number;
};

@Injectable()
export class AnalyzerService {
  async parseContracts(contracts: Contract[]) {
    return contracts.map((contract) => {
      try {
        return { id: contract.id, ast: parser.parse(contract.source, { loc: true, range: true }) as unknown as object };
      } catch (error) {
        return { id: contract.id, ast: { parserError: error instanceof Error ? error.message : 'Unknown parser error' } };
      }
    });
  }

  async runSlither(contracts: Contract[]): Promise<AnalyzerFinding[]> {
    return this.runTool('slither', contracts, async (dir, files) => {
      const findings: AnalyzerFinding[] = [];
      for (const file of files) {
        const { stdout } = await execFileAsync('slither', [join(dir, file), '--json', '-'], { timeout: 120_000 });
        const json = JSON.parse(stdout || '{}');
        findings.push(
          ...(json.results?.detectors ?? []).map((detector: any) => ({
            title: detector.check,
            category: detector.impact,
            severity: this.mapSeverity(detector.impact),
            confidence: detector.confidence === 'High' ? 0.9 : 0.65,
            file: detector.elements?.[0]?.source_mapping?.filename_relative,
            lineStart: detector.elements?.[0]?.source_mapping?.lines?.[0],
            explanation: detector.description ?? detector.markdown ?? detector.check,
            recommendation: detector.recommendation ?? 'Review the affected code and apply the secure Solidity pattern.',
            source: 'SLITHER' as const
          }))
        );
      }
      return findings;
    });
  }

  async runMythril(contracts: Contract[]): Promise<AnalyzerFinding[]> {
    return this.runTool('mythril', contracts, async (dir, files) => {
      const findings: AnalyzerFinding[] = [];
      for (const file of files) {
        const { stdout } = await execFileAsync('myth', ['analyze', join(dir, file), '--execution-timeout', '60', '-o', 'json'], {
          timeout: 120_000
        });
        const json = JSON.parse(stdout || '{}');
        findings.push(
          ...(json.issues ?? []).map((issue: any) => ({
            title: issue.title,
            category: issue.swcID ?? 'MYTHRIL',
            severity: this.mapSeverity(issue.severity),
            confidence: 0.75,
            file,
            lineStart: issue.lineno,
            explanation: issue.description?.head ?? issue.description ?? issue.title,
            recommendation: issue.description?.tail ?? 'Patch according to the referenced SWC guidance.',
            source: 'MYTHRIL' as const
          }))
        );
      }
      return findings;
    });
  }

  private async runTool(
    name: string,
    contracts: Contract[],
    cb: (dir: string, files: string[]) => Promise<AnalyzerFinding[]>
  ): Promise<AnalyzerFinding[]> {
    const dir = await mkdtemp(join(tmpdir(), `audit-${name}-`));
    const files = contracts.map((contract) => contract.fileName || `${contract.id}.sol`);
    await Promise.all(contracts.map((contract, index) => writeFile(join(dir, files[index]), contract.source, 'utf8')));
    try {
      return await cb(dir, files);
    } catch (error) {
      return this.heuristicFindings(contracts, name, error);
    } finally {
      rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private heuristicFindings(contracts: Contract[], source: string, error: unknown): AnalyzerFinding[] {
    const findings: AnalyzerFinding[] = [];
    for (const contract of contracts) {
      for (const check of this.heuristicChecks()) {
        const match = this.findMatch(contract.source, check.pattern);
        if (match) {
          findings.push(this.finding(contract, check, source, match));
        }
      }
    }
    if (!findings.length && error) {
      findings.push({
        title: `${source} unavailable`,
        category: 'ANALYZER_FALLBACK',
        severity: 'INFO',
        confidence: 0.5,
        explanation: `The ${source} binary was unavailable or failed; heuristic scanning was used.`,
        recommendation: 'Run the Docker analyzer services in production for full static analysis coverage.',
        source: 'AST'
      });
    }
    return findings;
  }

  private heuristicChecks(): HeuristicCheck[] {
    return [
      {
        pattern: /tx\.origin/,
        title: 'tx.origin authentication',
        category: 'TX_ORIGIN',
        severity: 'HIGH',
        recommendation: 'Use msg.sender or role-based access control instead of tx.origin.'
      },
      {
        pattern: /delegatecall/,
        title: 'Delegatecall usage',
        category: 'DELEGATECALL',
        severity: 'HIGH',
        recommendation: 'Avoid delegatecall or constrain targets to trusted, immutable implementations.'
      },
      {
        pattern: /\.call\s*\{[^}]*value\s*:/,
        title: 'Unsafe external value call',
        category: 'EXTERNAL_CALL',
        severity: 'HIGH',
        recommendation: 'Use checks-effects-interactions and ReentrancyGuard around value-transferring calls.'
      },
      {
        pattern: /\.call\s*\{[^}]*value\s*:[\s\S]{0,800}(?:balances?|_balances|totalSupply|locked|owner)\s*(?:\[.*?\])?\s*(?:=|\+=|-=|\+\+|--)/,
        title: 'Possible reentrancy state update after external call',
        category: 'REENTRANCY',
        severity: 'CRITICAL',
        confidence: 0.78,
        recommendation: 'Update internal state before external calls and protect the function with a reentrancy guard.'
      },
      {
        pattern: /(?:^|[{\n;]\s*)\w+\s*\.\s*(?:transfer|transferFrom|approve)\s*\([^;]+;/m,
        title: 'Unchecked ERC20 operation',
        category: 'UNCHECKED_ERC20_TRANSFER',
        severity: 'MEDIUM',
        confidence: 0.68,
        recommendation: 'Check the returned boolean or use OpenZeppelin SafeERC20 wrappers.'
      },
      {
        pattern: /block\.timestamp|\bnow\b/,
        title: 'Timestamp-dependent logic',
        category: 'TIMESTAMP_DEPENDENCE',
        severity: 'MEDIUM',
        recommendation: 'Do not use block timestamps for precise authorization, randomness, or short deadline decisions.'
      },
      {
        pattern: /(?:keccak256|sha256)\s*\([^;]*(?:block\.timestamp|blockhash|block\.prevrandao|block\.difficulty|msg\.sender)[^;]*\)/,
        title: 'Weak on-chain randomness',
        category: 'WEAK_RANDOMNESS',
        severity: 'HIGH',
        confidence: 0.76,
        recommendation: 'Use a verifiable randomness source such as Chainlink VRF for adversarial randomness.'
      },
      {
        pattern: /\bselfdestruct\s*\(/,
        title: 'Selfdestruct reachable in contract',
        category: 'SELFDESTRUCT',
        severity: 'HIGH',
        recommendation: 'Remove selfdestruct or strictly gate it behind audited emergency governance.'
      },
      {
        pattern: /\bassembly\s*\{/,
        title: 'Inline assembly requires manual review',
        category: 'INLINE_ASSEMBLY',
        severity: 'LOW',
        confidence: 0.62,
        recommendation: 'Review memory safety, storage slot usage, and external call handling in assembly blocks.'
      },
      {
        pattern: /function\s+initialize\s*\([^)]*\)\s*(?:public|external)(?![^{;]*(?:initializer|onlyOwner|reinitializer|admin|owner))/,
        title: 'Initializer lacks access control',
        category: 'UNPROTECTED_INITIALIZER',
        severity: 'HIGH',
        confidence: 0.74,
        recommendation: 'Protect initializer functions with initializer and appropriate ownership or role checks.'
      },
      {
        pattern: /pragma\s+solidity\s+\^(?:0\.[0-7]\.|[1-7]\.)/,
        title: 'Outdated Solidity compiler range',
        category: 'OUTDATED_COMPILER',
        severity: 'LOW',
        confidence: 0.66,
        recommendation: 'Use a current Solidity 0.8.x compiler and pin the version used by CI and deployments.'
      },
      {
        pattern: /for\s*\(/,
        title: 'Loop requires gas review',
        category: 'DOS_GAS',
        severity: 'MEDIUM',
        recommendation: 'Bound loops and avoid user-controlled iteration over unbounded storage.'
      },
      {
        pattern: /price|oracle/i,
        title: 'Oracle manipulation review',
        category: 'ORACLE',
        severity: 'MEDIUM',
        recommendation: 'Use TWAPs, heartbeat checks, and deviation bounds for price-sensitive logic.'
      }
    ];
  }

  private findMatch(source: string, pattern: RegExp): { lineStart: number; snippet: string } | undefined {
    const match = source.match(pattern);
    if (!match || match.index === undefined) return undefined;
    const before = source.slice(0, match.index);
    const lineStart = before.split(/\r?\n/).length;
    const line = source.split(/\r?\n/)[lineStart - 1]?.trim();
    return { lineStart, snippet: line?.slice(0, 240) ?? match[0].slice(0, 240) };
  }

  private finding(
    contract: Contract,
    check: HeuristicCheck,
    source: string,
    match: { lineStart: number; snippet: string }
  ): AnalyzerFinding {
    return {
      title: check.title,
      category: check.category,
      severity: check.severity,
      confidence: check.confidence ?? 0.72,
      file: contract.fileName,
      lineStart: match.lineStart,
      snippet: match.snippet,
      explanation: `${check.title} was detected in ${contract.fileName}.`,
      recommendation: check.recommendation,
      source: source.toUpperCase() === 'SLITHER' ? 'SLITHER' : source.toUpperCase() === 'MYTHRIL' ? 'MYTHRIL' : 'AST'
    };
  }

  private mapSeverity(value?: string): AnalyzerFinding['severity'] {
    const normalized = (value ?? '').toLowerCase();
    if (normalized.includes('critical')) return 'CRITICAL';
    if (normalized.includes('high')) return 'HIGH';
    if (normalized.includes('medium')) return 'MEDIUM';
    if (normalized.includes('low')) return 'LOW';
    return 'INFO';
  }
}
