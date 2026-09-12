import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class UpdateSwaggerDto {
  @IsOptional()
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  image?: any;

  @IsOptional()
  @ApiPropertyOptional({
    description: 'Name',
    example: 'John Doe',
  })
  name?: string;

  @IsOptional()
  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+91 9876543210',
  })
  phone_number?: string;

  @IsOptional()
  @ApiPropertyOptional({
    description: 'Date of birth',
    example: '2001-11-14',
  })
  date_of_birth?: string;

  @IsOptional()
  @ApiPropertyOptional({
    description: 'Bill remainders',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  bill_remainders?: boolean;

  @IsOptional()
  @ApiPropertyOptional({
    description: 'Notification remainder',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  notification_remainder?: boolean;
}
