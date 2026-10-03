import { ApiProperty } from '@nestjs/swagger';
import { 
  IsNotEmpty, 
  IsOptional, 
  MinLength,
  IsString,
  Length,
  Matches,
 } from 'class-validator';

import type { CountryCode } from 'libphonenumber-js';

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
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be a valid ISO 3166-1 alpha-2 country code',
  })
  @ApiProperty({
    example: 'US',
    description:
      'ISO 3166-1 alpha-2 country code used to parse the phone number',
    required: false,
  })
  countryCode?: CountryCode;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: '4155552671',
    description: 'Phone number',
  })
  phone: string;

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
