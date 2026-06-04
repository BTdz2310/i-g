import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { StartNotInPast, resolveGioDau } from './start-not-in-past.validator';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Tên khách hàng mua bảo hiểm',
    example: 'Nguyễn Văn A',
  })
  @IsString()
  @IsNotEmpty()
  TenKH!: string;

  @ApiProperty({
    description: 'Địa chỉ khách hàng',
    example: '123 Lê Lợi, Q.1, TP.HCM',
  })
  @IsString()
  @IsNotEmpty()
  DiaChiKH!: string;

  @ApiPropertyOptional({ description: 'Tên cơ sở đối tác', example: '' })
  @IsOptional()
  @IsString()
  TenTH?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ cơ sở đối tác', example: '' })
  @IsOptional()
  @IsString()
  DiaChiTH?: string;

  @ApiProperty({
    description: 'Tên chủ xe trên giấy đăng ký',
    example: 'Nguyễn Văn A',
  })
  @IsString()
  @IsNotEmpty()
  TenChuXe!: string;

  @ApiProperty({
    description: 'Địa chỉ chủ xe',
    example: '123 Lê Lợi, Q.1, TP.HCM',
  })
  @IsString()
  @IsNotEmpty()
  DiaChiChuXe!: string;

  @ApiProperty({
    description: 'Ngày bắt đầu BH (dd/MM/yyyy)',
    example: '01/06/2026',
  })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'NgayDau phải có dạng dd/MM/yyyy',
  })
  NgayDau!: string;

  @ApiProperty({
    description: 'Ngày kết thúc BH (dd/MM/yyyy)',
    example: '01/06/2027',
  })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'NgayCuoi phải có dạng dd/MM/yyyy',
  })
  NgayCuoi!: string;

  @ApiProperty({ description: 'Giờ bắt đầu BH', example: '00:00' })
  @Transform(({ value, obj }) =>
    typeof value === 'string' && typeof obj?.NgayDau === 'string'
      ? resolveGioDau(obj.NgayDau as string, value)
      : value,
  )
  @Matches(/^\d{2}:\d{2}$/, { message: 'GioDau phải có dạng HH:mm' })
  @StartNotInPast()
  GioDau!: string;

  @ApiProperty({ description: 'Giờ kết thúc BH', example: '23:59' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'GioCuoi phải có dạng HH:mm' })
  GioCuoi!: string;

  @ApiProperty({
    description: 'Email khách hàng (để gửi GCN)',
    example: 'khachhang@email.com',
  })
  @IsString()
  @IsNotEmpty()
  EmailKH!: string;

  @ApiProperty({ description: 'Số điện thoại', example: '0912345678' })
  @IsString()
  @IsNotEmpty()
  DienThoai!: string;

  @ApiProperty({
    description: 'Mã loại xe (lấy từ Get_DanhMuc LOAIXEAUTO)',
    example: '30051',
  })
  @IsString()
  @IsNotEmpty()
  LoaiXe!: string;

  @ApiProperty({
    description: 'Tên loại xe',
    example: '30051 - Xe bán tải không KDVT',
  })
  @IsString()
  @IsNotEmpty()
  TenLoaiXe!: string;

  @ApiProperty({ description: 'Số chỗ ngồi', example: '5' })
  @IsNumberString()
  ChoNgoi!: string;

  @ApiProperty({ description: 'Trọng tải (kg)', example: '0' })
  @IsNumberString()
  TrongTai!: string;

  @ApiProperty({
    description: 'Mã hiệu xe (lấy từ HIEUXEAUTO)',
    example: '099',
  })
  @IsString()
  HieuXe!: string;

  @ApiProperty({
    description: 'Mã dòng xe (lấy từ DONGXE)',
    example: '0990100',
  })
  @IsString()
  DongXe!: string;

  @ApiProperty({ description: 'Biển kiểm soát', example: '51A-12345' })
  @IsString()
  @IsNotEmpty()
  BienKiemSoat!: string;

  @ApiProperty({ description: 'Số khung', example: 'VIN123456789' })
  @IsString()
  @IsNotEmpty()
  SoKhung!: string;

  @ApiProperty({ description: 'Số máy', example: 'ENG123456' })
  @IsString()
  @IsNotEmpty()
  SoMay!: string;

  @ApiProperty({ description: 'Năm sản xuất (MM/yyyy)', example: '01/2022' })
  @IsString()
  @IsNotEmpty()
  NamSX!: string;

  @ApiProperty({ description: 'Năm sử dụng (MM/yyyy)', example: '01/2022' })
  @IsString()
  @IsNotEmpty()
  NamSD!: string;

  @ApiProperty({
    description: 'Phí TNDS bắt buộc (lấy từ /quote)',
    example: '480700',
  })
  @IsNumberString()
  PhiBHTNDSBB!: string;

  @ApiProperty({ description: 'Tổng phí thanh toán', example: '480700' })
  @IsNumberString()
  TongPhi!: string;

  @ApiProperty({
    description: 'Mục đích sử dụng xe',
    enum: ['1', '2', '3'],
    enumName: 'MaMucDichSD',
    examples: {
      '1': { value: '1', summary: '1 — Xe không kinh doanh vận tải' },
      '2': { value: '2', summary: '2 — Xe kinh doanh vận tải' },
      '3': { value: '3', summary: '3 — Xe chở hàng' },
    },
  })
  @IsIn(['1', '2', '3'])
  MaMucDichSD!: string;

  @ApiPropertyOptional({
    description: 'Tham gia BH lái phụ',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  ThamGiaLaiPhu?: boolean;

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsNumberString()
  MTNLaiPhu?: string;
  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsNumberString()
  SoNguoiToiDa?: string;
  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsNumberString()
  PhiBHLaiPhu?: string;

  @ApiPropertyOptional({
    description: 'Ẩn biển kiểm soát trên GCN',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  AnBKS?: boolean;

  @ApiPropertyOptional({ description: 'Ẩn phí trên GCN', default: false })
  @IsOptional()
  @IsBoolean()
  AnPhi?: boolean;

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

  @ApiPropertyOptional({
    description: 'Loại sản phẩm',
    enum: ['AUTO', 'MOTO'],
    default: 'AUTO',
  })
  @IsOptional()
  @IsIn(['AUTO', 'MOTO'])
  productKind?: string;

  @ApiProperty({
    description:
      'Khóa idempotent do đối tác sinh, duy nhất cho mỗi lần khách mua (BẮT BUỘC). ' +
      'Gửi lại cùng key (vd khi retry/timeout) sẽ trả về đúng đơn cũ thay vì tạo đơn mới. ' +
      'Thiếu key → 400.',
    example: 'order-2026-06-03-abc123',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}

export class CreateOrderResultDto {
  @ApiProperty({ example: 'a1b2c3d4-...' }) maGiaodich!: string;
  @ApiProperty({
    description:
      'PVI internal key. null khi replay idempotent một đơn chưa kịp submit sang PVI.',
    example: 123456,
    nullable: true,
  })
  Pr_key!: number | null;
  @ApiProperty({
    description:
      'URL thanh toán PVI — redirect user đến đây để thanh toán. null nếu PVI chưa trả.',
    example: 'https://payment.pvi.com.vn/pay?token=xxx',
    nullable: true,
  })
  paymentUrl!: string | null;
  @ApiProperty({
    description: 'Serial number nháp từ PVI. null nếu chưa có.',
    example: 'SN-2026-001',
    nullable: true,
  })
  serialNumber!: string | null;
}
