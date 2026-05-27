import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePartnerDto {
  @ApiPropertyOptional({ example: 'Dai ly ABC' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 600,
    description: 'Requests per minute (0 = unlimited)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  rateLimit?: number;

  @ApiPropertyOptional({ type: [String], example: ['1.2.3.4', '5.6.7.8'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}
