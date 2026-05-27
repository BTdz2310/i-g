import { ReconcileService } from './reconcile.service';
import { validateEnv } from '../config/env';

beforeAll(() => {
  validateEnv({
    PVI_BASE_URL: 'https://pvi.example.com',
    PVI_CP_ID: 'cp',
    PVI_KEY: 'k',
    PVI_EP_GET_FEE: '/fee',
    PVI_EP_CREATE_ORDER: '/order',
    PVI_EP_CATEGORY: '/cat',
    PVI_EP_GET_VEHICLE_TYPE: '/vt',
    PVI_EP_GET_POLICY: '/pol',
    PVI_EP_GET_FEE_MOTO: '/fee-moto',
    PVI_EP_CREATE_ORDER_MOTO: '/order-moto',
    DATABASE_URL: 'postgres://localhost/test',
    REDIS_URL: 'redis://localhost',
    PARTNER_SECRET_MASTER_KEY: Buffer.alloc(32, 0x01).toString('base64'),
    ADMIN_JWT_SECRET: 'supersecretjwtsecretkey1234567890',
    RECONCILE_GRACE_MIN: '10',
    RECONCILE_MAX_ATTEMPTS: '3',
  });
});

const TX = {
  id: 'tx-1',
  maGiaodich: 'gd-001',
  reconcileAttempts: 0,
  status: 'SUBMITTED_OK',
};

const makePrisma = () => ({
  transaction: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
});

describe('ReconcileService', () => {
  let mockPvi: any;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPvi = { getPolicy: jest.fn() };
    prisma = makePrisma();
  });

  describe('reconcile', () => {
    it('does nothing when no pending transactions', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      const svc = new ReconcileService(prisma as any, mockPvi);
      await svc.reconcile();
      expect(mockPvi.getPolicy).not.toHaveBeenCalled();
    });

    it('updates to ISSUED when policy found', async () => {
      prisma.transaction.findMany.mockResolvedValue([TX]);
      mockPvi.getPolicy.mockResolvedValue({
        PolicyNumber: 'POL-001',
        SerialNumber: 'SN-001',
        URL: 'https://pdf.com',
      });
      const svc = new ReconcileService(prisma as any, mockPvi);
      await svc.reconcile();
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ISSUED',
            policyNumber: 'POL-001',
          }),
        }),
      );
    });

    it('increments attempts when no policy yet', async () => {
      prisma.transaction.findMany.mockResolvedValue([TX]);
      mockPvi.getPolicy.mockResolvedValue({ PolicyNumber: null });
      const svc = new ReconcileService(prisma as any, mockPvi);
      await svc.reconcile();
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUBMITTED_OK',
            reconcileAttempts: 1,
          }),
        }),
      );
    });

    it('transitions to CALLBACK_TIMEOUT when max attempts reached', async () => {
      const maxTx = { ...TX, reconcileAttempts: 2 }; // max is 3, next = 3 >= 3
      prisma.transaction.findMany.mockResolvedValue([maxTx]);
      mockPvi.getPolicy.mockResolvedValue({ PolicyNumber: null });
      const svc = new ReconcileService(prisma as any, mockPvi);
      await svc.reconcile();
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CALLBACK_TIMEOUT' }),
        }),
      );
    });

    it('handles PVI error by incrementing attempts', async () => {
      prisma.transaction.findMany.mockResolvedValue([TX]);
      mockPvi.getPolicy.mockRejectedValue(new Error('PVI down'));
      const svc = new ReconcileService(prisma as any, mockPvi);
      await svc.reconcile();
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastError: 'PVI down' }),
        }),
      );
    });
  });

  describe('reconcileOne', () => {
    it('returns ISSUED when policy found', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue(TX);
      mockPvi.getPolicy.mockResolvedValue({
        PolicyNumber: 'POL-001',
        SerialNumber: 'SN-001',
        URL: 'https://pdf.com',
      });
      const svc = new ReconcileService(prisma as any, mockPvi);
      const result = await svc.reconcileOne('gd-001');
      expect(result.status).toBe('ISSUED');
      expect(result.policyNumber).toBe('POL-001');
    });

    it('returns current status when no policy', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue({
        ...TX,
        policyNumber: null,
      });
      mockPvi.getPolicy.mockResolvedValue({ PolicyNumber: null });
      const svc = new ReconcileService(prisma as any, mockPvi);
      const result = await svc.reconcileOne('gd-001');
      expect(result.status).toBe('SUBMITTED_OK');
      expect(result.policyNumber).toBeNull();
    });
  });
});
