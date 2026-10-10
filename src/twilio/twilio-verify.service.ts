import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

@Injectable()
export class TwilioVerifyService {
  private readonly logger =
    new Logger(TwilioVerifyService.name);

  private readonly client: Twilio.Twilio;
  private readonly serviceSid: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const accountSid =
      this.configService.getOrThrow<string>(
        'twilio.accountSid',
      );

    const apiKey =
      this.configService.getOrThrow<string>(
        'twilio.apiKey',
      );

    const apiSecret =
      this.configService.getOrThrow<string>(
        'twilio.apiSecret',
      );

    this.serviceSid =
      this.configService.getOrThrow<string>(
        'twilio.verifyServiceSid',
      );

    if (!accountSid.startsWith('AC')) {
      throw new Error(
        'Invalid TWILIO_ACCOUNT_SID. It must start with AC.',
      );
    }

    if (!apiKey.startsWith('SK')) {
      throw new Error(
        'Invalid TWILIO_API_KEY. It must start with SK.',
      );
    }

    if (!this.serviceSid.startsWith('VA')) {
      throw new Error(
        'Invalid TWILIO_VERIFY_SERVICE_SID. It must start with VA.',
      );
    }

    this.client = Twilio(apiKey, apiSecret, {
      accountSid,
    });
  }

  async sendSms(phoneNumber: string) {
    const maskedPhone =
      this.maskPhoneNumber(phoneNumber);

    this.logger.log(
      `[OTP_SEND_START] to=${maskedPhone} service=${this.maskSid(this.serviceSid)}`,
    );

    try {
      const verification =
        await this.client.verify.v2
          .services(this.serviceSid)
          .verifications.create({
            to: phoneNumber,
            channel: 'sms',
          });

      this.logger.log(
        `[OTP_SEND_ACCEPTED] ${JSON.stringify({
          verificationSid: verification.sid,
          status: verification.status,
          to: maskedPhone,
          channel: verification.channel,
        })}`,
      );

      return {
        success: true,
        sid: verification.sid,
        status: verification.status,
        to: verification.to,
      };
    } catch (error: unknown) {
      const err = error as {
        status?: number;
        code?: number;
        message?: string;
        moreInfo?: string;
      };

      this.logger.error(
        `[OTP_SEND_REJECTED] ${JSON.stringify({
          to: maskedPhone,
          httpStatus: err.status,
          twilioCode: err.code,
          message: err.message,
          moreInfo: err.moreInfo,
        })}`,
      );

      this.handleTwilioError(
        error,
        'send verification code',
      );
    }
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 7) {
      return '***';
    }

    return `${phone.slice(0, 4)}*****${phone.slice(-3)}`;
  }

  private maskSid(sid: string): string {
    if (!sid || sid.length < 8) {
      return '***';
    }

    return `${sid.slice(0, 4)}...${sid.slice(-4)}`;
  }

  async verifySms(
    phoneNumber: string,
    code: string,
  ): Promise<{
    success: boolean;
    status: string;
  }> {
    const normalizedCode = code?.trim();

    if (!normalizedCode) {
      throw new BadRequestException({
        success: false,
        message: 'Verification code is required',
        code: 'OTP_REQUIRED',
      });
    }

    this.logger.log(
      `[OTP_VERIFY_START] phone=${this.maskPhoneNumber(
        phoneNumber,
      )}`,
    );

    try {
      const verificationCheck =
        await this.client.verify.v2
          .services(this.serviceSid)
          .verificationChecks.create({
            to: phoneNumber,
            code: normalizedCode,
          });

      const approved =
        verificationCheck.status === 'approved';

      this.logger.log(
        `[OTP_VERIFY_RESULT] ${JSON.stringify({
          phone:
            this.maskPhoneNumber(phoneNumber),
          status: verificationCheck.status,
          approved,
        })}`,
      );

      return {
        success: approved,
        status: verificationCheck.status,
      };
    } catch (error: unknown) {
      this.handleTwilioError(
        error,
        'verify verification code',
      );
    }
  }

  private handleTwilioError(
    error: unknown,
    operation: string,
  ): never {
    const err = error as {
      message?: string;
      code?: number;
      status?: number;
      moreInfo?: string;
    };

    this.logger.error(
      `[TWILIO_ERROR] ${JSON.stringify({
        operation,
        httpStatus: err.status,
        twilioCode: err.code,
        message: err.message,
        moreInfo: err.moreInfo,
      })}`,
    );

    if (err.code === 60605) {
      throw new HttpException(
        {
          success: false,
          message:
            'This destination country is disabled in Twilio Verify Geo Permissions.',
          code: 'OTP_GEO_BLOCKED',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    if (err.code === 60410) {
      throw new HttpException(
        {
          success: false,
          message:
            'Verification request was blocked by the verification provider.',
          code: 'OTP_FRAUD_BLOCKED',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    if (err.code === 60200) {
      throw new BadRequestException({
        success: false,
        message:
          'Invalid verification request.',
        code: 'OTP_INVALID_PARAMETER',
      });
    }

    if (err.code === 60202) {
      throw new HttpException(
        {
          success: false,
          message:
            'Maximum OTP verification attempts reached. Please request a new code.',
          code: 'OTP_MAX_CHECK_ATTEMPTS',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (err.code === 60203) {
      throw new HttpException(
        {
          success: false,
          message:
            'Maximum OTP send attempts reached. Please try again later.',
          code: 'OTP_MAX_SEND_ATTEMPTS',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (err.code === 60212) {
      throw new HttpException(
        {
          success: false,
          message:
            'Too many verification requests. Please try again later.',
          code: 'OTP_CONCURRENT_LIMIT',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (err.code === 60223) {
      throw new BadRequestException({
        success: false,
        message:
          'SMS verification is disabled for this verification service.',
        code: 'OTP_CHANNEL_DISABLED',
      });
    }

    if (err.status === 401) {
      throw new InternalServerErrorException({
        success: false,
        message:
          'Phone verification provider authentication failed.',
        code: 'OTP_PROVIDER_AUTH_ERROR',
      });
    }

    if (err.status === 404) {
      if (
        operation === 'verify verification code'
      ) {
        throw new BadRequestException({
          success: false,
          message:
            'Verification code is invalid, expired, or no longer active. Please request a new code.',
          code: 'OTP_EXPIRED_OR_INVALID',
        });
      }

      throw new InternalServerErrorException({
        success: false,
        message:
          'Phone verification service configuration could not be found.',
        code: 'OTP_SERVICE_NOT_FOUND',
      });
    }

    if (err.status === 429) {
      throw new HttpException(
        {
          success: false,
          message:
            'Too many verification attempts. Please try again later.',
          code: 'OTP_RATE_LIMITED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new InternalServerErrorException({
      success: false,
      message:
        'Phone verification service is temporarily unavailable.',
      code: 'OTP_PROVIDER_ERROR',
    });
  }
}