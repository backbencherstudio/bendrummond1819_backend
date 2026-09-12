import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  IncomeType,
  PayFrequency,
  CommitmentType,
} from 'prisma/generated/enums';

export class IncomeDto {
  @ApiProperty({ enum: IncomeType })
  @IsEnum(IncomeType)
  income_type: IncomeType;

  @ApiProperty({ enum: PayFrequency })
  @IsEnum(PayFrequency)
  pay_frequency: PayFrequency;

  @ApiProperty({ example: 1000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  base_income?: number;
}

export class FinancialCommitmentDto {
  @ApiProperty({ enum: CommitmentType })
  @IsEnum(CommitmentType)
  category: CommitmentType;

  @ApiProperty({ example: 'Rent' })
  @IsString()
  name: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  due_day?: number;

  @ApiProperty({ enum: PayFrequency })
  @IsEnum(PayFrequency)
  frequency: PayFrequency;

  @ApiProperty({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;
}

export class SavingsGoalDto {
  @ApiProperty({ example: 'Emergency Fund' })
  @IsString()
  goal_name: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @Min(0)
  target_amount: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  contribution: number;

  @ApiProperty({ enum: PayFrequency })
  @IsEnum(PayFrequency)
  frequency: PayFrequency;
}

export class CreateSetUpDto {
  @ApiProperty({ type: [IncomeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncomeDto)
  incomes: IncomeDto[];

  @ApiProperty({ type: [FinancialCommitmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinancialCommitmentDto)
  financialCommitments: FinancialCommitmentDto[];

  @ApiProperty({ type: [SavingsGoalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavingsGoalDto)
  savingsGoals: SavingsGoalDto[];
}

export class UpdateFinancialCommitmentDto extends PartialType(
  FinancialCommitmentDto,
) {}
export class UpdateSavingsGoalDto extends PartialType(SavingsGoalDto) {}
export class UpdateIncomeDto extends PartialType(IncomeDto) {}
