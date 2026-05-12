import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PviClient } from '../pvi/pvi.client';
import { QuoteDto, QuoteResultDto } from './dto/quote.dto';
import { FeeInput } from '../pvi/dto/fee.dto';
import { PartnerAuthGuard } from '../partner-auth/partner-auth.guard';
import { ApiPartnerAuth } from '../common/decorators/api-partner-auth.decorator';

@ApiTags('quote')
@ApiPartnerAuth()
@UseGuards(PartnerAuthGuard)
@Controller('api/pvi/quote')
export class QuoteController {
  constructor(private readonly pvi: PviClient) {}

  @Post()
  @ApiOperation({
    summary: 'Tính phí bảo hiểm TNDS',
    description:
      'Tính tổng phí TNDS bắt buộc và lái phụ. Cần lấy ma_loaixe từ /vehicle-type trước.',
  })
  @ApiBody({ type: QuoteDto })
  @ApiOkResponse({
    type: QuoteResultDto,
    description: 'Phí bảo hiểm — TotalFee tính bằng VND',
  })
  getFee(@Body() body: QuoteDto) {
    const input: FeeInput = {
      ma_trongtai: body.ma_trongtai,
      so_cho: body.so_cho,
      ma_mdsd: body.ma_mdsd,
      ma_loaixe: body.ma_loaixe,
      giodau: body.giodau,
      giocuoi: body.giocuoi,
      ngaydau: body.ngaydau,
      ngaycuoi: body.ngaycuoi,
      thamgia_tndsbb: body.thamgia_tndsbb,
      thamgia_laiphu: body.thamgia_laiphu ?? false,
      mtn_laiphu: body.mtn_laiphu ?? 0,
      so_nguoi: body.so_nguoi ?? 0,
      philpx_nhap: body.philpx_nhap ?? 0,
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
    return this.pvi.getFee(input);
  }
}
