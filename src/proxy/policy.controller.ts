import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { PviClient } from '../pvi/pvi.client';
import { PartnerAuthGuard } from '../partner-auth/partner-auth.guard';
import { ApiPartnerAuth } from '../common/decorators/api-partner-auth.decorator';
import { PdfStorageService } from '../storage/pdf-storage.service';

@ApiTags('order')
@ApiPartnerAuth()
@UseGuards(PartnerAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('api/pvi/order')
export class PolicyController {
  private readonly pdfProxyEnabled =
    (process.env['PDF_PROXY_ENABLED'] ?? 'true') !== 'false';

  constructor(
    private readonly prisma: PrismaService,
    private readonly pvi: PviClient,
    private readonly pdfStorage: PdfStorageService,
  ) {}

  @Get(':maGiaodich')
  @ApiOperation({
    summary: 'Tra cứu đơn bảo hiểm',
    description: `Trả trạng thái và thông tin GCN theo maGiaodich.
- Nếu đơn đã ISSUED: trả từ DB, không gọi PVI.
- Nếu chưa ISSUED: pull GetPolicyNumber từ PVI, cập nhật DB nếu có kết quả.
- Luôn trả cùng 1 shape để đối tác không cần phân nhánh.`,
  })
  @ApiParam({ name: 'maGiaodich', description: 'UUID trả về từ POST /order' })
  @ApiOkResponse({
    schema: {
      properties: {
        maGiaodich: { type: 'string' },
        status: {
          type: 'string',
          enum: [
            'SUBMITTING',
            'SUBMITTED_OK',
            'SUBMITTED_FAIL',
            'ISSUED',
            'CALLBACK_TIMEOUT',
          ],
        },
        paymentUrl: {
          type: 'string',
          nullable: true,
          description: 'URL thanh toán PVI — redirect user đến đây',
        },
        policyNumber: { type: 'string', nullable: true },
        serialNumber: { type: 'string', nullable: true },
        pdfUrl: {
          type: 'string',
          nullable: true,
          description: 'URL tải GCN PDF — có sau khi ISSUED',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy giao dịch' })
  async getPolicy(
    @Req() req: Request,
    @Param('maGiaodich') maGiaodich: string,
  ) {
    const partnerId = (req as any).partner?.id as string | undefined;
    const tx = await this.prisma.transaction.findUnique({
      where: { maGiaodich },
    });
    if (!tx || (partnerId && tx.partnerId !== partnerId))
      throw new NotFoundException('Transaction not found');

    // Đã có kết quả → trả từ DB, không gọi PVI
    if (tx.status === 'ISSUED') {
      return {
        maGiaodich,
        status: tx.status,
        paymentUrl: tx.paymentUrl,
        policyNumber: tx.policyNumber,
        serialNumber: tx.serialNumber,
        pdfUrl: tx.pdfUrl
          ? this.pdfProxyEnabled
            ? this.pdfStorage.publicUrl(maGiaodich)
            : tx.pdfUrl
          : null,
      };
    }

    // Fail hoặc đang submit → không gọi PVI, trả trạng thái để client biết
    if (tx.status === 'SUBMITTED_FAIL' || tx.status === 'SUBMITTING') {
      return {
        maGiaodich,
        status: tx.status,
        paymentUrl: tx.paymentUrl,
        policyNumber: null,
        serialNumber: null,
        pdfUrl: null,
      };
    }

    // SUBMITTED_OK hoặc CALLBACK_TIMEOUT → pull từ PVI xem đã có chưa
    try {
      const result = await this.pvi.getPolicy(maGiaodich);
      if (result.PolicyNumber) {
        await this.prisma.transaction.update({
          where: { maGiaodich },
          data: {
            status: 'ISSUED',
            policyNumber: result.PolicyNumber,
            serialNumber: result.SerialNumber,
            pdfUrl: result.URL,
          },
        });
        return {
          maGiaodich,
          status: 'ISSUED',
          paymentUrl: tx.paymentUrl,
          policyNumber: result.PolicyNumber,
          serialNumber: result.SerialNumber,
          pdfUrl: result.URL
            ? this.pdfProxyEnabled
              ? this.pdfStorage.publicUrl(maGiaodich)
              : result.URL
            : null,
        };
      }
    } catch {
      // PVI chưa có kết quả — trả trạng thái hiện tại, không throw
    }

    return {
      maGiaodich,
      status: tx.status,
      paymentUrl: tx.paymentUrl,
      policyNumber: null,
      serialNumber: null,
      pdfUrl: null,
    };
  }
}
