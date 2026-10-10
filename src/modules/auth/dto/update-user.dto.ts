import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEmpty,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// PATCH fields are optional; null and invalid values are rejected.
export class UpdateUserDto {
  // Multipart clients may send an empty image field when no file is selected.
  // Actual files are handled separately by FileInterceptor.
  @Transform(({ value }) =>
    value === '' || value === null || value === 'null' ? undefined : value,
  )
  @IsEmpty({ message: 'image must be an uploaded file or empty' })
  image?: Express.Multer.File | null;

  @ApiPropertyOptional({ example: 'John Doe' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+8801785412308' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  phone_number?: string;

  @ApiPropertyOptional({ example: '1999-12-31' })
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({ strict: true })
  date_of_birth?: string;

  @ApiPropertyOptional({ example: 'Bangladesh' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  country?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  state?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  city?: string;

  @ApiPropertyOptional({ example: '' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: '1200' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  zip_code?: string;

  @ApiPropertyOptional({ example: 'female' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  gender?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'bill remainders' })
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  bill_remainders?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'notification remainder' })
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  notification_remainder?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'email updates' })
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  email_updates?: boolean;
}
