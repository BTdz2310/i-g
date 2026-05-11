import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class VehicleTypeQueryDto {
  @ApiProperty({ description: 'Số chỗ ngồi', example: 5 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  SoChoNgoi!: number;

  @ApiProperty({ description: 'Mã mục đích sử dụng (lấy từ MDSD_AUTO)', example: '1' })
  @IsIn(['1', '2', '3'])
  Ma_MDSD!: string;

  @ApiProperty({ description: 'Trọng tải (kg), xe con để 0', example: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  TrongTai!: number;

  @ApiPropertyOptional({ description: 'Loại hình — để trống', default: '' })
  @IsOptional()
  @IsString()
  LoaiHinh?: string;
}

export class VehicleTypeItemDto {
  @ApiProperty({ example: '30051' })
  Value!: string;

  @ApiProperty({ example: '30051 - Xe bán tải không KDVT' })
  Text!: string;
}
