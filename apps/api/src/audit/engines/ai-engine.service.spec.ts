import { AiEngineService } from './ai-engine.service';

const makeContract = (fileName = 'Token.sol', source = 'pragma solidity ^0.8.0; contract Token {}') =>
  ({ id: 'c1', fileName, source, auditId: 'a1', ast: null, createdAt: new Date() } as any);

const criticalFinding = {
  title: 'Reentrancy',
  category: 'REENTRANCY',
  severity: 'CRITICAL' as const,
  confidence: 0.9,
  explanation: 'reentrancy detected',
  recommendation: 'use reentrancy guard',
  source: 'SLITHER' as const
};

const lowFinding = {
  title: 'Missing event',
  category: 'EVENT',
  severity: 'LOW' as const,
  confidence: 0.7,
  explanation: 'missing event',
  recommendation: 'emit event',
  source: 'SLITHER' as const
};

describe('AiEngineService — localFallback', () => {
  let svc: AiEngineService;

  beforeEach(() => {
    // No API key → always falls through to localFallback
    const config = { get: jest.fn().mockReturnValue(undefined) } as any;
    svc = new AiEngineService(config);
  });

  it('returns score of 35 floor when critical findings exceed budget', async () => {
    const findings = Array.from({ length: 5 }, () => criticalFinding);
    const result = await svc.analyze([makeContract()], findings);
    expect(result.overallScore).toBe(35);
  });

  it('returns score of 100 when no findings', async () => {
    const result = await svc.analyze([makeContract()], []);
    expect(result.overallScore).toBe(100);
  });

  it('score decreases proportionally to severity', async () => {
    const lowResult = await svc.analyze([makeContract()], [lowFinding]);
    const critResult = await svc.analyze([makeContract()], [criticalFinding]);
    expect(lowResult.overallScore).toBeGreaterThan(critResult.overallScore);
  });

  it('returns executive summary mentioning finding count', async () => {
    const result = await svc.analyze([makeContract()], [criticalFinding, lowFinding]);
    expect(result.executiveSummary).toContain('2');
  });

  it('returns gas optimizations per contract', async () => {
    const result = await svc.analyze([makeContract('A.sol'), makeContract('B.sol')], []);
    // 2 contracts × 2 tips each
    expect(result.gasOptimizations.length).toBe(4);
  });

  it('includes recommendations', async () => {
    const result = await svc.analyze([makeContract()], []);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('vulnerabilities list mirrors findings in fallback', async () => {
    const result = await svc.analyze([makeContract()], [criticalFinding]);
    expect(result.vulnerabilities).toHaveLength(1);
    expect(result.vulnerabilities[0].severity).toBe('CRITICAL');
  });
});
