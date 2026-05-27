import { OrderController } from './order.controller';

const BASE_BODY: any = {
  TenKH: 'Nguyen Van A',
  DiaChiKH: '123 ABC',
  TenChuXe: 'Nguyen Van A',
  DiaChiChuXe: '123 ABC',
  NgayDau: '2025-01-01',
  NgayCuoi: '2025-12-31',
  GioDau: '00:00',
  GioCuoi: '23:59',
  EmailKH: 'a@example.com',
  LoaiXe: '1',
  ChoNgoi: 4,
  TenLoaiXe: 'Xe con',
  TrongTai: 0,
  PhiBHTNDSBB: '500000',
  NamSD: 2020,
  BienKiemSoat: '51A-12345',
  HieuXe: 'Toyota',
  DongXe: 'Vios',
  NamSX: 2020,
  DienThoai: '0901234567',
  SoKhung: 'KH001',
  SoMay: 'MY001',
  TongPhi: '500000',
  MaMucDichSD: 'M01',
};

const makePrisma = () => ({
  transaction: {
    create: jest.fn().mockResolvedValue({ id: 'tx-uuid' }),
    update: jest.fn().mockResolvedValue({}),
  },
});

describe('OrderController', () => {
  let ctrl: OrderController;
  let mockPvi: any;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    mockPvi = { createOrder: jest.fn() };
    ctrl = new OrderController(mockPvi, prisma as any);
  });

  it('creates transaction and returns maGiaodich on success', async () => {
    mockPvi.createOrder.mockResolvedValue({
      Pr_key: 999,
      URL_Payment: 'https://pay.pvi.com',
      SerialNumber: 'SN001',
    });
    const req: any = { partner: { id: 'partner-1' } };
    const result = await ctrl.createOrder(req, BASE_BODY);

    expect(typeof result.maGiaodich).toBe('string');
    expect(result.Pr_key).toBe(999);
    expect(result.paymentUrl).toBe('https://pay.pvi.com');
    expect(result.serialNumber).toBe('SN001');
    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUBMITTED_OK' }),
      }),
    );
  });

  it('updates transaction to SUBMITTED_FAIL and rethrows on PVI error', async () => {
    mockPvi.createOrder.mockRejectedValue(new Error('PVI timeout'));
    const req: any = { partner: { id: 'partner-1' } };
    await expect(ctrl.createOrder(req, BASE_BODY)).rejects.toThrow(
      'PVI timeout',
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUBMITTED_FAIL' }),
      }),
    );
  });

  it('works without partnerId', async () => {
    mockPvi.createOrder.mockResolvedValue({ Pr_key: 1 });
    const req: any = {};
    const result = await ctrl.createOrder(req, BASE_BODY);
    expect(result.maGiaodich).toBeDefined();
    const createCall = prisma.transaction.create.mock.calls[0][0];
    expect(createCall.data.partnerId).toBeUndefined();
  });

  it('defaults productKind to AUTO', async () => {
    mockPvi.createOrder.mockResolvedValue({ Pr_key: 1 });
    await ctrl.createOrder({ partner: { id: 'p1' } } as any, BASE_BODY);
    expect(prisma.transaction.create.mock.calls[0][0].data.productKind).toBe(
      'AUTO',
    );
  });
});
