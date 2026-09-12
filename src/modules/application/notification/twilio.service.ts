import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: Twilio;
  private readonly messagingServiceSid: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.messagingServiceSid = this.configService.get<string>(
      'TWILIO_MESSAGING_SERVICE_SID',
    );

    if (accountSid && authToken) {
      this.client = new Twilio(accountSid, authToken);
    } else {
      this.logger.error('Twilio credentials are missing in .env');
    }
  }

  async sendSms(to: string, message: string) {
    if (!this.client) {
      this.logger.error('Twilio client is not initialized');
      return;
    }

    try {
      const response = await this.client.messages.create({
        body: message,
        to: to,
        messagingServiceSid: this.messagingServiceSid,
      });
      this.logger.log(`SMS sent successfully to ${to}: ${response.sid}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
      throw error;
    }
  }
}
