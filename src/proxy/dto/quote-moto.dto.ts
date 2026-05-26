import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QuoteMotoDto {
  @ApiProperty({ description: 'Ngày bắt đầu BH (dd/MM/yyyy HH:mm)', example: '25/05/2026 00:00' })
  @Matches(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/, { message: 'ngay_dau phải có dạng dd/MM/yyyy HH:mm' })
  ngay_dau!: string;

  @ApiProperty({ description: 'Ngày kết thúc BH (dd/MM/yyyy HH:mm)', example: '25/05/2027 00:00' })
  @Matches(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/, { message: 'ngay_cuoi phải có dạng dd/MM/yyyy HH:mm' })
  ngay_cuoi!: string;

  @ApiProperty({ description: 'Loại xe (lấy từ catalog LOAIXEMOTOR, parent_value=1)', example: '1002' })
  @IsString()
  loai_xe!: string;

  @ApiPropertyOptional({ description: 'Tham gia BH lái phụ', default: false })
  @IsOptional() @IsBoolean()
  thamgia_laiphu?: boolean;

  @ApiPropertyOptional({ description: 'Mức trách nhiệm lái phụ (VND)', example: 0, default: 0 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  muc_trachnhiem_laiphu?: number;

  @ApiPropertyOptional({ description: 'Số người tham gia lái phụ', default: 0 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  so_nguoi_tgia_laiphu?: number;

  @ApiPropertyOptional({ description: 'Tỷ lệ phí lái phụ', default: 0 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  tyle_phi_laiphu?: number;
}

export class QuoteMotoResultDto {
  @ApiProperty({ example: '00' }) Status!: string;
  @ApiProperty({ example: 'Thanh cong' }) Message!: string;
  @ApiProperty({ description: 'Phí TNDS xe máy (đã VAT)', example: 66000 }) phi_moto!: number;
  @ApiProperty({ description: 'Phí lái phụ', example: 0 }) phi_laiphu!: number;
  @ApiProperty({ description: 'Tổng phí (VND, đã VAT)', example: 66000 }) TotalFee!: number;
}
