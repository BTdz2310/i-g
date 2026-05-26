import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderMotoDto {
  @ApiProperty({ example: 'NGUYEN VAN A' }) @IsString() @IsNotEmpty()
  ten_nguoimua_bh!: string;

  @ApiProperty({ example: '123 Le Loi, Q1, TP.HCM' }) @IsString() @IsNotEmpty()
  diachi_nguoimua_bh!: string;

  @ApiProperty({ example: '25/05/2026 00:00' })
  @Matches(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
  ngay_dau!: string;

  @ApiProperty({ example: '25/05/2027 00:00' })
  @Matches(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
  ngay_cuoi!: string;

  @ApiProperty({ example: '60B131095' }) @IsString() @IsNotEmpty()
  bien_kiemsoat!: string;

  @ApiPropertyOptional({ example: 'S1E8A H039727' }) @IsOptional() @IsString()
  so_may?: string;

  @ApiPropertyOptional({ example: '0AHBH 039727' }) @IsOptional() @IsString()
  so_khung?: string;

  @ApiProperty({ description: 'Mã loại xe (catalog LOAIXEMOTOR)', example: '1002' })
  @IsString() @IsNotEmpty()
  loai_xe!: string;

  @ApiProperty({ description: 'Mã nhãn hiệu (catalog HIEUXEMOTOR)', example: '270' })
  @IsString() @IsNotEmpty()
  nhan_hieu!: string;

  @ApiProperty({ example: '2022' }) @IsString() @IsNotEmpty()
  nam_sanxuat!: string;

  @ApiProperty({ example: 'NGUYEN VAN A' }) @IsString() @IsNotEmpty()
  ten_chuxe!: string;

  @ApiProperty({ example: 'abc@pvi.com.vn' }) @IsString() @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '0984221111' }) @IsString() @IsNotEmpty()
  so_dienthoai!: string;

  @ApiProperty({ example: '123 Le Loi, Q1, TP.HCM' }) @IsString() @IsNotEmpty()
  dia_chi!: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  thamgia_laiphu?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  muc_trachnhiem_laiphu?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  so_nguoi_tgia_laiphu?: number;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  an_bien_ks?: boolean;
}

export class CreateOrderMotoResultDto {
  @ApiProperty() maGiaodich!: string;
  @ApiProperty({ example: 136452 }) Pr_key!: number;
  @ApiProperty({ example: null, nullable: true }) paymentUrl!: string | null;
  @ApiProperty({ example: null, nullable: true }) serialNumber!: string | null;
}
