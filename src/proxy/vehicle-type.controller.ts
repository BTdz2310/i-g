import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PviClient } from '../pvi/pvi.client';
import { VehicleTypeItemDto, VehicleTypeQueryDto } from './dto/vehicle-type-query.dto';

@ApiTags('catalog')
@Controller('api/pvi/vehicle-type')
export class VehicleTypeController {
  constructor(private readonly pvi: PviClient) {}

  @Post()
  @ApiOperation({
    summary: 'Lấy mã loại xe',
    description: 'Tra cứu mã loại xe theo số chỗ, trọng tải, mục đích sử dụng. Kết quả dùng làm ma_loaixe khi tính phí.',
  })
  @ApiBody({ type: VehicleTypeQueryDto })
  @ApiOkResponse({ type: [VehicleTypeItemDto], description: 'Danh sách mã loại xe { Value, Text }' })
  getVehicleType(@Body() body: VehicleTypeQueryDto) {
    return this.pvi.getVehicleType({
      SoChoNgoi: body.SoChoNgoi,
      Ma_MDSD: body.Ma_MDSD,
      TrongTai: body.TrongTai,
      LoaiHinh: body.LoaiHinh ?? '',
    });
  }
}
