import { ApiProperty } from '@nestjs/swagger';

export class LoginResultDto {
  @ApiProperty()
  token!: string;

  @ApiProperty()
  expiresIn!: string;
}
