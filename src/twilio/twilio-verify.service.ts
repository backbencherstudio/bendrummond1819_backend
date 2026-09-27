import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

@Injectable()
export class TwilioVerifyService {
  private readonly client: Twilio.Twilio;
  private readonly serviceSid: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.getOrThrow<string>(
      'TWILIO_ACCOUNT_SID',
    );

    const authToken = this.configService.getOrThrow<string>(
      'TWILIO_AUTH_TOKEN',
    );

    this.serviceSid = this.configService.getOrThrow<string>(
      'TWILIO_VERIFY_SERVICE_SID',
    );

    this.client = Twilio(accountSid, authToken);
  }

  /**
   * Send OTP through Twilio Verify
   */
  async sendSms(phoneNumber: string) {
    try {
      const verification = await this.client.verify.v2
        .services(this.serviceSid)
        .verifications.create({
          to: phoneNumber,
          channel: 'sms',
        });

      console.log('Twilio verification created:', {
        sid: verification.sid,
        status: verification.status,
        to: verification.to,
        channel: verification.channel,
      });

      return {
        success: true,
        sid: verification.sid,
        status: verification.status,
        to: verification.to,
      };
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        code?: number | string;
        status?: number;
        moreInfo?: string;
      };

      console.error('Twilio Verify send error:', {
        message: err.message,
        code: err.code,
        status: err.status,
        moreInfo: err.moreInfo,
      });

      throw new InternalServerErrorException({
        message: 'Failed to send verification code',
        error: err.message ?? 'Unknown Twilio error',
        code: err.code,
      });
    }
  }

  /**
   * Verify OTP submitted by the user
   */
  async verifySms(
    phoneNumber: string,
    code: string,
  ) {
    try {
      const verificationCheck =
        await this.client.verify.v2
          .services(this.serviceSid)
          .verificationChecks.create({
            to: phoneNumber,
            code,
          });

      const success =
        verificationCheck.status === 'approved';

      console.log('Twilio verification check:', {
        status: verificationCheck.status,
        to: phoneNumber,
      });

      return {
        success,
        status: verificationCheck.status,
      };
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        code?: number | string;
        status?: number;
        moreInfo?: string;
      };

      console.error('Twilio Verify check error:', {
        message: err.message,
        code: err.code,
        status: err.status,
        moreInfo: err.moreInfo,
      });

      throw new InternalServerErrorException({
        message: 'Failed to verify verification code',
        error: err.message ?? 'Unknown Twilio error',
        code: err.code,
      });
    }
  }
}