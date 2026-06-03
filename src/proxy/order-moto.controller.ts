import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PviClient } from '../pvi/pvi.client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrderMotoDto,
  CreateOrderMotoResultDto,
} from './dto/create-order-moto.dto';
import { CreateMotoOrderInput } from '../pvi/dto/create-order-moto.dto';
import { PartnerAuthGuard } from '../partner-auth/partner-auth.guard';
import { ApiPartnerAuth } from '../common/decorators/api-partner-auth.decorator';
import { RawBodyRequest } from '../common/types/raw-body';

@ApiTags('order-moto')
@ApiPartnerAuth()
@UseGuards(PartnerAuthGuard)
@Controller('api/pvi/moto/order')
export class OrderMotoController {
  constructor(
    private readonly pvi: PviClient,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Tạo đơn TNDS xe máy',
    description:
      'Gateway tự sinh ma_giaodich (UUID). GCN về qua callback hoặc poll GET /api/pvi/order/:maGiaodich (endpoint chung).',
  })
  @ApiBody({ type: CreateOrderMotoDto })
  @ApiCreatedResponse({ type: CreateOrderMotoResultDto })
  async createOrder(
    @Req() req: RawBodyRequest,
    @Body() body: CreateOrderMotoDto,
  ) {
    const maGiaodich = randomUUID();
    const partnerId = (req as any).partner?.id as string | undefined;
    const idempotencyKey = body.idempotencyKey;

    // Idempotent: cùng (partner, key) đã submit → trả lại đúng đơn cũ, không gọi PVI lần nữa.
    // partnerId luôn có sau PartnerAuthGuard; guard chỉ phòng trường hợp route đổi cấu hình.
    if (partnerId && idempotencyKey) {
      const existing = await this.prisma.transaction.findUnique({
        where: { partnerId_idempotencyKey: { partnerId, idempotencyKey } },
      });
      if (existing) return this.toResult(existing);
    }

    let tx: Awaited<ReturnType<typeof this.prisma.transaction.create>>;
    try {
      tx = await this.prisma.transaction.create({
        data: {
          maGiaodich,
          productKind: 'MOTO',
          status: 'SUBMITTING',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          inboundPayload: JSON.parse(JSON.stringify(body)),
          ...(partnerId ? { partnerId } : {}),
          idempotencyKey,
        },
      });
    } catch (err) {
      // Race: request song song cùng (partner, key) đã thắng — trả về đơn của nó.
      if (
        partnerId &&
        idempotencyKey &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const winner = await this.prisma.transaction.findUnique({
          where: { partnerId_idempotencyKey: { partnerId, idempotencyKey } },
        });
        if (winner) return this.toResult(winner);
      }
      throw err;
    }

    try {
      const input: CreateMotoOrderInput = {
        ma_giaodich: maGiaodich,
        ten_nguoimua_bh: body.ten_nguoimua_bh,
        diachi_nguoimua_bh: body.diachi_nguoimua_bh,
        ngay_dau: body.ngay_dau,
        ngay_cuoi: body.ngay_cuoi,
        bien_kiemsoat: body.bien_kiemsoat,
        so_may: body.so_may ?? '',
        so_khung: body.so_khung ?? '',
        loai_xe: body.loai_xe,
        nhan_hieu: body.nhan_hieu,
        nam_sanxuat: body.nam_sanxuat,
        ten_chuxe: body.ten_chuxe,
        email: body.email,
        so_dienthoai: body.so_dienthoai,
        dia_chi: body.dia_chi,
        thamgia_laiphu: body.thamgia_laiphu ?? false,
        muc_trachnhiem_laiphu: body.muc_trachnhiem_laiphu ?? 0,
        so_nguoi_tgia_laiphu: body.so_nguoi_tgia_laiphu ?? 0,
        an_bien_ks: body.an_bien_ks ?? false,
      };

      const result = await this.pvi.createMotoOrder(input);

      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: 'SUBMITTED_OK',
          pviPrKey: String(result.Pr_key),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          pviResponse: JSON.parse(JSON.stringify(result)),
          paymentUrl: result.URL_Payment ?? null,
          serialNumber: result.SerialNumber ?? null,
        },
      });

      return {
        maGiaodich,
        Pr_key: result.Pr_key,
        paymentUrl: result.URL_Payment ?? null,
        serialNumber: result.SerialNumber ?? null,
      };
    } catch (err) {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: 'SUBMITTED_FAIL',
          lastError: (err as Error).message,
        },
      });
      throw err;
    }
  }

  /** Map một transaction đã lưu về shape kết quả tạo đơn (dùng cho replay idempotent). */
  private toResult(tx: {
    maGiaodich: string;
    pviPrKey: string | null;
    paymentUrl: string | null;
    serialNumber: string | null;
  }): CreateOrderMotoResultDto {
    const prKey = tx.pviPrKey != null ? Number(tx.pviPrKey) : null;
    return {
      maGiaodich: tx.maGiaodich,
      Pr_key: prKey != null && Number.isFinite(prKey) ? prKey : null,
      paymentUrl: tx.paymentUrl,
      serialNumber: tx.serialNumber,
    };
  }
}
