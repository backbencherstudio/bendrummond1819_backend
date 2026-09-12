import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class RegisterUserDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'John Doe',
    description: 'The full name of the user',
  })
  name: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'user@gmail.com',
    description: 'The email address of the user',
  })
  email: string;

  @IsOptional()
  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number',
    required: false,
  })
  phone?: string;

  @IsOptional()
  @ApiProperty({
    example: '1990-01-01',
    description: 'Birth date',
    required: false,
  })
  birthDate?: Date;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  @ApiProperty({
    example: '12345678',
    description: 'Password (min 8 characters)',
  })
  password: string;
}
