import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { TwilioService } from '../notification/twilio.service';
import { PayFrequency } from 'prisma/generated/enums';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioService: TwilioService,
  ) {}

  /**
   * Cron job to check for expired subscriptions every hour.
   * Updates status to 'expired' if current_period_end has passed.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleSubscriptionExpiration() {
    this.logger.log('Running Subscription Expiration Cron Job...');

    try {
      const now = new Date();

      // Find and update active subscriptions that have passed their end date
      const expiredCount = await this.prisma.subscription.updateMany({
        where: {
          status: 'active',
          current_period_end: {
            lt: now,
          },
        },
        data: {
          status: 'expired',
        },
      });

      if (expiredCount.count > 0) {
        this.logger.log(
          `Successfully expired ${expiredCount.count} subscriptions.`,
        );
      } else {
        this.logger.log('No expired subscriptions found.');
      }
    } catch (error) {
      this.logger.error(
        'Failed to process subscription expiration cron:',
        error.message,
      );
    }
  }

  /**
   * Cron job to send payment reminders daily.
   * Checks for FinancialCommitments due today based on frequency and due_day.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handlePaymentReminder() {
    this.logger.log('Running Payment Reminder Cron Job...');

    try {
      const now = new Date();
      const currentDayOfMonth = now.getDate();
      const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1 (Mon) - 7 (Sun)

      // Get commitments that are recurring and have a due_day
      const commitments = await this.prisma.financialCommitment.findMany({
        where: {
          is_recurring: true,
          deleted_at: null,
          due_day: { not: null },
          user: {
            phone_number: { not: null },
            bill_remainders: true, // Only send if user enabled bill remainders
          },
        },
        include: {
          user: true,
        },
      });

      this.logger.log(`Checking ${commitments.length} potential commitments...`);

      for (const commitment of commitments) {
        let isDueToday = false;

        if (commitment.frequency === PayFrequency.MONTHLY) {
          if (commitment.due_day === currentDayOfMonth) {
            isDueToday = true;
          }
        } else if (commitment.frequency === PayFrequency.WEEKLY) {
          if (commitment.due_day === currentDayOfWeek) {
            isDueToday = true;
          }
        }

        if (isDueToday) {
          const message = `Reminder: Your ${commitment.name} payment of $${Number(commitment.amount)} is due today.`;
          try {
            await this.twilioService.sendSms(
              commitment.user.phone_number,
              message,
            );
            this.logger.log(
              `Payment reminder sent to ${commitment.user.name} (${commitment.user.phone_number}) for ${commitment.name}`,
            );
          } catch (smsError) {
            this.logger.error(
              `Failed to send SMS to ${commitment.user.phone_number}: ${smsError.message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to process payment reminder cron:', error.stack);
    }
  }
}
