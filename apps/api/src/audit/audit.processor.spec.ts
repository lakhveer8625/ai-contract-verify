import { AuditProcessor } from './audit.processor';

// Access private countSeverity via cast
const getProcessor = () => {
  const prisma: any = {
    audit: { update: jest.fn() },
    contract: { update: jest.fn().mockResolvedValue({}) },
    vulnerability: { deleteMany: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
    aiRecommendation: { deleteMany: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
    report: { deleteMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops))
  };
  const analyzer: any = { parseContracts: jest.fn(), runSlither: jest.fn(), runMythril: jest.fn() };
  const ai: any = { analyze: jest.fn() };
  const reports: any = { generate: jest.fn() };
  const gateway: any = { publish: jest.fn() };
  const queue: any = {};
  const proc = new AuditProcessor(prisma, analyzer, ai, reports, gateway);
  return { proc, prisma, analyzer, ai, reports, gateway };
};

describe('AuditProcessor.countSeverity', () => {
  const countSeverity = (vulns: Array<{ severity: string }>) =>
    (AuditProcessor.prototype as any).countSeverity.call({}, vulns);

  it('counts each severity correctly', () => {
    const vulns = [
      { severity: 'CRITICAL' },
      { severity: 'CRITICAL' },
      { severity: 'HIGH' },
      { severity: 'MEDIUM' },
      { severity: 'LOW' },
      { severity: 'INFO' }
    ];
    const counts = countSeverity(vulns);
    expect(counts.criticalCount).toBe(2);
    expect(counts.highCount).toBe(1);
    expect(counts.mediumCount).toBe(1);
    expect(counts.lowCount).toBe(1);
  });

  it('returns zeros when no vulnerabilities', () => {
    const counts = countSeverity([]);
    expect(counts).toEqual({ criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 });
  });
});

describe('AuditProcessor.process', () => {
  it('sets status to FAILED and rethrows on error', async () => {
    const { proc, prisma, analyzer, gateway } = getProcessor();
    const auditId = 'a1';
    const contract = { id: 'c1', fileName: 'T.sol', source: '' };

    prisma.audit.update.mockResolvedValueOnce({ id: auditId, status: 'PARSING', contracts: [contract] });
    prisma.$transaction.mockResolvedValueOnce(undefined);
    analyzer.parseContracts.mockRejectedValue(new Error('parse failure'));
    prisma.audit.update.mockResolvedValueOnce({ id: auditId, status: 'FAILED', contracts: [contract] });

    const job: any = { data: { auditId } };
    await expect(proc.process(job)).rejects.toThrow('parse failure');

    const statusCalls = prisma.audit.update.mock.calls.map((c: any) => c[0].data.status);
    expect(statusCalls).toContain('FAILED');
    expect(gateway.publish).toHaveBeenCalledWith(auditId, 'FAILED', expect.any(String));
  });

  it('completes full pipeline and sets COMPLETED status', async () => {
    const { proc, prisma, analyzer, ai, reports, gateway } = getProcessor();
    const auditId = 'a1';
    const contract = { id: 'c1', fileName: 'T.sol', source: 'pragma solidity ^0.8.0; contract T {}' };

    const statuses = ['PARSING', 'SLITHER', 'MYTHRIL', 'AI_ANALYSIS', 'REPORT_GENERATION', 'COMPLETED'];
    let updateIdx = 0;
    prisma.audit.update.mockImplementation(({ data }: any) => {
      return Promise.resolve({ id: auditId, status: data.status ?? statuses[updateIdx++], contracts: [contract] });
    });
    prisma.$transaction.mockResolvedValue(undefined);
    analyzer.parseContracts.mockResolvedValue([{ id: 'c1', ast: {} }]);
    analyzer.runSlither.mockResolvedValue([]);
    analyzer.runMythril.mockResolvedValue([]);
    ai.analyze.mockResolvedValue({
      vulnerabilities: [],
      recommendations: [],
      gasOptimizations: [],
      executiveSummary: 'Clean',
      overallScore: 95
    });
    reports.generate.mockResolvedValue({ jsonPath: '/p.json', markdownPath: '/p.md', pdfPath: '/p.pdf' });
    prisma.vulnerability.createMany.mockResolvedValue(undefined);
    prisma.aiRecommendation.createMany.mockResolvedValue(undefined);
    prisma.report.create.mockResolvedValue(undefined);

    const job: any = { data: { auditId } };
    await expect(proc.process(job)).resolves.toBeUndefined();

    const publishedStatuses = gateway.publish.mock.calls.map((c: any) => c[1]);
    expect(publishedStatuses).toContain('COMPLETED');
  });
});
