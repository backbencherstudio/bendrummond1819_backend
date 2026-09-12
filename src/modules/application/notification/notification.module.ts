import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { TwilioService } from './twilio.service';

@Global()
@Module({
  providers: [NotificationGateway, NotificationService, TwilioService],
  exports: [NotificationGateway, TwilioService],
})
export class NotificationModule {}
