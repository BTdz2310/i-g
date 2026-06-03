import { OrderMotoController } from './order-moto.controller';
import { Prisma } from '@prisma/client';

const BASE_BODY: any = {
  ten_nguoimua_bh: 'Nguyen Van A',
  diachi_nguoimua_bh: '123 ABC',
  ngay_dau: '2025-01-01',
  ngay_cuoi: '2025-12-31',
  bien_kiemsoat: '51A-12345',
  loai_xe: '1',
  nhan_hieu: 'Honda',
  nam_sanxuat: 2020,
  ten_chuxe: 'Nguyen Van A',
  email: 'a@example.com',
  so_dienthoai: '0901234567',
  dia_chi: '123 ABC',
  idempotencyKey: 'idem-moto-base',
};

const makePrisma = () => ({
  transaction: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'tx-moto-uuid' }),
    update: jest.fn().mockResolvedValue({}),
  },
});

describe('OrderMotoController', () => {
  let ctrl: OrderMotoController;
  let mockPvi: any;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    mockPvi = { createMotoOrder: jest.fn() };
    ctrl = new OrderMotoController(mockPvi, prisma as any);
  });

  it('creates transaction and returns maGiaodich on success', async () => {
    mockPvi.createMotoOrder.mockResolvedValue({
      Pr_key: 42,
      URL_Payment: 'https://pay.pvi.com/moto',
      SerialNumber: 'SN-MOTO-001',
    });
    const req: any = { partner: { id: 'partner-1' } };
    const result = await ctrl.createOrder(req, BASE_BODY);

    expect(typeof result.maGiaodich).toBe('string');
    expect(result.Pr_key).toBe(42);
    expect(result.paymentUrl).toBe('https://pay.pvi.com/moto');
    expect(result.serialNumber).toBe('SN-MOTO-001');
    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.create.mock.calls[0][0].data.productKind).toBe(
      'MOTO',
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUBMITTED_OK' }),
      }),
    );
  });

  it('updates transaction to SUBMITTED_FAIL and rethrows on PVI error', async () => {
    mockPvi.createMotoOrder.mockRejectedValue(new Error('PVI moto timeout'));
    const req: any = { partner: { id: 'partner-1' } };
    await expect(ctrl.createOrder(req, BASE_BODY)).rejects.toThrow(
      'PVI moto timeout',
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUBMITTED_FAIL',
          lastError: 'PVI moto timeout',
        }),
      }),
    );
  });

  it('works without partnerId', async () => {
    mockPvi.createMotoOrder.mockResolvedValue({ Pr_key: 1 });
    const req: any = {};
    const result = await ctrl.createOrder(req, BASE_BODY);
    expect(result.maGiaodich).toBeDefined();
    const createCall = prisma.transaction.create.mock.calls[0][0];
    expect(createCall.data.partnerId).toBeUndefined();
  });

  it('defaults optional fields', async () => {
    mockPvi.createMotoOrder.mockResolvedValue({ Pr_key: 1 });
    const req: any = { partner: { id: 'p1' } };
    await ctrl.createOrder(req, BASE_BODY);
    const input = mockPvi.createMotoOrder.mock.calls[0][0];
    expect(input.so_may).toBe('');
    expect(input.so_khung).toBe('');
    expect(input.thamgia_laiphu).toBe(false);
    expect(input.muc_trachnhiem_laiphu).toBe(0);
    expect(input.so_nguoi_tgia_laiphu).toBe(0);
    expect(input.an_bien_ks).toBe(false);
  });

  it('returns null for missing URL_Payment and SerialNumber', async () => {
    mockPvi.createMotoOrder.mockResolvedValue({ Pr_key: 7 });
    const result = await ctrl.createOrder(
      { partner: { id: 'p1' } } as any,
      BASE_BODY,
    );
    expect(result.paymentUrl).toBeNull();
    expect(result.serialNumber).toBeNull();
  });

  describe('idempotency', () => {
    const req: any = { partner: { id: 'partner-1' } };
    const body = { ...BASE_BODY, idempotencyKey: 'key-moto-123' };

    it('replays existing order without calling PVI when key already used', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        maGiaodich: 'old-moto-uuid',
        pviPrKey: '555',
        paymentUrl: 'https://pay.pvi.com/moto-old',
        serialNumber: 'SN-MOTO-OLD',
      });

      const result = await ctrl.createOrder(req, body);

      expect(prisma.transaction.findUnique).toHaveBeenCalledWith({
        where: {
          partnerId_idempotencyKey: {
            partnerId: 'partner-1',
            idempotencyKey: 'key-moto-123',
          },
        },
      });
      expect(result).toEqual({
        maGiaodich: 'old-moto-uuid',
        Pr_key: 555,
        paymentUrl: 'https://pay.pvi.com/moto-old',
        serialNumber: 'SN-MOTO-OLD',
      });
      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(mockPvi.createMotoOrder).not.toHaveBeenCalled();
    });

    it('creates a new order when key is unused', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);
      mockPvi.createMotoOrder.mockResolvedValue({ Pr_key: 1 });

      await ctrl.createOrder(req, body);

      expect(mockPvi.createMotoOrder).toHaveBeenCalledTimes(1);
      expect(
        prisma.transaction.create.mock.calls[0][0].data.idempotencyKey,
      ).toBe('key-moto-123');
    });

    it('returns the winning order when a concurrent insert hits the unique constraint', async () => {
      prisma.transaction.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          maGiaodich: 'winner-moto-uuid',
          pviPrKey: '666',
          paymentUrl: null,
          serialNumber: null,
        });
      prisma.transaction.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const result = await ctrl.createOrder(req, body);

      expect(result.maGiaodich).toBe('winner-moto-uuid');
      expect(result.Pr_key).toBe(666);
      expect(mockPvi.createMotoOrder).not.toHaveBeenCalled();
    });
  });
});
