import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PviClient } from '../pvi/pvi.client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderInput } from '../pvi/dto/create-order.dto';
import { CreateOrderDto, CreateOrderResultDto } from './dto/create-order.dto';
import { randomUUID } from 'crypto';

@ApiTags('order')
@Controller('api/pvi/order')
export class OrderController {
  constructor(
    private readonly pvi: PviClient,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Tạo đơn bảo hiểm TNDS',
    description: 'Gateway tự sinh ma_giaodich (UUID) và trả về. Đơn được gửi sang PVI — GCN sẽ về qua callback hoặc poll GET /order/:maGiaodich.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({ type: CreateOrderResultDto, description: 'maGiaodich để track đơn + Pr_key nội bộ PVI' })
  async createOrder(@Body() body: CreateOrderDto) {
    const maGiaodich = randomUUID();
    const productKind = body.productKind ?? 'AUTO';

    const tx = await this.prisma.transaction.create({
      data: {
        maGiaodich,
        productKind,
        status: 'SUBMITTING',
        inboundPayload: body as object,
      },
    });

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
          pviResponse: result as object,
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
}
