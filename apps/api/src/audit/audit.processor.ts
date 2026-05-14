import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AuditStatus, Severity } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ReportGeneratorService } from '../reports/report-generator.service';
import { AuditGateway } from './audit.gateway';
import { AiEngineService } from './engines/ai-engine.service';
import { AnalyzerService } from './engines/analyzer.service';

@Injectable()
@Processor('audit')
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyzer: AnalyzerService,
    private readonly ai: AiEngineService,
    private readonly reports: ReportGeneratorService,
    private readonly gateway: AuditGateway
  ) {
    super();
  }

  async process(job: Job<{ auditId: string }>) {
      const { auditId } = job.data;
    try {
      const audit = await this.setStatus(auditId, AuditStatus.PARSING, 'Parsing Solidity contracts');
      await this.prisma.$transaction([
        this.prisma.vulnerability.deleteMany({ where: { auditId } }),
        this.prisma.aiRecommendation.deleteMany({ where: { auditId } }),
        this.prisma.report.deleteMany({ where: { auditId } })
      ]);
      const astContracts = await this.analyzer.parseContracts(audit.contracts);
      await this.prisma.$transaction(
        astContracts.map((contract) => this.prisma.contract.update({ where: { id: contract.id }, data: { ast: contract.ast } }))
      );

      await this.setStatus(auditId, AuditStatus.SLITHER, 'Running Slither detectors');
      const slither = await this.analyzer.runSlither(audit.contracts);

      await this.setStatus(auditId, AuditStatus.MYTHRIL, 'Running Mythril symbolic analysis');
      const mythril = await this.analyzer.runMythril(audit.contracts);

      await this.setStatus(auditId, AuditStatus.AI_ANALYSIS, 'Generating AI explanations and remediation');
      const aiJson = await this.ai.analyze(audit.contracts, [...slither, ...mythril]);
      const counts = this.countSeverity(aiJson.vulnerabilities);

      await this.prisma.vulnerability.createMany({
        data: aiJson.vulnerabilities.map((v) => ({
          auditId,
          title: v.title,
          category: v.category,
          severity: v.severity as Severity,
          confidence: v.confidence,
          file: v.file,
          lineStart: v.lineStart,
          lineEnd: v.lineEnd,
          snippet: v.snippet,
          explanation: v.explanation,
          recommendation: v.recommendation,
          fixedCode: v.fixedCode,
          source: v.source
        }))
      });
      await this.prisma.aiRecommendation.createMany({
        data: aiJson.recommendations.map((r) => ({ auditId, type: r.type, title: r.title, body: r.body, code: r.code }))
      });

      await this.setStatus(auditId, AuditStatus.REPORT_GENERATION, 'Generating JSON, Markdown, and PDF reports');
      const fullAudit = await this.prisma.audit.update({
        where: { id: auditId },
        data: {
          analyzerRaw: { slither, mythril },
          gasOptimizations: aiJson.gasOptimizations,
          executiveSummary: aiJson.executiveSummary,
          overallScore: aiJson.overallScore,
          ...counts
        },
        include: { contracts: true, vulnerabilities: true, recommendations: true }
      });
      const report = await this.reports.generate(fullAudit);
      await this.prisma.report.create({ data: { auditId, ...report } });

      await this.setStatus(auditId, AuditStatus.COMPLETED, 'Audit complete');
    } catch (error) {
      this.logger.error(error);
      await this.setStatus(auditId, AuditStatus.FAILED, 'Audit failed');
      throw error;
    }
  }

  private async setStatus(auditId: string, status: AuditStatus, message: string) {
    const audit = await this.prisma.audit.update({
      where: { id: auditId },
      data: { status },
      include: { contracts: true }
    });
    this.gateway.publish(auditId, status, message);
    return audit;
  }

  private countSeverity(vulnerabilities: Array<{ severity: string }>) {
    return {
      criticalCount: vulnerabilities.filter((v) => v.severity === 'CRITICAL').length,
      highCount: vulnerabilities.filter((v) => v.severity === 'HIGH').length,
      mediumCount: vulnerabilities.filter((v) => v.severity === 'MEDIUM').length,
      lowCount: vulnerabilities.filter((v) => v.severity === 'LOW').length
    };
  }
}
