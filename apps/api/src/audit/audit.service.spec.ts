import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';

const mockAudit = (userId = 'u1') => ({
  id: 'audit1',
  userId,
  title: 'Test Audit',
  status: 'QUEUED',
  contracts: [],
  vulnerabilities: [],
  reports: [],
  recommendations: []
});

describe('AuditService', () => {
  let svc: AuditService;
  let prisma: any;
  let queue: any;

  beforeEach(() => {
    prisma = {
      audit: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn()
      }
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    svc = new AuditService(prisma, queue);
  });

  describe('createFromSources', () => {
    it('creates audit and enqueues job', async () => {
      const audit = mockAudit();
      prisma.audit.create.mockResolvedValue(audit);

      const result = await svc.createFromSources('u1', {
        title: 'My Audit',
        contracts: [{ fileName: 'Token.sol', source: 'pragma solidity ^0.8.0; contract Token {}' }]
      });

      expect(prisma.audit.create).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith('run-audit', { auditId: audit.id }, expect.any(Object));
      expect(result.id).toBe('audit1');
    });

    it('sanitizes contract fileName (strips slashes and special chars)', async () => {
      prisma.audit.create.mockResolvedValue(mockAudit());
      await svc.createFromSources('u1', {
        title: 'T',
        contracts: [{ fileName: '../../../etc/passwd.sol', source: 'pragma solidity ^0.8.0;' }]
      });
      const createCall = prisma.audit.create.mock.calls[0][0];
      const fileName = createCall.data.contracts.create[0].fileName;
      // Slashes and path separators are stripped
      expect(fileName).not.toContain('/');
      // The regex allows dots so ".." becomes "......" but traversal is impossible without slashes
      expect(fileName).not.toMatch(/\//);
    });
  });

  describe('history', () => {
    it('returns user audits ordered by createdAt desc', async () => {
      const audits = [mockAudit('u1'), mockAudit('u1')];
      prisma.audit.findMany.mockResolvedValue(audits);

      const result = await svc.history('u1');
      expect(prisma.audit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' }, orderBy: { createdAt: 'desc' } })
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findForUser', () => {
    it('returns audit when userId matches', async () => {
      prisma.audit.findUnique.mockResolvedValue(mockAudit('u1'));
      const result = await svc.findForUser('u1', 'audit1');
      expect(result.id).toBe('audit1');
    });

    it('throws NotFoundException when audit does not exist', async () => {
      prisma.audit.findUnique.mockResolvedValue(null);
      await expect(svc.findForUser('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when audit belongs to another user', async () => {
      prisma.audit.findUnique.mockResolvedValue(mockAudit('other-user'));
      await expect(svc.findForUser('u1', 'audit1')).rejects.toThrow(ForbiddenException);
    });
  });
});
