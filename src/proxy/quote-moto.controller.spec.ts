import { QuoteMotoController } from './quote-moto.controller';

describe('QuoteMotoController', () => {
  let ctrl: QuoteMotoController;
  let mockPvi: any;

  beforeEach(() => {
    mockPvi = { getMotoFee: jest.fn() };
    ctrl = new QuoteMotoController(mockPvi);
  });

  it('calls getMotoFee with correct params and returns result', async () => {
    const expected = { phi: 200000 };
    mockPvi.getMotoFee.mockResolvedValue(expected);

    const body: any = {
      ngay_dau: '2025-01-01',
      ngay_cuoi: '2025-12-31',
      loai_xe: '1',
    };
    const result = await ctrl.getMotoFee(body);

    expect(result).toBe(expected);
    expect(mockPvi.getMotoFee).toHaveBeenCalledWith({
      ngay_dau: '2025-01-01',
      ngay_cuoi: '2025-12-31',
      loai_xe: '1',
      thamgia_laiphu: false,
      muc_trachnhiem_laiphu: 0,
      so_nguoi_tgia_laiphu: 0,
      tyle_phi_laiphu: 0,
    });
  });

  it('forwards optional laiphu fields when provided', async () => {
    mockPvi.getMotoFee.mockResolvedValue({});
    const body: any = {
      ngay_dau: '2025-01-01',
      ngay_cuoi: '2025-12-31',
      loai_xe: '2',
      thamgia_laiphu: true,
      muc_trachnhiem_laiphu: 100,
      so_nguoi_tgia_laiphu: 2,
      tyle_phi_laiphu: 10,
    };
    await ctrl.getMotoFee(body);
    expect(mockPvi.getMotoFee).toHaveBeenCalledWith(
      expect.objectContaining({
        thamgia_laiphu: true,
        muc_trachnhiem_laiphu: 100,
        so_nguoi_tgia_laiphu: 2,
        tyle_phi_laiphu: 10,
      }),
    );
  });
});
