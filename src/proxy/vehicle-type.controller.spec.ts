import { VehicleTypeController } from './vehicle-type.controller';

describe('VehicleTypeController', () => {
  const mockPvi = { getVehicleType: jest.fn() };
  let ctrl: VehicleTypeController;

  beforeEach(() => {
    jest.clearAllMocks();
    ctrl = new VehicleTypeController(mockPvi as any);
  });

  it('delegates to pvi.getVehicleType', async () => {
    mockPvi.getVehicleType.mockResolvedValue([
      { Value: 'LX01', Text: 'Xe con 4 chỗ' },
    ]);
    const body: any = { SoChoNgoi: 4, TrongTai: 0, Ma_MDSD: 'M01' };
    const result = await ctrl.getVehicleType(body);
    expect(result).toEqual([{ Value: 'LX01', Text: 'Xe con 4 chỗ' }]);
    expect(mockPvi.getVehicleType).toHaveBeenCalledWith({
      SoChoNgoi: 4,
      TrongTai: 0,
      Ma_MDSD: 'M01',
      LoaiHinh: '',
    });
  });

  it('passes LoaiHinh when provided', async () => {
    mockPvi.getVehicleType.mockResolvedValue([]);
    await ctrl.getVehicleType({
      SoChoNgoi: 7,
      TrongTai: 1,
      Ma_MDSD: 'M02',
      LoaiHinh: 'L1',
    });
    expect(mockPvi.getVehicleType).toHaveBeenCalledWith(
      expect.objectContaining({ LoaiHinh: 'L1' }),
    );
  });
});
