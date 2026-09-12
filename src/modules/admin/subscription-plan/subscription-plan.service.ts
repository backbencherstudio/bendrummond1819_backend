import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateSubscriptionPlanDto,
  PlanType,
} from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import stripe from 'stripe';

@Injectable()
export class SubscriptionPlanService {
  constructor(private readonly prisma: PrismaService) {}
  async createPlan(createSubscriptionPlanDto: CreateSubscriptionPlanDto) {
    try {
      // 1. Create a Product in Stripe
      const planTitle = createSubscriptionPlanDto.title || 'Unnamed Plan';
      const stripeProduct = await StripePayment.createProduct(
        planTitle,
        `Subscription Plan: ${planTitle}`,
      );

      // 2. Determine Stripe Price Interval
      // Use billing_period to determine interval (YEARLY -> year, MONTHLY -> month)
      const interval: stripe.PriceCreateParams.Recurring.Interval =
        createSubscriptionPlanDto.billing_period === PlanType.YEARLY
          ? 'year'
          : 'month';

      const stripePrice = await StripePayment.createPrice(
        stripeProduct.id,
        createSubscriptionPlanDto.price,
        'usd',
        interval,
      );

      // 3. Save to database with Stripe IDs
      const plan = await this.prisma.plan.create({
        data: {
          title: planTitle,
          type: createSubscriptionPlanDto.type || PlanType.MONTHLY,
          price: createSubscriptionPlanDto.price,
          billing_period:
            createSubscriptionPlanDto.billing_period || PlanType.MONTHLY,
          benefits: createSubscriptionPlanDto.benefits || [],
          stripe_product_id: stripeProduct.id,
          stripe_price_id: stripePrice.id,
        },
      });

      return {
        success: true,
        message:
          'Subscription plan created successfully and synced with Stripe',
        data: plan,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create subscription plan: ' + error.message,
      };
    }
  }

  async findAllPlans() {
    try {
      const plans = await this.prisma.plan.findMany({
        where: { deleted_at: null },
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

  async updatePlan(
    id: string,
    updateSubscriptionPlanDto: UpdateSubscriptionPlanDto,
  ) {
    try {
      const plan = await this.prisma.plan.findUnique({
        where: { id },
      });

      if (!plan) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      let stripePriceId = plan.stripe_price_id;

      // Update product name in Stripe if provided
      if (
        updateSubscriptionPlanDto.title &&
        updateSubscriptionPlanDto.title !== plan.title
      ) {
        await StripePayment.updateProduct(
          plan.stripe_product_id,
          updateSubscriptionPlanDto.title,
          `Subscription Plan: ${updateSubscriptionPlanDto.title}`,
        );
      }

      // Detect changes that require a new Stripe price
      const isPriceChanged =
        updateSubscriptionPlanDto.price !== undefined &&
        Number(updateSubscriptionPlanDto.price) !== Number(plan.price);
      const isPeriodChanged =
        updateSubscriptionPlanDto.billing_period !== undefined &&
        updateSubscriptionPlanDto.billing_period !== plan.billing_period;
      const isTypeChanged =
        updateSubscriptionPlanDto.type !== undefined &&
        updateSubscriptionPlanDto.type !== plan.type;

      if (isPriceChanged || isPeriodChanged || isTypeChanged) {
        const newPrice = updateSubscriptionPlanDto.price ?? Number(plan.price);
        const newBillingPeriod =
          updateSubscriptionPlanDto.billing_period ??
          (plan.billing_period as PlanType);

        const interval: stripe.PriceCreateParams.Recurring.Interval =
          newBillingPeriod === PlanType.YEARLY ? 'year' : 'month';

        const newStripePrice = await StripePayment.createPrice(
          plan.stripe_product_id,
          newPrice,
          'usd',
          interval,
        );

        if (plan.stripe_price_id) {
          await StripePayment.deactivatePrice(plan.stripe_price_id);
        }

        stripePriceId = newStripePrice.id;
      }

      const updatedPlan = await this.prisma.plan.update({
        where: { id },
        data: {
          ...updateSubscriptionPlanDto,
          stripe_price_id: stripePriceId,
        },
      });

      return {
        success: true,
        message: 'Subscription plan updated successfully',
        data: updatedPlan,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update subscription plan: ' + error.message,
      };
    }
  }

  async removePlan(id: string) {
    try {
      const plan = await this.prisma.plan.findUnique({
        where: { id },
      });

      if (!plan) {
        throw new NotFoundException(`Subscription plan not found`);
      }

      // Deactivate price and product from Stripe
      if (plan.stripe_price_id) {
        await StripePayment.deactivatePrice(plan.stripe_price_id);
      }
      if (plan.stripe_product_id) {
        await StripePayment.deactivateProduct(plan.stripe_product_id);
      }

      await this.prisma.plan.delete({
        where: { id },
      });

      return {
        success: true,
        message:
          'Subscription plan deleted and deactivated in Stripe effectively',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete subscription plan: ' + error.message,
      };
    }
  }
}
