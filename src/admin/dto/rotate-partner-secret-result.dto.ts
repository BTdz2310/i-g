import { ApiProperty } from '@nestjs/swagger';

export class RotatePartnerSecretResultDto {
  @ApiProperty({ example: 'uuid' })
  keyId!: string;

  @ApiProperty({ example: 'secret-hex' })
  secret!: string;
}
