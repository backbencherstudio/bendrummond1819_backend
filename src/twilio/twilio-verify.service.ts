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
    try {
      const verification =
        await this.client.verify.v2
          .services(this.serviceSid)
          .verifications.create({
            to: phoneNumber,
            channel: 'sms',
          });

      this.logger.log(
        `Twilio verification created: sid=${verification.sid}, status=${verification.status}`,
      );

      return {
        success: true,
        sid: verification.sid,
        status: verification.status,
        to: verification.to,
      };
    } catch (error: unknown) {
      this.handleTwilioError(
        error,
        'send verification code',
      );
    }
  }

  async verifySms(
    phoneNumber: string,
    code: string,
  ) {
    if (!code?.trim()) {
      throw new BadRequestException(
        'Verification code is required',
      );
    }

    try {
      const verificationCheck =
        await this.client.verify.v2
          .services(this.serviceSid)
          .verificationChecks.create({
            to: phoneNumber,
            code: code.trim(),
          });

      const approved =
        verificationCheck.status === 'approved';

      this.logger.log(
        `Twilio verification check: status=${verificationCheck.status}`,
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
      `Twilio failed to ${operation}`,
      JSON.stringify({
        message: err.message,
        code: err.code,
        status: err.status,
        moreInfo: err.moreInfo,
      }),
    );

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

    if (
      err.status === 400 ||
      err.status === 404
    ) {
      throw new BadRequestException({
        success: false,
        message:
          operation === 'verify verification code'
            ? 'Invalid or expired verification code'
            : 'Unable to send verification code to this phone number',
        code: 'OTP_REQUEST_INVALID',
      });
    }

    throw new InternalServerErrorException({
      success: false,
      message:
        'Phone verification service is temporarily unavailable',
      code: 'OTP_PROVIDER_ERROR',
    });
  }
}