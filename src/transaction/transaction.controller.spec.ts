import { NotFoundException } from '@nestjs/common';
import { TransactionController } from './transaction.controller';

const makePrisma = () => ({
  transaction: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
  },
  apiCallLog: {
    findMany: jest.fn().mockResolvedValue([]),
  },
});

const makeReq = (partnerId: string) => ({ partner: { id: partnerId } } as any);

describe('TransactionController', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let mockReconcile: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    mockReconcile = { reconcileOne: jest.fn() };
  });

  describe('list', () => {
    it('returns transactions filtered by partnerId', async () => {
      prisma.transaction.findMany.mockResolvedValue([{ id: 'tx-1' }]);
      const ctrl = new TransactionController(prisma as any, mockReconcile);
      const result = await ctrl.list(makeReq('p1'));
      expect(result).toEqual([{ id: 'tx-1' }]);
      const where = prisma.transaction.findMany.mock.calls[0][0].where;
      expect(where.partnerId).toBe('p1');
    });

    it('adds status filter when provided', async () => {
      const ctrl = new TransactionController(prisma as any, mockReconcile);
      await ctrl.list(makeReq('p1'), 'ISSUED');
      const where = prisma.transaction.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ISSUED');
    });

    it('adds policyNumber filter when provided', async () => {
      const ctrl = new TransactionController(prisma as any, mockReconcile);
      await ctrl.list(makeReq('p1'), undefined, 'POL-001');
      const where = prisma.transaction.findMany.mock.calls[0][0].where;
      expect(where.policyNumber).toBe('POL-001');
    });

    it('adds date range filter when from/to provided', async () => {
      const ctrl = new TransactionController(prisma as any, mockReconcile);
      await ctrl.list(makeReq('p1'), undefined, undefined, '2025-01-01', '2025-12-31');
      const where = prisma.transaction.findMany.mock.calls[0][0].where;
      expect(where.createdAt).toBeDefined();
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });
  });

  describe('getOne', () => {
    it('returns transaction with api logs', async () => {
      const tx = { id: 'tx-1', maGiaodich: 'gd-001', partnerId: 'p1' };
      prisma.transaction.findUnique.mockResolvedValue(tx);
      prisma.apiCallLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      const ctrl = new TransactionController(prisma as any, mockReconcile);
      const result = await ctrl.getOne(makeReq('p1'), 'tx-1');
      expect(result.id).toBe('tx-1');
      expect(result.apiCallLogs).toEqual([{ id: 'log-1' }]);
    });

    it('throws NotFoundException when tx not found', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);
      const ctrl = new TransactionController(prisma as any, mockReconcile);
      await expect(ctrl.getOne(makeReq('p1'), 'unknown')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when partnerId mismatch', async () => {
      prisma.transaction.findUnique.mockResolvedValue({ id: 'tx-1', partnerId: 'other' });
      const ctrl = new TransactionController(prisma as any, mockReconcile);
      await expect(ctrl.getOne(makeReq('p1'), 'tx-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reconcileOne', () => {
    it('triggers reconcile for partner-owned transaction', async () => {
      const tx = { id: 'tx-1', maGiaodich: 'gd-001', partnerId: 'p1' };
      prisma.transaction.findUnique.mockResolvedValue(tx);
      mockReconcile.reconcileOne.mockResolvedValue({ status: 'ISSUED', policyNumber: 'POL-001' });
      const ctrl = new TransactionController(prisma as any, mockReconcile);
      const result = await ctrl.reconcileOne(makeReq('p1'), 'tx-1');
      expect(result.status).toBe('ISSUED');
      expect(mockReconcile.reconcileOne).toHaveBeenCalledWith('gd-001');
    });

    it('throws NotFoundException when tx not found', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);
      const ctrl = new TransactionController(prisma as any, mockReconcile);
      await expect(ctrl.reconcileOne(makeReq('p1'), 'unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
