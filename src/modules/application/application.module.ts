import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { SetUpModule } from './set-up/set-up.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [NotificationModule, ContactModule, FaqModule, SetUpModule, SubscriptionsModule],
})
export class ApplicationModule {}
