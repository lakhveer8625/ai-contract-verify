import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditGateway } from './audit.gateway';
import { AuditProcessor } from './audit.processor';
import { AuditService } from './audit.service';
import { AiEngineService } from './engines/ai-engine.service';
import { AnalyzerService } from './engines/analyzer.service';
import { ReportGeneratorService } from '../reports/report-generator.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'audit' })],
  controllers: [AuditController],
  providers: [AuditService, AuditProcessor, AnalyzerService, AiEngineService, ReportGeneratorService, AuditGateway],
  exports: [AuditService]
})
export class AuditModule {}
