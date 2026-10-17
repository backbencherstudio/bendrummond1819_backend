import { ApiProperty } from '@nestjs/swagger';

export class RegistrationMonthDto {
  @ApiProperty({ example: '2026-10' }) month: string;
  @ApiProperty({ example: 'Oct 2026' }) label: string;
  @ApiProperty({ example: 42 }) registrations: number;
}
export class RegistrationChartResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Registration chart retrieved successfully' })
  message: string;
  @ApiProperty({ example: 'UTC' }) timezone: string;
  @ApiProperty({ type: [RegistrationMonthDto] }) data: RegistrationMonthDto[];
}
