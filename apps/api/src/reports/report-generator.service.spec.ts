import { mkdtemp, readFile, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ReportGeneratorService } from './report-generator.service';

const makeAudit = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'audit-1',
    userId: 'user-1',
    title: 'Vault Audit',
    status: 'COMPLETED',
    overallScore: 74,
    criticalCount: 1,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
    executiveSummary: 'The audit found issues that require remediation before deployment.',
    analyzerRaw: null,
    gasOptimizations: [{ title: 'Use calldata', recommendation: 'Prefer calldata for read-only external parameters.' }],
    createdAt: new Date(),
    updatedAt: new Date(),
    contracts: [{ id: 'contract-1', auditId: 'audit-1', fileName: 'Vault.sol', source: 'contract Vault {}', ast: null, createdAt: new Date() }],
    vulnerabilities: [
      {
        id: 'vuln-1',
        auditId: 'audit-1',
        title: 'Reentrancy',
        category: 'REENTRANCY',
        severity: 'CRITICAL',
        confidence: 0.92,
        file: 'Vault.sol',
        lineStart: 42,
        lineEnd: null,
        snippet: null,
        explanation: 'The withdraw function makes an external value call before updating account balances.',
        recommendation: 'Move state updates before external calls and add a reentrancy guard.',
        fixedCode: null,
        source: 'AST',
        createdAt: new Date()
      }
    ],
    recommendations: [{ id: 'rec-1', auditId: 'audit-1', type: 'PLAN', title: 'Patch criticals', body: 'Fix critical issues first.', code: null, createdAt: new Date() }],
    ...overrides
  }) as any;

const makeDoc = () => {
  const calls: Array<{ text: string; x?: number; y?: number; options?: any }> = [];
  const doc: any = {
    x: 48,
    y: 96,
    page: { width: 595.28, height: 841.89, margins: { left: 48, right: 48, top: 48, bottom: 48 } },
    fontSize: jest.fn(() => doc),
    fillColor: jest.fn(() => doc),
    strokeColor: jest.fn(() => doc),
    lineWidth: jest.fn(() => doc),
    lineCap: jest.fn(() => doc),
    moveTo: jest.fn(() => doc),
    lineTo: jest.fn(() => doc),
    stroke: jest.fn(() => doc),
    save: jest.fn(() => doc),
    restore: jest.fn(() => doc),
    roundedRect: jest.fn(() => doc),
    fill: jest.fn(() => doc),
    fillAndStroke: jest.fn(() => doc),
    rect: jest.fn(() => doc),
    circle: jest.fn(() => doc),
    addPage: jest.fn(() => {
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
      return doc;
    }),
    moveDown: jest.fn((lines = 1) => {
      doc.y += Number(lines) * 12;
      return doc;
    }),
    text: jest.fn((text: string, x?: number, y?: number, options?: any) => {
      calls.push({ text, x, y, options });
      if (typeof x === 'number') doc.x = x;
      if (typeof y === 'number') doc.y = y;
      doc.y += 12;
      return doc;
    }),
    calls
  };
  return doc;
};

describe('ReportGeneratorService', () => {
  it('generates JSON, Markdown, and a non-empty PDF report', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'report-generator-'));
    const service = new ReportGeneratorService({ get: jest.fn(() => dir) } as any);

    const result = await service.generate(makeAudit());
    const pdfStats = await stat(result.pdfPath);
    const markdown = await readFile(result.markdownPath, 'utf8');
    const json = JSON.parse(await readFile(result.jsonPath, 'utf8'));

    expect(pdfStats.size).toBeGreaterThan(1000);
    expect(markdown).toContain('Smart Contract Audit Report');
    expect(markdown).toContain('Reentrancy');
    expect(json.id).toBe('audit-1');
  });

  it('resets text layout after graphs before rendering findings', () => {
    const service = new ReportGeneratorService({ get: jest.fn() } as any);
    const doc = makeDoc();

    (service as any).renderGraphs(doc, makeAudit());
    (service as any).renderFindingsHeader(doc);
    (service as any).renderFinding(doc, makeAudit().vulnerabilities[0]);

    const findingsHeader = doc.calls.filter((call: any) => call.text === 'Findings').at(-1);
    const severityBadge = doc.calls.find((call: any) => call.text === 'CRITICAL');
    const findingTitle = doc.calls.find((call: any) => call.text === 'Reentrancy');
    const recommendation = doc.calls.find((call: any) => call.text.startsWith('Recommendation:'));

    expect(doc.x).toBe(doc.page.margins.left);
    expect(findingsHeader).toMatchObject({ x: doc.page.margins.left });
    expect(findingsHeader?.options?.width).toBeCloseTo(499.28, 1);
    expect(severityBadge).toMatchObject({ x: doc.page.margins.left + 20 });
    expect(findingTitle).toMatchObject({ x: doc.page.margins.left + 82 });
    expect(findingTitle?.options?.width).toBeCloseTo(403.28, 1);
    expect(recommendation).toMatchObject({ x: doc.page.margins.left + 14 });
    expect(doc.fillAndStroke).toHaveBeenCalledWith('#fff1f2', '#fecaca');
    expect(doc.fill).toHaveBeenCalledWith('#dc2626');
  });
});
