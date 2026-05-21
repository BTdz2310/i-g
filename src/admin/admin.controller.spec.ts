import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AdminController } from './admin.controller';

const makeCtrl = (overrides: Record<string, any> = {}) => {
  const prisma = { apiCallLog: { findMany: jest.fn().mockResolvedValue([]) } };
  const partnerService = {
    createPartner: jest.fn(),
    listPartners: jest.fn().mockResolvedValue([]),
    rotateSecret: jest.fn(),
    updateStatus: jest.fn(),
    updatePartner: jest.fn(),
    ...overrides.partnerService,
  };
  const adminService = {
    findByUsername: jest.fn(),
    verifyPassword: jest.fn(),
    ...overrides.adminService,
  };
  const adminJwt = {
    sign: jest.fn().mockReturnValue({ token: 'tok', expiresIn: '12h' }),
    ...overrides.adminJwt,
  };
  const ctrl = new AdminController(prisma as any, partnerService as any, adminService as any, adminJwt as any);
  return { ctrl, prisma, partnerService, adminService, adminJwt };
};

describe('AdminController', () => {
  describe('login', () => {
    it('returns JWT on valid credentials', async () => {
      const { ctrl, adminService } = makeCtrl();
      adminService.findByUsername.mockResolvedValue({ id: 'a1', username: 'admin', passwordHash: 'h' });
      adminService.verifyPassword.mockResolvedValue(true);
      const result = await ctrl.login({ username: 'admin', password: 'pw' } as any);
      expect(result.token).toBe('tok');
    });

    it('throws Unauthorized when user not found', async () => {
      const { ctrl, adminService } = makeCtrl();
      adminService.findByUsername.mockResolvedValue(null);
      await expect(ctrl.login({ username: 'x', password: 'y' } as any)).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized on wrong password', async () => {
      const { ctrl, adminService } = makeCtrl();
      adminService.findByUsername.mockResolvedValue({ id: 'a1', username: 'admin', passwordHash: 'h' });
      adminService.verifyPassword.mockResolvedValue(false);
      await expect(ctrl.login({ username: 'admin', password: 'wrong' } as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createPartner', () => {
    it('returns partner credentials', async () => {
      const { ctrl, partnerService } = makeCtrl();
      partnerService.createPartner.mockResolvedValue({
        partner: { id: 'p1', clientId: 'cid', name: 'Test' },
        keyId: 'kid',
        secret: 'sec',
      });
      const result = await ctrl.createPartner({ name: 'Test' } as any);
      expect(result.clientId).toBe('cid');
      expect(result.keyId).toBe('kid');
      expect(result.secret).toBe('sec');
    });
  });

  describe('listPartners', () => {
    it('delegates to partnerService', async () => {
      const { ctrl, partnerService } = makeCtrl();
      partnerService.listPartners.mockResolvedValue([{ id: 'p1' }]);
      const result = await ctrl.listPartners();
      expect(result).toEqual([{ id: 'p1' }]);
    });
  });

  describe('rotatePartnerSecret', () => {
    it('returns new keyId and secret', async () => {
      const { ctrl, partnerService } = makeCtrl();
      partnerService.rotateSecret.mockResolvedValue({ keyId: 'new-kid', secret: 'new-sec' });
      const result = await ctrl.rotatePartnerSecret('p1', {} as any);
      expect(result.keyId).toBe('new-kid');
    });

    it('throws NotFoundException when partner not found', async () => {
      const { ctrl, partnerService } = makeCtrl();
      partnerService.rotateSecret.mockResolvedValue(null);
      await expect(ctrl.rotatePartnerSecret('unknown', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePartnerStatus', () => {
    it('delegates to partnerService.updateStatus', async () => {
      const { ctrl, partnerService } = makeCtrl();
      partnerService.updateStatus.mockResolvedValue({ id: 'p1', status: 'INACTIVE' });
      const result = await ctrl.updatePartnerStatus('p1', { status: 'INACTIVE' } as any);
      expect(result.status).toBe('INACTIVE');
    });
  });

  describe('updatePartner', () => {
    it('returns updated partner', async () => {
      const { ctrl, partnerService } = makeCtrl();
      partnerService.updatePartner.mockResolvedValue({ id: 'p1', name: 'Updated' });
      const result = await ctrl.updatePartner('p1', { name: 'Updated' } as any);
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException when partner not found', async () => {
      const { ctrl, partnerService } = makeCtrl();
      partnerService.updatePartner.mockResolvedValue(null);
      await expect(ctrl.updatePartner('unknown', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listApiLogs', () => {
    it('returns logs from prisma', async () => {
      const { ctrl, prisma } = makeCtrl();
      prisma.apiCallLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      const result = await ctrl.listApiLogs();
      expect(result).toEqual([{ id: 'log-1' }]);
    });

    it('filters by maGiaodich when provided', async () => {
      const { ctrl, prisma } = makeCtrl();
      prisma.apiCallLog.findMany.mockResolvedValue([]);
      await ctrl.listApiLogs('gd-001');
      const where = prisma.apiCallLog.findMany.mock.calls[0][0].where;
      expect(where.maGiaodich).toBe('gd-001');
    });

    it('adds date range when from/to provided', async () => {
      const { ctrl, prisma } = makeCtrl();
      prisma.apiCallLog.findMany.mockResolvedValue([]);
      await ctrl.listApiLogs(undefined, '2025-01-01', '2025-12-31');
      const where = prisma.apiCallLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt).toBeDefined();
    });
  });
});
