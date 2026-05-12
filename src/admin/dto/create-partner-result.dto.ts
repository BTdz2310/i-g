import { ApiProperty } from '@nestjs/swagger';

export class CreatePartnerResultDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'partner-abc' })
  clientId!: string;

  @ApiProperty({ example: 'uuid' })
  keyId!: string;

  @ApiProperty({ example: 'secret-hex' })
  secret!: string;
}
