import { Module } from '@nestjs/common';
import { BillingHistoryController } from './billing-history.controller';
import { PaymentTransactionService } from './payment-transaction.service';
import { PaymentTransactionController } from './payment-transaction.controller';

@Module({
  controllers: [PaymentTransactionController, BillingHistoryController],
  providers: [PaymentTransactionService],
})
export class PaymentTransactionModule {}
