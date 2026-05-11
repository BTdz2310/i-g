import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuoteDto {
  @ApiProperty({
    description: 'Mã trọng tải (lấy từ GetMaLoaiXe)',
    example: '',
  })
  @IsString()
  ma_trongtai!: string;

  @ApiProperty({ description: 'Số chỗ ngồi', example: 5 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  so_cho!: number;

  @ApiProperty({ description: 'Mã mục đích sử dụng', example: '1' })
  @IsString()
  ma_mdsd!: string;

  @ApiProperty({
    description: 'Mã loại xe (lấy từ GetMaLoaiXe)',
    example: '3001',
  })
  @IsString()
  ma_loaixe!: string;

  @ApiProperty({ description: 'Giờ bắt đầu bảo hiểm', example: '00:00' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'giodau phải có dạng HH:mm' })
  giodau!: string;

  @ApiProperty({ description: 'Giờ kết thúc bảo hiểm', example: '23:59' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'giocuoi phải có dạng HH:mm' })
  giocuoi!: string;

  @ApiProperty({
    description: 'Ngày bắt đầu (dd/MM/yyyy)',
    example: '01/06/2026',
  })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'ngaydau phải có dạng dd/MM/yyyy',
  })
  ngaydau!: string;

  @ApiProperty({
    description:
      'Ngày kết thúc (dd/MM/yyyy) - ngày bắt đầu cộng thời hạn (1, 2 năm...)',
    example: '01/06/2027',
  })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'ngaycuoi phải có dạng dd/MM/yyyy',
  })
  ngaycuoi!: string;

  @ApiProperty({
    description: 'Tham gia BH trách nhiệm dân sự bắt buộc',
    example: true,
  })
  @IsBoolean()
  thamgia_tndsbb!: boolean;

  @ApiPropertyOptional({
    description: 'Tham gia BH lái phụ',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  thamgia_laiphu?: boolean;

  @ApiPropertyOptional({
    description: 'Mức trách nhiệm lái phụ',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  mtn_laiphu?: number;

  @ApiPropertyOptional({
    description: 'Số người tối đa',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  so_nguoi?: number;

  @ApiPropertyOptional({
    description: 'Phí lái phụ nhập tay',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  philpx_nhap?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  MayKeo?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  XeChuyenDung?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  XeChoTien?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  XePickUp?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  XeTaiVan?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  XeTapLai?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  XeBus?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  XeCuuThuong?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  Xetaxi?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  XeDauKeo?: boolean;
}

export class QuoteResultDto {
  @ApiProperty({ example: '00' }) Status!: string;
  @ApiProperty({ example: 'Thanh cong' }) Message!: string;
  @ApiProperty({ description: 'Tổng phí (VND)', example: '480700' })
  TotalFee!: string;
  @ApiProperty({ description: 'Phí TNDS bắt buộc', example: '480700' })
  phi_tndsbb!: string;
  @ApiPropertyOptional({ description: 'Phí lái phụ' }) phi_lpx?: string;
  @ApiProperty({ example: '3001' }) ma_loaixe!: string;
}
