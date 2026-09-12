import { Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async subscriptionUsage() {
    try {
      // Subscription Breakdown
      const totalSubscriptions = await this.prisma.subscription.count();
      const yearlySubCount = await this.prisma.subscription.count({
        where: { plan_type: 'YEARLY', status: 'active' },
      });
      const monthlySubCount = await this.prisma.subscription.count({
        where: { plan_type: 'MONTHLY', status: 'active' },
      });

      const yearlySubPercentage =
        totalSubscriptions > 0
          ? (yearlySubCount / totalSubscriptions) * 100
          : 0;
      const monthlySubPercentage =
        totalSubscriptions > 0
          ? (monthlySubCount / totalSubscriptions) * 100
          : 0;

      return {
        success: true,
        message: 'Dashboard usage fetched successfully',
        data: {
          subscriptions: {
            yearlyPercentage: Number(yearlySubPercentage.toFixed(2)),
            monthlyPercentage: Number(monthlySubPercentage.toFixed(2)),
            totalSubscriptions,
          },
        },
      };
    } catch (err) {
      return { success: false, message: 'Something went wrong' };
    }
  }

  async dashboardStates() {
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Total Users
      const totalUsers = await this.prisma.user.count();
      const thisMonthUsers = await this.prisma.user.count({
        where: {
          created_at: {
            gte: thisMonthStart,
          },
        },
      });

      // Active Subscriptions
      const activeSubscriptions = await this.prisma.subscription.count({
        where: {
          status: 'active',
        },
      });
      const subscriptionPercentage =
        totalUsers > 0 ? (activeSubscriptions / totalUsers) * 100 : 0;

      // Total Revenue
      const totalRevenueResult = await this.prisma.paymentTransaction.aggregate(
        {
          _sum: { amount: true },
          where: { status: 'succeeded' },
        },
      );
      let totalRevenue = Number(totalRevenueResult._sum.amount || 0);

      // Active Subscription Revenue (Fallback for missing transactions)
      const activeSubs = await this.prisma.subscription.findMany({
        where: { status: 'active' },
        include: { plan: true },
      });
      const subscriptionRevenue = activeSubs.reduce(
        (acc, sub) => acc + Number(sub.plan.price || 0),
        0,
      );

      // If transactions are 0 but we have active subs, use sub revenue
      // Or sum them if you want both (be careful of double counting)
      if (totalRevenue === 0) {
        totalRevenue = subscriptionRevenue;
      }

      // Revenue this month vs last month for percentage change
      const thisMonthRevenueResult =
        await this.prisma.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: {
            status: 'succeeded',
            created_at: { gte: thisMonthStart },
          },
        });
      let thisMonthRevenue = Number(thisMonthRevenueResult._sum.amount || 0);

      // Current month's subscription revenue
      const thisMonthSubs = await this.prisma.subscription.findMany({
        where: {
          status: 'active',
          created_at: { gte: thisMonthStart },
        },
        include: { plan: true },
      });
      const thisMonthSubRevenue = thisMonthSubs.reduce(
        (acc, sub) => acc + Number(sub.plan.price || 0),
        0,
      );

      if (thisMonthRevenue === 0) {
        thisMonthRevenue = thisMonthSubRevenue;
      }

      const lastMonthRevenueResult =
        await this.prisma.paymentTransaction.aggregate({
          _sum: {
            amount: true,
          },
          where: {
            status: 'succeeded',
            created_at: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
        });
      const lastMonthRevenue = Number(lastMonthRevenueResult._sum.amount || 0);

      let revenuePercentageChange = 0;
      if (lastMonthRevenue > 0) {
        revenuePercentageChange =
          ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
      } else if (thisMonthRevenue > 0) {
        revenuePercentageChange = 100;
      }

      return {
        success: true,
        message: 'Dashboard states fetched successfully',
        data: {
          users: {
            total: totalUsers,
            thisMonth: thisMonthUsers,
          },
          subscriptions: {
            active: activeSubscriptions,
            percentageOfTotal: Number(subscriptionPercentage.toFixed(2)),
          },
          revenue: {
            total: totalRevenue,
            percentageChange: Number(revenuePercentageChange.toFixed(2)),
          },
        },
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}
