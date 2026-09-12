import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @IsNotEmpty()
  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @IsNotEmpty()
  @ApiProperty({ example: '123456' })
  token: string;
}
