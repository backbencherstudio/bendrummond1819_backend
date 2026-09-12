import { Controller, Post, Req, Headers } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { TransactionRepository } from '../../../common/repository/transaction/transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';

@Controller('payment/stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private transactionRepository: TransactionRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    try {
      const payload = req.rawBody.toString();
      const event = await this.stripeService.handleWebhook(payload, signature);

      // Handle events
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as any;
          if (
            session.metadata?.app_name === 'Johnaryan' &&
            session.metadata?.type === 'subscription'
          ) {
            const { user_id, plan_id } = session.metadata;

            const plan = await this.prisma.plan.findUnique({
              where: { id: plan_id },
            });

            if (plan) {
              const stripeSubscription: any =
                await StripePayment.getSubscription(
                  session.subscription as string,
                );

              const periodEnd = stripeSubscription?.current_period_end
                ? new Date(stripeSubscription.current_period_end * 1000)
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback to 30 days if null

              await this.prisma.subscription.upsert({
                where: { user_id },
                update: {
                  plan_id,
                  stripe_subscription_id: session.subscription as string,
                  status: 'active',
                  plan_type: plan.type,
                  current_period_end: periodEnd,
                },
                create: {
                  user_id,
                  plan_id,
                  stripe_subscription_id: session.subscription as string,
                  status: 'active',
                  plan_type: plan.type,
                  current_period_end: periodEnd,
                },
              });

              // Record transaction
              await this.prisma.paymentTransaction.create({
                data: {
                  user_id: user_id,
                  type: 'subscription',
                  reference_number: session.id,
                  status: 'succeeded',
                  amount: session.amount_total / 100,
                  currency: session.currency,
                  paid_amount: session.amount_total / 100,
                  paid_currency: session.currency,
                  raw_status: session.status,
                },
              });
            }
          }
          break;

        case 'invoice.payment_succeeded':
          const invoice = event.data.object as any;
          if (invoice.subscription) {
            const existingSub = await this.prisma.subscription.findFirst({
              where: { stripe_subscription_id: invoice.subscription as string },
            });

            if (existingSub) {
              const periodEnd = invoice.lines?.data[0]?.period?.end;
              const currentPeriodEnd = periodEnd
                ? new Date(periodEnd * 1000)
                : new Date();

              await this.prisma.subscription.update({
                where: { id: existingSub.id },
                data: {
                  status: 'active',
                  current_period_end: currentPeriodEnd,
                },
              });

              // Record transaction for renewal
              if (invoice.billing_reason === 'subscription_cycle') {
                await this.prisma.paymentTransaction.create({
                  data: {
                    user_id: existingSub.user_id,
                    type: 'subscription_renewal',
                    reference_number: invoice.id,
                    status: 'succeeded',
                    amount: invoice.amount_paid / 100,
                    currency: invoice.currency,
                    paid_amount: invoice.amount_paid / 100,
                    paid_currency: invoice.currency,
                    raw_status: invoice.status,
                  },
                });
              }
            }
          }
          break;

        case 'customer.subscription.deleted':
          const deletedSub = event.data.object as any;
          await this.prisma.subscription.updateMany({
            where: { stripe_subscription_id: deletedSub.id },
            data: { status: 'canceled' },
          });
          break;

        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as any;
          await this.transactionRepository.updateTransaction({
            reference_number: paymentIntent.id,
            status: 'succeeded',
            paid_amount: paymentIntent.amount / 100,
            paid_currency: paymentIntent.currency,
            raw_status: paymentIntent.status,
          });
          break;

        case 'payment_intent.payment_failed':
          const failedPaymentIntent = event.data.object as any;
          await this.transactionRepository.updateTransaction({
            reference_number: failedPaymentIntent.id,
            status: 'failed',
            raw_status: failedPaymentIntent.status,
          });
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error', error);
      return { received: false };
    }
  }
}
