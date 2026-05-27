import { OrderMotoController } from './order-moto.controller';

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
};

const makePrisma = () => ({
  transaction: {
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
});
