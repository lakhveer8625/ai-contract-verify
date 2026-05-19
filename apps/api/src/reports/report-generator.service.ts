import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Audit, Contract, Vulnerability, AiRecommendation } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import PDFDocument = require('pdfkit');

type FullAudit = Audit & {
  contracts: Contract[];
  vulnerabilities: Vulnerability[];
  recommendations: AiRecommendation[];
};

type ChartItem = {
  label: string;
  value: number;
  color: string;
};

@Injectable()
export class ReportGeneratorService {
  constructor(private readonly config: ConfigService) {}

  async generate(audit: FullAudit) {
    const dir = join(this.config.get<string>('REPORT_DIR') ?? './reports', audit.id);
    await mkdir(dir, { recursive: true });

    const jsonPath = join(dir, 'audit-report.json');
    const markdownPath = join(dir, 'audit-report.md');
    const pdfPath = join(dir, 'audit-report.pdf');

    await writeFile(jsonPath, JSON.stringify(audit, null, 2), 'utf8');
    await writeFile(markdownPath, this.markdown(audit), 'utf8');
    await this.pdf(audit, pdfPath);
    return { jsonPath, markdownPath, pdfPath };
  }

  private markdown(audit: FullAudit) {
    const vulns = audit.vulnerabilities
      .map((v) => `### ${v.severity}: ${v.title}\n\n${v.explanation}\n\n**Recommendation:** ${v.recommendation}\n`)
      .join('\n');
    const gas = Array.isArray(audit.gasOptimizations)
      ? audit.gasOptimizations.map((g: any) => `- **${g.title}:** ${g.recommendation}`).join('\n')
      : '';
    return `# Smart Contract Audit Report

## Executive Summary

${audit.executiveSummary ?? 'No executive summary generated.'}

## Security Score

${audit.overallScore}/100

- Critical: ${audit.criticalCount}
- High: ${audit.highCount}
- Medium: ${audit.mediumCount}
- Low: ${audit.lowCount}

## Vulnerabilities

${vulns || 'No vulnerabilities recorded.'}

## Gas Optimizations

${gas || 'No gas optimizations recorded.'}
`;
  }

  private pdf(audit: FullAudit, pdfPath: string) {
    return new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const stream = createWriteStream(pdfPath);
      doc.pipe(stream);
      this.renderHeader(doc, audit);
      this.renderExecutiveSummary(doc, audit);
      this.renderGraphs(doc, audit);
      this.renderFindingsHeader(doc);
      for (const vuln of audit.vulnerabilities) {
        this.renderFinding(doc, vuln);
      }
      if (!audit.vulnerabilities.length) {
        this.writeBodyText(doc, 'No vulnerabilities recorded.');
      }
      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument, audit: FullAudit) {
    doc.fontSize(22).fillColor('#0f172a').text('Smart Contract Security Audit', { continued: false });
    doc.moveDown(0.5).fontSize(12).fillColor('#475569').text(`Audit ID: ${audit.id}`);
    doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(0.6);
    this.renderDivider(doc);
  }

  private renderExecutiveSummary(doc: PDFKit.PDFDocument, audit: FullAudit) {
    doc.moveDown(0.8).fillColor('#0f172a').fontSize(14).text('Executive Summary');
    doc.moveDown(0.25).fontSize(10).fillColor('#475569').text(audit.executiveSummary ?? 'No executive summary generated.', {
      align: 'left',
      lineGap: 2
    });
  }

  private renderGraphs(doc: PDFKit.PDFDocument, audit: FullAudit) {
    this.ensureSpace(doc, 360);
    doc.moveDown(1).fillColor('#0f172a').fontSize(14).text('Security Graphs');

    const startY = doc.y + 12;
    const leftX = doc.page.margins.left;
    const rightX = leftX + 260;

    this.renderScoreGauge(doc, leftX, startY, audit.overallScore);
    this.renderSeverityBars(doc, rightX, startY, this.severityItems(audit));

    const secondRowY = startY + 170;
    this.renderMetricCards(doc, leftX, secondRowY, [
      ['Contracts', audit.contracts.length],
      ['Findings', audit.vulnerabilities.length],
      ['Recommendations', audit.recommendations.length]
    ]);
    this.renderSourceDistribution(doc, rightX, secondRowY, this.sourceItems(audit));

    doc.y = secondRowY + 145;
    this.renderDivider(doc);
  }

