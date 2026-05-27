import { NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { Readable } from 'stream';

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
  createReadStream: jest.fn(),
}));

import { promises as fs, createReadStream } from 'fs';
import { PdfStorageService } from './pdf-storage.service';

const makePrisma = () => ({
  transaction: { findUnique: jest.fn() },
});

const makeHttp = () => ({
  get: jest.fn(),
});

describe('PdfStorageService', () => {
  let svc: PdfStorageService;
  let prisma: ReturnType<typeof makePrisma>;
  let http: ReturnType<typeof makeHttp>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    http = makeHttp();
    svc = new PdfStorageService(prisma as any, http as any);
  });

  describe('publicUrl', () => {
    it('returns correct URL with base', () => {
      process.env['PUBLIC_BASE_URL'] = 'https://gateway.example.com';
      expect(svc.publicUrl('gd-001')).toBe(
        'https://gateway.example.com/files/policies/gd-001.pdf',
      );
      delete process.env['PUBLIC_BASE_URL'];
    });

    it('returns relative URL without base', () => {
      delete process.env['PUBLIC_BASE_URL'];
      expect(svc.publicUrl('gd-001')).toBe('/files/policies/gd-001.pdf');
    });

    it('strips trailing slash from base', () => {
      process.env['PUBLIC_BASE_URL'] = 'https://gateway.example.com/';
      expect(svc.publicUrl('gd-001')).toBe(
        'https://gateway.example.com/files/policies/gd-001.pdf',
      );
      delete process.env['PUBLIC_BASE_URL'];
    });
  });

  describe('getOrFetch', () => {
    it('returns cached file when it exists and size > 0', async () => {
      const fakeStream = new Readable({ read() {} });
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1234 });
      (createReadStream as jest.Mock).mockReturnValue(fakeStream);

      const result = await svc.getOrFetch('gd-cached');
      expect(result.stream).toBe(fakeStream);
      expect(result.size).toBe(1234);
      expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
    });

    it('fetches from PVI when file not cached', async () => {
      (fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      prisma.transaction.findUnique.mockResolvedValue({
        pdfUrl: 'https://pvi.example.com/doc.pdf',
      });
      const buf = Buffer.from('pdf-content');
      http.get.mockReturnValue(of({ data: buf }));

      const result = await svc.getOrFetch('gd-new');
      expect(result.size).toBe(buf.length);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('throws NotFoundException when no pdfUrl in DB', async () => {
      (fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      prisma.transaction.findUnique.mockResolvedValue({ pdfUrl: null });

      await expect(svc.getOrFetch('gd-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when transaction not found', async () => {
      (fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(svc.getOrFetch('gd-notfound')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('re-fetches when cached file has size 0', async () => {
      (fs.stat as jest.Mock).mockResolvedValue({ size: 0 });
      prisma.transaction.findUnique.mockResolvedValue({
        pdfUrl: 'https://pvi.example.com/doc.pdf',
      });
      const buf = Buffer.from('real-pdf');
      http.get.mockReturnValue(of({ data: buf }));

      const result = await svc.getOrFetch('gd-empty');
      expect(result.size).toBe(buf.length);
    });
  });
});
