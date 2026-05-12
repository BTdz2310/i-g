import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({ example: 'Dai ly ABC' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'partner-abc' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ example: 600, description: 'Requests per minute (0 = unlimited)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rateLimit?: number;

  @ApiPropertyOptional({ type: [String], example: ['1.2.3.4'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}