  private renderScoreGauge(doc: PDFKit.PDFDocument, x: number, y: number, score: number) {
    const normalized = Math.max(0, Math.min(100, score));
    const width = 210;
    const height = 105;
    const centerX = x + width / 2;
    const centerY = y + height;
    const radius = 82;
    const start = Math.PI;
    const end = Math.PI * 2;
    const scoreEnd = start + (end - start) * (normalized / 100);

    doc.fontSize(11).fillColor('#0f172a').text('Security Score', x, y);
    this.drawArc(doc, centerX, centerY, radius, start, end, '#e2e8f0', 14);
    this.drawArc(doc, centerX, centerY, radius, start, scoreEnd, this.scoreColor(normalized), 14);
    doc.fontSize(30).fillColor('#0f172a').text(String(normalized), x, y + 58, { width, align: 'center' });
    doc.fontSize(9).fillColor('#64748b').text('out of 100', x, y + 92, { width, align: 'center' });
  }

  private renderSeverityBars(doc: PDFKit.PDFDocument, x: number, y: number, items: ChartItem[]) {
    const chartWidth = 230;
    const labelWidth = 58;
    const barWidth = chartWidth - labelWidth - 32;
    const maxValue = Math.max(...items.map((item) => item.value), 1);

    doc.fontSize(11).fillColor('#0f172a').text('Findings by Severity', x, y);
    items.forEach((item, index) => {
      const rowY = y + 28 + index * 26;
      const filled = Math.max(2, (item.value / maxValue) * barWidth);
      doc.fontSize(9).fillColor('#475569').text(item.label, x, rowY + 1, { width: labelWidth });
      doc.roundedRect(x + labelWidth, rowY, barWidth, 10, 4).fill('#e2e8f0');
      doc.roundedRect(x + labelWidth, rowY, filled, 10, 4).fill(item.color);
      doc.fontSize(9).fillColor('#0f172a').text(String(item.value), x + labelWidth + barWidth + 8, rowY - 1, { width: 24 });
    });
  }

  private renderMetricCards(doc: PDFKit.PDFDocument, x: number, y: number, metrics: Array<[string, number]>) {
    const cardWidth = 70;
    doc.fontSize(11).fillColor('#0f172a').text('Audit Volume', x, y);
    metrics.forEach(([label, value], index) => {
      const cardX = x + index * (cardWidth + 8);
      doc.roundedRect(cardX, y + 24, cardWidth, 70, 6).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fontSize(20).fillColor('#0f172a').text(String(value), cardX, y + 39, { width: cardWidth, align: 'center' });
      doc.fontSize(8).fillColor('#64748b').text(label, cardX + 4, y + 66, { width: cardWidth - 8, align: 'center' });
    });
  }

  private renderSourceDistribution(doc: PDFKit.PDFDocument, x: number, y: number, items: ChartItem[]) {
    doc.fontSize(11).fillColor('#0f172a').text('Findings by Source', x, y);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const centerX = x + 46;
    const centerY = y + 72;
    const radius = 38;

    if (!total) {
      doc.circle(centerX, centerY, radius).lineWidth(12).strokeColor('#e2e8f0').stroke();
      doc.fontSize(8).fillColor('#64748b').text('No findings', centerX - 28, centerY - 5, { width: 56, align: 'center' });
    } else {
      let angle = -Math.PI / 2;
      for (const item of items) {
        if (!item.value) continue;
        const nextAngle = angle + (Math.PI * 2 * item.value) / total;
        this.drawArc(doc, centerX, centerY, radius, angle, nextAngle, item.color, 12);
        angle = nextAngle;
      }
    }

    items.forEach((item, index) => {
      const legendY = y + 34 + index * 18;
      doc.rect(x + 105, legendY + 2, 8, 8).fill(item.color);
      doc.fontSize(8).fillColor('#475569').text(`${item.label}: ${item.value}`, x + 120, legendY, { width: 100 });
    });
  }

  private renderFindingsHeader(doc: PDFKit.PDFDocument) {
    this.ensureSpace(doc, 100);
    this.resetTextCursor(doc, 18);
    doc.fontSize(14).fillColor('#0f172a').text('Findings', this.contentX(doc), doc.y, { width: this.contentWidth(doc) });
    doc.moveDown(0.4);
  }

