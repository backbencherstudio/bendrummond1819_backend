import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class BillingHistoryQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional({ example: 'succeeded' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;
  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  user_id?: string;
  @ApiPropertyOptional({
    description: 'Search reference number, user name, email or phone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;
  @ApiPropertyOptional({
    description:
      'Inclusive ISO date/time (UTC). A date without a time starts at midnight.',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;
  @ApiPropertyOptional({
    description:
      'Exclusive ISO date/time (UTC). Use the next day to include an entire date.',
    example: '2026-11-01',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}
export class BillingUserDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true }) name: string | null;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ type: String, nullable: true }) phone_number: string | null;
}
export class BillingTransactionDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true }) reference_number:
    | string
    | null;
  @ApiProperty({ type: String, nullable: true }) status: string | null;
  @ApiProperty({ type: String, nullable: true }) type: string | null;
  @ApiProperty({ type: String, nullable: true }) provider: string | null;
  @ApiProperty({ type: String, nullable: true, example: '29.99' }) amount:
    | string
    | null;
  @ApiProperty({ type: String, nullable: true }) currency: string | null;
  @ApiProperty({ type: String, nullable: true }) paid_amount: string | null;
  @ApiProperty({ type: String, nullable: true }) paid_currency: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) created_at: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updated_at: Date;
  @ApiProperty({ type: BillingUserDto, nullable: true })
  user: BillingUserDto | null;
}
export class BillingPaginationDto {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}
export class BillingHistoryResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ type: [BillingTransactionDto] }) data: BillingTransactionDto[];
  @ApiProperty({ type: BillingPaginationDto }) pagination: BillingPaginationDto;
}
