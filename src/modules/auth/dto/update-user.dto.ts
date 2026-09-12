import { ApiProperty, PartialType } from '@nestjs/swagger';
import { RegisterUserDto } from './register-user.dto';
import { IsOptional } from 'class-validator';

export class UpdateUserDto extends PartialType(RegisterUserDto) {
  @IsOptional()
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  image?: any;

  @IsOptional()
  @ApiProperty({
    description: 'Country',
    example: 'Nigeria',
  })
  country?: string;

  @IsOptional()
  @ApiProperty({
    description: 'State',
    example: 'Lagos',
  })
  state?: string;

  @IsOptional()
  @ApiProperty({
    description: 'City',
    example: 'Lagos',
  })
  city?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Local government',
    example: 'Lagos',
  })
  local_government?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Zip code',
    example: '123456',
  })
  zip_code?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Phone number',
    example: '+91 9876543210',
  })
  phone_number?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Address',
    example: 'New York, USA',
  })
  address?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Gender',
    example: 'male',
  })
  gender?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Date of birth',
    example: '14/11/2001',
  })
  date_of_birth?: string;
}
