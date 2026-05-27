import { PdfController } from './pdf.controller';
import { Readable } from 'stream';

describe('PdfController', () => {
  let ctrl: PdfController;
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = { getOrFetch: jest.fn() };
    ctrl = new PdfController(mockStorage);
  });

  it('sets correct headers and pipes stream to response', async () => {
    const stream = new Readable({ read() {} });
    mockStorage.getOrFetch.mockResolvedValue({ stream, size: 5678 });

    const res: any = {
      setHeader: jest.fn(),
      pipe: jest.fn(),
    };
    stream.pipe = jest.fn();

    await ctrl.download('gd-001', res);

    expect(mockStorage.getOrFetch).toHaveBeenCalledWith('gd-001');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 5678);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'inline; filename="policy-gd-001.pdf"',
    );
    expect(stream.pipe).toHaveBeenCalledWith(res);
  });

  it('propagates error from storage service', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    mockStorage.getOrFetch.mockRejectedValue(new NotFoundException());
    const res: any = { setHeader: jest.fn() };
    await expect(ctrl.download('gd-missing', res)).rejects.toThrow(NotFoundException);
  });
});
