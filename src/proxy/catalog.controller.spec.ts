import { CatalogController } from './catalog.controller';

describe('CatalogController', () => {
  const mockPvi = { getCategory: jest.fn() };
  let ctrl: CatalogController;

  beforeEach(() => {
    jest.clearAllMocks();
    ctrl = new CatalogController(mockPvi as any);
  });

  it('delegates to pvi.getCategory', async () => {
    mockPvi.getCategory.mockResolvedValue([{ Value: '1', Text: 'Xe con' }]);
    const result = await ctrl.getCategory({ ten_dmuc: 'LOAIXE' });
    expect(result).toEqual([{ Value: '1', Text: 'Xe con' }]);
    expect(mockPvi.getCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        ten_dmuc: 'LOAIXE',
        ma_donvi: '34',
        ma_user: '',
      }),
    );
  });

  it('applies defaults for optional fields', async () => {
    mockPvi.getCategory.mockResolvedValue([]);
    await ctrl.getCategory({ ten_dmuc: 'CAT' });
    const call = mockPvi.getCategory.mock.calls[0][0];
    expect(call.parent_value).toBe('');
    expect(call.giatri_chon).toBe('');
  });

  it('passes provided parent_value and giatri_chon', async () => {
    mockPvi.getCategory.mockResolvedValue([]);
    await ctrl.getCategory({
      ten_dmuc: 'CAT',
      parent_value: 'P1',
      giatri_chon: 'G1',
    });
    const call = mockPvi.getCategory.mock.calls[0][0];
    expect(call.parent_value).toBe('P1');
    expect(call.giatri_chon).toBe('G1');
  });
});
