import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PviClient } from '../pvi/pvi.client';
import { CategoryInput } from '../pvi/dto/category.dto';
import { CatalogItemDto, CatalogQueryDto } from './dto/catalog-query.dto';
import { PartnerAuthGuard } from '../partner-auth/partner-auth.guard';
import { ApiPartnerAuth } from '../common/decorators/api-partner-auth.decorator';

@ApiTags('catalog')
@ApiPartnerAuth()
@UseGuards(PartnerAuthGuard)
@Controller('api/pvi/catalog')
export class CatalogController {
  constructor(private readonly pvi: PviClient) {}

  @Post()
  @ApiOperation({
    summary: 'Lấy danh mục PVI',
    description: 'Tra cứu danh sách loại xe, hãng xe, dòng xe, mục đích sử dụng... Dùng để điền dropdown form.',
  })
  @ApiBody({ type: CatalogQueryDto })
  @ApiOkResponse({ type: [CatalogItemDto], description: 'Danh sách { Value, Text }' })
  getCategory(@Body() body: CatalogQueryDto) {
    const input: CategoryInput = {
      parent_value: body.parent_value ?? '',
      ten_dmuc: body.ten_dmuc,
      ma_user: '',
      ma_donvi: '34',
      giatri_chon: body.giatri_chon ?? '',
    };
    return this.pvi.getCategory(input);
  }
}
