import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class RotatePartnerSecretDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  revokeOld?: boolean;
}
