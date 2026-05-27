import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const CATALOG_KEYS = [
  'LOAIXEAUTO',
  'HIEUXEAUTO',
  'DONGXE',
  'HIEUXEMOTOR',
  'LOAIXEMOTOR',
  'MDSD_AUTO',
  'LOAIHINH_AUTO',
  'DIADIEM_BH',
  'MUCDICH_SD',
  'MAHIEU_RUIRO',
] as const;

export class CatalogQueryDto {
  @ApiProperty({
    description: 'Tên danh mục cần lấy',
    enum: CATALOG_KEYS,
    example: 'LOAIXEAUTO',
  })
  @IsIn(CATALOG_KEYS)
  ten_dmuc!: string;

  @ApiPropertyOptional({
    description:
      'Giá trị cha — dùng khi ten_dmuc=LOAIHINH_AUTO, truyền value của MDSD_AUTO',
    example: '1',
    default: '',
  })
  @IsOptional()
  @IsString()
  parent_value?: string;

  @ApiPropertyOptional({
    description: 'Giá trị được chọn (để pre-filter)',
    example: '',
    default: '',
  })
  @IsOptional()
  @IsString()
  giatri_chon?: string;
}

export class CatalogItemDto {
  @ApiProperty({ example: '3001' })
  Value!: string;

  @ApiProperty({ example: 'Xe con dưới 6 chỗ' })
  Text!: string;
}
