import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import { PlanType } from 'prisma/generated/enums';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}
  async findAllPlans(type?: PlanType) {
    try {
      const plans = await this.prisma.plan.findMany({
        where: {
          deleted_at: null,
          ...(type && { type }),
        },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          price: true,
          billing_period: true,
          benefits: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!plans) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      return {
        success: true,
        message: 'Subscription plans retrieved successfully',
        data: plans,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve subscription plans: ' + error.message,
      };
    }
  }

  async findOnePlan(id: string) {
    try {
      const plan = await this.prisma.plan.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          type: true,
          price: true,
          billing_period: true,
          benefits: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!plan) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      return {
        success: true,
        message: 'Subscription plan retrieved successfully',
        data: plan,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve subscription plan: ' + error.message,
      };
    }
  }

  async buySubscription(id: string, user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (user.approved_at == null) {
        throw new NotFoundException('User not approved');
      }
      const plan = await this.prisma.plan.findUnique({
        where: { id },
      });

      if (!plan) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      if (!plan.stripe_product_id || !plan.stripe_price_id) {
        return {
          success: false,
          message: 'Plan is not configured with Stripe',
        };
      }

      const dbUser = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      let customerId = dbUser.billing_id;
      if (!customerId) {
        const customer = await StripePayment.createCustomer({
          user_id: dbUser.id,
          name:
            dbUser.name ||
            `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() ||
            'Customer',
          email: dbUser.email,
        });
        customerId = customer.id;
        await this.prisma.user.update({
          where: { id: user_id },
          data: { billing_id: customerId },
        });
      }

      const metadata = {
        user_id: user_id,
        plan_id: plan.id,
        type: 'subscription',
        app_name: 'Johnaryan',
      };

      // Both MONTHLY and YEARLY are recurring plans in this model
      const session = await StripePayment.createCheckoutSessionSubscription(
        customerId,
        plan.stripe_price_id,
        metadata,
      );

      return {
        success: true,
        message: 'Subscription session created successfully',
        data: {
          url: session.url,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create subscription session: ' + error.message,
      };
    }
  }

  async allBilingHistory(user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (user.approved_at == null) {
        throw new NotFoundException('User not approved');
      }
      const billingHistory = await this.prisma.paymentTransaction.findMany({
        where: { user_id },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!billingHistory) {
        throw new NotFoundException(`Billing history not found`);
      }

      return {
        success: true,
        message: 'Billing history retrieved successfully',
        data: billingHistory,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve billing history: ' + error.message,
      };
    }
  }

  async mySubscription(user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (user.approved_at == null) {
        throw new NotFoundException('User not approved');
      }
      let subscription = await this.prisma.subscription.findUnique({
        where: { user_id },
        select: {
          id: true,
          user_id: true,
          plan_id: true,
          status: true,
          plan_type: true,
          current_period_end: true,
          created_at: true,
          updated_at: true,
          plan: {
            select: {
              id: true,
              title: true,
              price: true,
              billing_period: true,
              benefits: true,
            },
          },
        },
      });

      if (!subscription) {
        throw new NotFoundException(`Subscription not found`);
      }

      return {
        success: true,
        message: 'Subscription retrieved successfully',
        data: subscription,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve subscription: ' + error.message,
      };
    }
  }

  async myActiveSubscription(user_id: string) {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { user_id },
        include: {
          plan: true,
        },
      });

      if (!subscription || subscription.status !== 'active') {
        return {
          success: false,
          message: 'No active subscription found',
          data: null,
        };
      }

      const formatDate = (d: Date) => {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      };

      // Calculate the approximate start of the current cycle if monthly
      let start_date = new Date(subscription.created_at);
      if (
        subscription.plan_type === 'MONTHLY' &&
        subscription.current_period_end
      ) {
        const end = new Date(subscription.current_period_end);
        // Estimate start date as 1 month before end date
        const estStart = new Date(end);
        estStart.setMonth(estStart.getMonth() - 1);
        if (estStart > start_date) {
          start_date = estStart;
        }
      }

      let billing_period = '';
      let next_payment = '';

      const nextPayment = subscription.current_period_end
        ? `Next payment scheduled on ${formatDate(new Date(subscription.current_period_end))}`
        : 'N/A';

      return {
        success: true,
        message: 'Active subscription overview retrieved successfully',
        data: {
          id: subscription.id,
          active_plan: subscription.plan.title,
          billing_period: subscription.plan.billing_period,
          next_payment: nextPayment,
          status: subscription.status,
        },
      };
    } catch (error) {
      return {
        success: false,
        message:
          'Failed to retrieve active subscription overview: ' + error.message,
      };
    }
  }

  async cancelSubscription(user_id: string) {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { user_id },
      });

      if (!subscription) {
        return { success: false, message: 'Subscription not found' };
      }

      // Here you would typically call Stripe's API to cancel the subscription
      // e.g., await stripe.subscriptions.cancel(subscription.stripe_subscription_id)

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'canceled' },
      });

      return {
        success: true,
        message: 'Subscription canceled successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to cancel subscription: ' + error.message,
      };
    }
  }

  async changeSubscriptionPlan(user_id: string, new_plan_id: string) {
    try {
      if (!new_plan_id) {
        return { success: false, message: 'New plan ID is required' };
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { user_id },
      });

      if (!subscription) {
        return {
          success: false,
          message: 'Active subscription not found to change',
        };
      }

      const newPlan = await this.prisma.plan.findUnique({
        where: { id: new_plan_id },
      });

      if (!newPlan) {
        return { success: false, message: 'The requested plan does not exist' };
      }

      // Update subscription in Stripe if it exists
      let updatedStripeSubscription: any = null;
      if (subscription.stripe_subscription_id && newPlan.stripe_price_id) {
        updatedStripeSubscription = await StripePayment.updateSubscription(
          subscription.stripe_subscription_id,
          newPlan.stripe_price_id,
        );
      }

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan_id: new_plan_id,
          plan_type: newPlan.type,
          ...(updatedStripeSubscription && {
            current_period_end: new Date(
              updatedStripeSubscription.current_period_end * 1000,
            ),
          }),
        },
      });

      return {
        success: true,
        message: 'Subscription plan changed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to change subscription plan: ' + error.message,
      };
    }
  }
}
