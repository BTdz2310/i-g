import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { promises as fs, createReadStream } from 'fs';
import { join, resolve } from 'path';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';

const FETCH_TIMEOUT_MS = 30_000;

/**
 * Cache PDF GCN từ PVI về local để stream lại cho đối tác cấp 2.
 *
 * Lý do: URL gốc của PVI (http://piastest.pvi.com.vn/...) yêu cầu IP whitelist,
 * đối tác cấp 2 không gọi trực tiếp được. Gateway server có IP đã whitelist nên
 * fetch giúp 1 lần, lưu vào disk, các lần sau serve từ cache.
 */
@Injectable()
export class PdfStorageService {
  private readonly logger = new Logger(PdfStorageService.name);
  private readonly storageDir = resolve(process.cwd(), 'storage', 'policies');

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {
    void fs.mkdir(this.storageDir, { recursive: true });
  }

  /**
   * Trả URL public mà đối tác cấp 2 sẽ dùng để tải PDF. Không tải PDF ngay —
   * lazy fetch khi đối tác thực sự GET endpoint.
   */
  publicUrl(maGiaodich: string): string {
    const base = process.env['PUBLIC_BASE_URL'] ?? '';
    return `${base.replace(/\/$/, '')}/files/policies/${maGiaodich}.pdf`;
  }

  /**
   * Trả về readable stream của file PDF. Nếu chưa cache thì fetch từ PVI trước.
   * Throw NotFoundException nếu không có pdfUrl gốc hoặc fetch thất bại.
   */
  async getOrFetch(
    maGiaodich: string,
  ): Promise<{ stream: Readable; size: number }> {
    const filePath = join(this.storageDir, `${maGiaodich}.pdf`);

    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 0) {
        return { stream: createReadStream(filePath), size: stat.size };
      }
    } catch {
      // chưa có — fetch xuống
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { maGiaodich },
      select: { pdfUrl: true },
    });
    if (!tx?.pdfUrl) {
      throw new NotFoundException('PDF not available for this transaction');
    }

    this.logger.log(`Fetching PDF from upstream for ${maGiaodich}`);
    const res = await firstValueFrom(
      this.http.get<ArrayBuffer>(tx.pdfUrl, {
        responseType: 'arraybuffer',
        timeout: FETCH_TIMEOUT_MS,
      }),
    );

    const buf = Buffer.from(res.data);
    await fs.writeFile(filePath, buf);
    this.logger.log(`Cached PDF ${maGiaodich} (${buf.length} bytes)`);

    return { stream: Readable.from(buf), size: buf.length };
  }
}
