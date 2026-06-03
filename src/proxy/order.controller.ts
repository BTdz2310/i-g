import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PviClient } from '../pvi/pvi.client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderInput } from '../pvi/dto/create-order.dto';
import { CreateOrderDto, CreateOrderResultDto } from './dto/create-order.dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PartnerAuthGuard } from '../partner-auth/partner-auth.guard';
import { RawBodyRequest } from '../common/types/raw-body';
import { ApiPartnerAuth } from '../common/decorators/api-partner-auth.decorator';

@ApiTags('order')
@ApiPartnerAuth()
@UseGuards(PartnerAuthGuard)
@Controller('api/pvi/order')
export class OrderController {
  constructor(
    private readonly pvi: PviClient,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Tạo đơn bảo hiểm TNDS',
    description:
      'Gateway tự sinh ma_giaodich (UUID) và trả về. Đơn được gửi sang PVI — GCN sẽ về qua callback hoặc poll GET /order/:maGiaodich.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({
    type: CreateOrderResultDto,
    description: 'maGiaodich để track đơn + Pr_key nội bộ PVI',
  })
  async createOrder(@Req() req: RawBodyRequest, @Body() body: CreateOrderDto) {
    const maGiaodich = randomUUID();
    const productKind = body.productKind ?? 'AUTO';
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
          productKind,
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
      const input: CreateOrderInput = {
        ma_giaodich: maGiaodich,
        TenKH: body.TenKH,
        DiaChiKH: body.DiaChiKH,
        TenTH: body.TenTH ?? '',
        DiaChiTH: body.DiaChiTH ?? '',
        TenChuXe: body.TenChuXe,
        DiaChiChuXe: body.DiaChiChuXe,
        NgayDau: body.NgayDau,
        NgayCuoi: body.NgayCuoi,
        GioDau: body.GioDau,
        GioCuoi: body.GioCuoi,
        ThamGiaLaiPhu: body.ThamGiaLaiPhu ?? false,
        EmailKH: body.EmailKH,
        LoaiXe: body.LoaiXe,
        ChoNgoi: body.ChoNgoi,
        TenLoaiXe: body.TenLoaiXe,
        TrongTai: body.TrongTai,
        MTNLaiPhu: body.MTNLaiPhu ?? '0',
        SoNguoiToiDa: body.SoNguoiToiDa ?? '0',
        PhiBHTNDSBB: body.PhiBHTNDSBB,
        PhiBHLaiPhu: body.PhiBHLaiPhu ?? '0',
        NamSD: body.NamSD,
        AnBKS: body.AnBKS ?? false,
        BienKiemSoat: body.BienKiemSoat,
        HieuXe: body.HieuXe,
        DongXe: body.DongXe,
        NamSX: body.NamSX,
        DienThoai: body.DienThoai,
        SoKhung: body.SoKhung,
        SoMay: body.SoMay,
        AnPhi: body.AnPhi ?? false,
        TongPhi: body.TongPhi,
        MaMucDichSD: body.MaMucDichSD,
        MayKeo: body.MayKeo ?? false,
        XeChuyenDung: body.XeChuyenDung ?? false,
        XeChoTien: body.XeChoTien ?? false,
        XePickUp: body.XePickUp ?? false,
        XeTaiVan: body.XeTaiVan ?? false,
        XeTapLai: body.XeTapLai ?? false,
        XeBus: body.XeBus ?? false,
        XeCuuThuong: body.XeCuuThuong ?? false,
        Xetaxi: body.Xetaxi ?? false,
        XeDauKeo: body.XeDauKeo ?? false,
      };

      const result = await this.pvi.createOrder(input);

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
  }): CreateOrderResultDto {
    const prKey = tx.pviPrKey != null ? Number(tx.pviPrKey) : null;
    return {
      maGiaodich: tx.maGiaodich,
      Pr_key: prKey != null && Number.isFinite(prKey) ? prKey : null,
      paymentUrl: tx.paymentUrl,
      serialNumber: tx.serialNumber,
    };
  }
}
