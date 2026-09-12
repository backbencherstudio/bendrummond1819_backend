import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

// Define the enum manually if it's not exported by your Prisma setup easily
export enum PlanType {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class CreateSubscriptionPlanDto {
  @ApiProperty({
    example: 'Basic Plan',
    description: 'The name of the subscription plan',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    enum: PlanType,
    example: PlanType.MONTHLY,
    description: 'The type of the plan',
    default: PlanType.MONTHLY,
  })
  @IsEnum(PlanType)
  type: PlanType;

  @ApiProperty({
    example: 29.99,
    description: 'The price of the plan',
  })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiPropertyOptional({
    enum: PlanType,
    example: PlanType.MONTHLY,
    description: 'The billing period of the plan',
    default: PlanType.MONTHLY,
  })
  @IsEnum(PlanType)
  billing_period: PlanType;

  @ApiPropertyOptional({
    type: [String],
    example: ['Feature 1', 'Feature 2'],
    description: 'List of benefits included in the plan',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  benefits?: string[];
}
