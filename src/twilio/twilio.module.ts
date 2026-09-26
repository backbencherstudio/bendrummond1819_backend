import { Module } from '@nestjs/common';
import { TwilioVerifyService } from './twilio-verify.service';

@Module({
  providers: [TwilioVerifyService],
  exports: [TwilioVerifyService],
})
export class TwilioModule {}