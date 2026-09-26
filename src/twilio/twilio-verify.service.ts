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
    const accountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID');

    const authToken =
      this.configService.get<string>('TWILIO_AUTH_TOKEN');

    this.serviceSid =
      this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID');

    if (!accountSid || !authToken || !this.serviceSid) {
      throw new Error('Twilio configuration is missing');
    }

    this.client = Twilio(accountSid, authToken);
  }

  async sendSms(phoneNumber: string) {
    try {
      const verification = await this.client.verify.v2
        .services(this.serviceSid)
        .verifications.create({
          to: phoneNumber,
          channel: 'sms',
        });

      return {
        success: true,
        sid: verification.sid,
        status: verification.status,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to send verification code',
      );
    }
  }

  async verifySms(phoneNumber: string, code: string) {
    try {
      const verificationCheck = await this.client.verify.v2
        .services(this.serviceSid)
        .verificationChecks.create({
          to: phoneNumber,
          code,
        });

      return {
        success: verificationCheck.status === 'approved',
        status: verificationCheck.status,
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
      };
    }
  }
}