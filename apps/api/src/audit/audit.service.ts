import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditDto } from './dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService, @InjectQueue('audit') private readonly queue: Queue) {}

  async createFromSources(userId: string, dto: CreateAuditDto) {
    const audit = await this.prisma.audit.create({
      data: {
        userId,
        title: dto.title,
        status: AuditStatus.QUEUED,
        contracts: {
          create: dto.contracts.map((contract) => ({
            fileName: contract.fileName.replace(/[^a-zA-Z0-9._-]/g, ''),
            source: contract.source
          }))
        }
      },
      include: { contracts: true }
    });

    await this.queue.add('run-audit', { auditId: audit.id }, { attempts: 2, backoff: { type: 'exponential', delay: 5000 } });
    return audit;
  }

  history(userId: string) {
    return this.prisma.audit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { vulnerabilities: true, reports: true },
      take: 50
    });
  }

  async findForUser(userId: string, id: string) {
    const audit = await this.prisma.audit.findUnique({
      where: { id },
      include: { contracts: true, vulnerabilities: true, reports: true, recommendations: true }
    });
    if (!audit) throw new NotFoundException('Audit not found');
    if (audit.userId !== userId) throw new ForbiddenException('Access denied');
    return audit;
  }
}