  private renderFinding(doc: PDFKit.PDFDocument, vulnerability: Vulnerability) {
    const contentX = this.contentX(doc);
    const contentWidth = this.contentWidth(doc);
    const estimatedHeight = 86 + Math.ceil(vulnerability.explanation.length / 95) * 11 + Math.ceil(vulnerability.recommendation.length / 95) * 11;
    const severityStyle = this.severityStyle(vulnerability.severity);

    this.ensureSpace(doc, estimatedHeight);
    this.resetTextCursor(doc, 8);

    const boxY = doc.y;
    doc.roundedRect(contentX, boxY, contentWidth, Math.min(estimatedHeight, 190), 6).fillAndStroke(severityStyle.background, severityStyle.border);
    doc.roundedRect(contentX, boxY, 5, Math.min(estimatedHeight, 190), 4).fill(severityStyle.accent);
    doc.y = boxY + 12;

    doc.roundedRect(contentX + 14, doc.y, severityStyle.badgeWidth, 16, 4).fill(severityStyle.accent);
    doc.fontSize(8).fillColor('#ffffff').text(vulnerability.severity, contentX + 20, doc.y + 4, {
      width: severityStyle.badgeWidth - 12,
      align: 'center'
    });
    doc.fontSize(11).fillColor(severityStyle.text).text(vulnerability.title, contentX + 24 + severityStyle.badgeWidth, boxY + 13, {
      width: contentWidth - 38 - severityStyle.badgeWidth,
      lineGap: 1
    });

    const meta = [vulnerability.file, vulnerability.lineStart ? `Line ${vulnerability.lineStart}` : undefined, vulnerability.source]
      .filter(Boolean)
      .join(' | ');
    if (meta) {
      doc.moveDown(0.25).fontSize(8).fillColor('#64748b').text(meta, contentX + 14, doc.y, { width: contentWidth - 28 });
    }

    this.writeBodyText(doc, vulnerability.explanation, contentX + 14, contentWidth - 28);
    this.writeBodyText(doc, `Recommendation: ${vulnerability.recommendation}`, contentX + 14, contentWidth - 28, '#0f172a');

    doc.y += 8;
    this.resetTextCursor(doc, 0);
  }

  private severityItems(audit: FullAudit): ChartItem[] {
    return [
      { label: 'Critical', value: audit.criticalCount, color: '#dc2626' },
      { label: 'High', value: audit.highCount, color: '#ea580c' },
      { label: 'Medium', value: audit.mediumCount, color: '#d97706' },
      { label: 'Low', value: audit.lowCount, color: '#2563eb' }
    ];
  }

  private sourceItems(audit: FullAudit): ChartItem[] {
    const sources = ['SLITHER', 'MYTHRIL', 'AST', 'AI'];
    const colors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'];
    return sources.map((source, index) => ({
      label: source,
      value: audit.vulnerabilities.filter((vulnerability) => vulnerability.source === source).length,
      color: colors[index]
    }));
  }

  private drawArc(doc: PDFKit.PDFDocument, centerX: number, centerY: number, radius: number, start: number, end: number, color: string, width: number) {
    const segments = Math.max(12, Math.ceil(Math.abs(end - start) / 0.08));
    doc.save();
    doc.lineWidth(width).strokeColor(color).lineCap('round');
    doc.moveTo(centerX + Math.cos(start) * radius, centerY + Math.sin(start) * radius);
    for (let index = 1; index <= segments; index++) {
      const angle = start + ((end - start) * index) / segments;
      doc.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    }
    doc.stroke();
    doc.restore();
  }

  private scoreColor(score: number) {
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#06b6d4';
    if (score >= 50) return '#f59e0b';
    return '#dc2626';
  }

  private severityStyle(severity: Vulnerability['severity']) {
    const styles = {
      CRITICAL: { accent: '#dc2626', border: '#fecaca', background: '#fff1f2', text: '#7f1d1d', badgeWidth: 58 },
      HIGH: { accent: '#ea580c', border: '#fed7aa', background: '#fff7ed', text: '#7c2d12', badgeWidth: 36 },
      MEDIUM: { accent: '#d97706', border: '#fde68a', background: '#fffbeb', text: '#78350f', badgeWidth: 52 },
      LOW: { accent: '#2563eb', border: '#bfdbfe', background: '#eff6ff', text: '#1e3a8a', badgeWidth: 32 },
      INFO: { accent: '#64748b', border: '#cbd5e1', background: '#f8fafc', text: '#334155', badgeWidth: 34 }
    };
    return styles[severity];
  }

  private renderDivider(doc: PDFKit.PDFDocument) {
    const y = doc.y;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).lineWidth(1).strokeColor('#e2e8f0').stroke();
    this.resetTextCursor(doc, 10);
  }

  private ensureSpace(doc: PDFKit.PDFDocument, height: number) {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      this.resetTextCursor(doc);
    }
  }

  private writeBodyText(doc: PDFKit.PDFDocument, text: string, x = this.contentX(doc), width = this.contentWidth(doc), color = '#475569') {
    doc.moveDown(0.35).fontSize(9).fillColor(color).text(text, x, doc.y, {
      width,
      align: 'left',
      lineGap: 2
    });
  }

  private resetTextCursor(doc: PDFKit.PDFDocument, gap = 0) {
    doc.x = this.contentX(doc);
    doc.y += gap;
  }

  private contentX(doc: PDFKit.PDFDocument) {
    return doc.page.margins.left;
  }

  private contentWidth(doc: PDFKit.PDFDocument) {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }
}
