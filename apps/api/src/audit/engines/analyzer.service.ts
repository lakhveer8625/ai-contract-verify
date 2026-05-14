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
      const checks: Array<[RegExp, AnalyzerFinding]> = [
        [/tx\.origin/, this.finding(contract, 'tx.origin authentication', 'TX_ORIGIN', 'HIGH', 'Use msg.sender or role-based access control.', source)],
        [/delegatecall/, this.finding(contract, 'Delegatecall usage', 'DELEGATECALL', 'HIGH', 'Avoid delegatecall or constrain targets to trusted implementations.', source)],
        [/\.call\{value:/, this.finding(contract, 'Unsafe external value call', 'EXTERNAL_CALL', 'HIGH', 'Use checks-effects-interactions and ReentrancyGuard.', source)],
        [/for\s*\(/, this.finding(contract, 'Loop requires gas review', 'DOS_GAS', 'MEDIUM', 'Bound loops and avoid user-controlled iteration.', source)],
        [/price|oracle/i, this.finding(contract, 'Oracle manipulation review', 'ORACLE', 'MEDIUM', 'Use TWAPs, heartbeat checks, and deviation bounds.', source)]
      ];
      for (const [regex, finding] of checks) {
        if (regex.test(contract.source)) findings.push(finding);
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

  private finding(contract: Contract, title: string, category: string, severity: AnalyzerFinding['severity'], recommendation: string, source: string): AnalyzerFinding {
    return {
      title,
      category,
      severity,
      confidence: 0.72,
      file: contract.fileName,
      explanation: `${title} was detected in ${contract.fileName}.`,
      recommendation,
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
