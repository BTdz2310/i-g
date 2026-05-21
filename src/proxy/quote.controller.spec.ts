import { QuoteController } from './quote.controller';

describe('QuoteController', () => {
  const mockPvi = { getFee: jest.fn() };
  let ctrl: QuoteController;

  beforeEach(() => {
    jest.clearAllMocks();
    ctrl = new QuoteController(mockPvi as any);
  });

  it('delegates to pvi.getFee and returns result', async () => {
    mockPvi.getFee.mockResolvedValue({ TotalFee: 500000 });
    const body: any = {
      ma_trongtai: 'TT01',
      so_cho: 5,
      ma_mdsd: 'M01',
      ma_loaixe: 'LX01',
      giodau: '00:00',
      giocuoi: '23:59',
      ngaydau: '2025-01-01',
      ngaycuoi: '2025-12-31',
      thamgia_tndsbb: true,
    };
    const result = await ctrl.getFee(body);
    expect(result).toEqual({ TotalFee: 500000 });
    expect(mockPvi.getFee).toHaveBeenCalledWith(
      expect.objectContaining({ ma_trongtai: 'TT01', so_cho: 5 }),
    );
  });

  it('applies defaults for optional boolean fields', async () => {
    mockPvi.getFee.mockResolvedValue({});
    await ctrl.getFee({ ma_trongtai: 'T', so_cho: 4, ma_mdsd: 'M', ma_loaixe: 'L', giodau: '0', giocuoi: '0', ngaydau: '2025-01-01', ngaycuoi: '2025-12-31', thamgia_tndsbb: true } as any);
    const call = mockPvi.getFee.mock.calls[0][0];
    expect(call.thamgia_laiphu).toBe(false);
    expect(call.MayKeo).toBe(false);
    expect(call.mtn_laiphu).toBe(0);
    expect(call.so_nguoi).toBe(0);
  });
});
