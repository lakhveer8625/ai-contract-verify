import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract } from '@prisma/client';
import { z } from 'zod';
import { AiAuditJson, AnalyzerFinding } from '../types';

const AiSchema = z.object({
  executiveSummary: z.string(),
  overallScore: z.number().min(0).max(100),
  vulnerabilities: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
      confidence: z.number().min(0).max(1),
      file: z.string().optional(),
      lineStart: z.number().optional(),
      lineEnd: z.number().optional(),
      snippet: z.string().optional(),
      explanation: z.string(),
      recommendation: z.string(),
      fixedCode: z.string().optional(),
      source: z.enum(['SLITHER', 'MYTHRIL', 'AST', 'AI'])
    })
  ),
  gasOptimizations: z.array(z.object({ title: z.string(), impact: z.string(), recommendation: z.string(), code: z.string().optional() })),
  recommendations: z.array(z.object({ type: z.string(), title: z.string(), body: z.string(), code: z.string().optional() }))
});

@Injectable()
export class AiEngineService {
  constructor(private readonly config: ConfigService) {}

  async analyze(contracts: Contract[], analyzerFindings: AnalyzerFinding[]): Promise<AiAuditJson> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) return this.localFallback(contracts, analyzerFindings);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Smart Contract Auditor'
      },
      body: JSON.stringify({
        model: this.config.get<string>('OPENROUTER_MODEL') ?? 'openai/gpt-4.1',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: this.systemPrompt() },
          { role: 'user', content: this.userPrompt(contracts, analyzerFindings) }
        ],
        temperature: 0.15
      })
    });

    if (!response.ok) return this.localFallback(contracts, analyzerFindings);
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content ?? '{}';
    const parsed = AiSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : this.localFallback(contracts, analyzerFindings);
  }

  private systemPrompt() {
    return [
      'You are a senior Solidity security auditor and gas optimization expert.',
      'Return strict JSON only. No markdown fences.',
      'Analyze Slither, Mythril, and AST findings for exploitability. Remove false positives when justified.',
      'Explain each issue for both executives and beginner developers.',
      'Generate remediation with secure Solidity examples when possible.',
      'Score 0-100 where 100 is production-ready and critical exploitable bugs heavily reduce score.'
    ].join('\n');
  }

  private userPrompt(contracts: Contract[], findings: AnalyzerFinding[]) {
    return JSON.stringify({
      requiredSchema: {
        executiveSummary: 'string',
        overallScore: 'number 0-100',
        vulnerabilities: ['title, category, severity, confidence, file, lineStart, lineEnd, snippet, explanation, recommendation, fixedCode, source'],
        gasOptimizations: ['title, impact, recommendation, code'],
        recommendations: ['type, title, body, code']
      },
      detectionCoverage: [
        'reentrancy',
        'integer overflow',
        'access control',
        'tx.origin',
        'unsafe external calls',
        'delegatecall',
        'DOS',
        'flash loan risk',
        'front-running',
        'oracle manipulation',
        'unchecked transfers',
        'storage reads',
        'calldata',
        'immutable',
        'loop optimization',
        'struct packing',
        'custom errors'
      ],
      analyzerFindings: findings,
      contracts: contracts.map((c) => ({ fileName: c.fileName, source: c.source.slice(0, 60_000) }))
    });
  }

  private localFallback(contracts: Contract[], findings: AnalyzerFinding[]): AiAuditJson {
    const score = Math.max(35, 100 - findings.reduce((sum, f) => sum + ({ CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3, INFO: 1 }[f.severity] ?? 1), 0));
    return {
      executiveSummary:
        findings.length > 0
          ? `The audit found ${findings.length} issue candidates. Review high severity findings before deployment.`
          : 'No obvious high-risk patterns were detected by the local fallback analysis.',
      overallScore: score,
      vulnerabilities: findings.map((f) => ({
        ...f,
        explanation: `${f.explanation} Exploitability depends on call context, permissions, and reachable state transitions.`,
        recommendation: f.recommendation
      })),
      gasOptimizations: contracts.flatMap((contract) => [
        {
          title: 'Prefer calldata for external read-only array/string parameters',
          impact: 'Reduces memory copying gas cost.',
          recommendation: `Review external functions in ${contract.fileName} and replace memory with calldata where data is not mutated.`
        },
        {
          title: 'Use custom errors for revert paths',
          impact: 'Reduces deployment bytecode and runtime revert gas.',
          recommendation: 'Replace repeated require string literals with typed custom errors.'
        }
      ]),
      recommendations: [
        {
          type: 'REMEDIATION_PLAN',
          title: 'Prioritize exploitable external-call and authorization issues',
          body: 'Patch critical and high findings first, add regression tests for exploit scenarios, then re-run static and AI analysis.'
        }
      ]
    };
  }
}
