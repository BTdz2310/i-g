import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PviClient } from '../pvi/pvi.client';
import { QuoteMotoDto, QuoteMotoResultDto } from './dto/quote-moto.dto';
import { PartnerAuthGuard } from '../partner-auth/partner-auth.guard';
import { ApiPartnerAuth } from '../common/decorators/api-partner-auth.decorator';

@ApiTags('quote-moto')
@ApiPartnerAuth()
@UseGuards(PartnerAuthGuard)
@Controller('api/pvi/moto/quote')
export class QuoteMotoController {
  constructor(private readonly pvi: PviClient) {}

  @Post()
  @ApiOperation({
    summary: 'Tính phí TNDS xe máy',
    description: 'Lấy loai_xe từ /api/pvi/catalog với ten_dmuc=LOAIXEMOTOR, parent_value="1".',
  })
  @ApiBody({ type: QuoteMotoDto })
  @ApiOkResponse({ type: QuoteMotoResultDto })
  getMotoFee(@Body() body: QuoteMotoDto) {
    return this.pvi.getMotoFee({
      ngay_dau: body.ngay_dau,
      ngay_cuoi: body.ngay_cuoi,
      loai_xe: body.loai_xe,
      thamgia_laiphu: body.thamgia_laiphu ?? false,
      muc_trachnhiem_laiphu: body.muc_trachnhiem_laiphu ?? 0,
      so_nguoi_tgia_laiphu: body.so_nguoi_tgia_laiphu ?? 0,
      tyle_phi_laiphu: body.tyle_phi_laiphu ?? 0,
    });
  }
}
