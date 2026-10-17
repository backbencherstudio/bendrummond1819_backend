import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsEmail, 
  IsNotEmpty, 
  IsString, 
  MinLength,
  Matches,
  MaxLength,
  ValidateIf,
 } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description:
      'Phone number in international E.164 format',
    example: '+8801844467018',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Phone number must be in valid international format, for example +8801844467018',
  })
  phone: string;

  @ApiProperty({
    description: 'User password',
    example: '12345678',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token obtained during login',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

export class ForgotPasswordDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'Send exactly one of email or phone. Email receives a password reset OTP.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+8801844467018', description: 'Send exactly one of email or phone. Phone retains the existing SMS OTP flow.' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone?: string;
}

export class ResendVerificationEmailDto {
  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description:
      'Password reset token returned after OTP verification',
  })
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  @ApiProperty({
    example: 'NewPassword123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'oldpassword123',
  })
  @IsString()
  @IsNotEmpty()
  old_password: string;

  @ApiProperty({
    description: 'New password',
    example: 'newpassword123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  new_password: string;
}

export class VerifyPhoneOtpDto {
  @ApiProperty({
    example: 'cmujkwu9d0001y6antp2wv5wd',
    description: 'User ID returned after registration',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP sent to the user phone number',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: 'OTP must be exactly 6 digits',
  })
  code: string;
}

export class ResendPhoneOtpDto {
  @ApiProperty({
    example: 'cmuz67o6i00008zm953rv5gpt',
    description:
      'User ID returned after registration',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  userId: string;
}

export class VerifyForgotPasswordOtpDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'For email reset, use the same email as forgot-password. Send exactly one of email or userId.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'For phone reset, use the userId returned by forgot-password. Send exactly one of email or userId.' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  userId?: string;

  @ApiProperty({ example: '123456', description: 'Six-digit OTP received by email or SMS' })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class PasswordResetRequestDataDto {
  @ApiPropertyOptional({ description: 'Returned only for an existing account in the phone flow' }) userId?: string;
  @ApiProperty({ example: 30 }) resendAvailableIn: number;
  @ApiPropertyOptional({ example: 600, description: 'Email OTP validity in seconds' }) expiresIn?: number;
  @ApiPropertyOptional({ example: 'email' }) channel?: string;
}
export class PasswordResetRequestResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty() message: string;
  @ApiPropertyOptional({ example: 'VERIFY_FORGOT_PASSWORD_OTP' }) nextStep?: string;
  @ApiPropertyOptional({ type: PasswordResetRequestDataDto }) data?: PasswordResetRequestDataDto;
}
export class PasswordResetTokenDataDto {
  @ApiProperty({ description: 'Use this short-lived token as resetToken in POST /api/auth/reset-password' }) resetToken: string;
}
export class PasswordResetVerificationResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty() message: string;
  @ApiProperty({ example: 'RESET_PASSWORD' }) nextStep: string;
  @ApiProperty({ type: PasswordResetTokenDataDto }) data: PasswordResetTokenDataDto;
}
