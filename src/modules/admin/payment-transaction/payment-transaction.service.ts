import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/client';
import { BillingHistoryQueryDto } from './dto/billing-history.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';

@Injectable()
export class PaymentTransactionService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
  ) {}

  async billingHistory(query: BillingHistoryQueryDto) {
    const { page, limit, status, user_id, q, from, to } = query;
    if (from && to && new Date(from) >= new Date(to)) {
      throw new BadRequestException('from must be before to');
    }
    const where: Prisma.PaymentTransactionWhereInput = {
      deleted_at: null,
      ...(status ? { status } : {}),
      ...(user_id ? { user_id } : {}),
      ...((from || to) ? { created_at: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) } } : {}),
      ...(q ? { OR: [
        { reference_number: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { phone_number: { contains: q, mode: 'insensitive' } } },
      ] } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.paymentTransaction.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        select: { id: true, reference_number: true, status: true, type: true, provider: true,
          amount: true, currency: true, paid_amount: true, paid_currency: true,
          created_at: true, updated_at: true,
          user: { select: { id: true, name: true, email: true, phone_number: true } },
        },
      }),
      this.prisma.paymentTransaction.count({ where }),
    ]);
    return {
      success: true,
      data: rows.map(row => ({ ...row, amount: row.amount?.toString() ?? null, paid_amount: row.paid_amount?.toString() ?? null })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(user_id?: string) {
    try {
      const userDetails = await this.userRepository.getUserDetails(user_id);

      const whereClause = {};
      if (userDetails.type == 'vendor') {
        whereClause['user_id'] = user_id;
      }

      const paymentTransactions = await this.prisma.paymentTransaction.findMany(
        {
          where: {
            ...whereClause,
          },
          select: {
            id: true,
            reference_number: true,
            status: true,
            provider: true,
            amount: true,
            currency: true,
            paid_amount: true,
            paid_currency: true,
            created_at: true,
            updated_at: true,
          },
        },
      );

      return {
        success: true,
        data: paymentTransactions,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string, user_id?: string) {
    try {
      const userDetails = await this.userRepository.getUserDetails(user_id);

      const whereClause = {};
      if (userDetails.type == 'vendor') {
        whereClause['user_id'] = user_id;
      }

      const paymentTransaction =
        await this.prisma.paymentTransaction.findUnique({
          where: {
            id: id,
            ...whereClause,
          },
          select: {
            id: true,
            reference_number: true,
            status: true,
            provider: true,
            amount: true,
            currency: true,
            paid_amount: true,
            paid_currency: true,
            created_at: true,
            updated_at: true,
          },
        });

      if (!paymentTransaction) {
        return {
          success: false,
          message: 'Payment transaction not found',
        };
      }

      return {
        success: true,
        data: paymentTransaction,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string, user_id?: string) {
    try {
      const userDetails = await this.userRepository.getUserDetails(user_id);

      const whereClause = {};
      if (userDetails.type == 'vendor') {
        whereClause['user_id'] = user_id;
      }

      const paymentTransaction =
        await this.prisma.paymentTransaction.findUnique({
          where: {
            id: id,
            ...whereClause,
          },
        });

      if (!paymentTransaction) {
        return {
          success: false,
          message: 'Payment transaction not found',
        };
      }

      await this.prisma.paymentTransaction.delete({
        where: {
          id: id,
        },
      });

      return {
        success: true,
        message: 'Payment transaction deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
