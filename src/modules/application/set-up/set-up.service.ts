import { Injectable } from '@nestjs/common';
import {
  CreateSetUpDto,
  FinancialCommitmentDto,
  UpdateFinancialCommitmentDto,
  UpdateIncomeDto,
  UpdateSavingsGoalDto,
} from './dto/create-set-up.dto';
import { UpdateSetUpDto } from './dto/update-set-up.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PayFrequency } from 'prisma/generated/enums';

@Injectable()
export class SetUpService {
  constructor(private readonly prisma: PrismaService) {}

  async createMySetUpIncome(user_id: string, dto: CreateSetUpDto) {
    return await this.prisma.$transaction(async (tx) => {
      const incomes = await Promise.all(
        (dto.incomes || []).map((income) =>
          tx.income.create({
            data: {
              income_type: income.income_type,
              pay_frequency: income.pay_frequency,
              base_income: income.base_income,
              user_id,
            },
          }),
        ),
      );

      const financialCommitments = await Promise.all(
        (dto.financialCommitments || []).map((commitment) =>
          tx.financialCommitment.create({
            data: {
              category: commitment.category,
              name: commitment.name,
              amount: commitment.amount,
              due_day: commitment.due_day,
              frequency: commitment.frequency,
              is_recurring: commitment.is_recurring,
              user_id,
            },
          }),
        ),
      );

      const savingsGoals = await Promise.all(
        (dto.savingsGoals || []).map((goal) =>
          tx.savingsGoal.create({
            data: {
              goal_name: goal.goal_name,
              target_amount: goal.target_amount,
              contribution: goal.contribution,
              frequency: goal.frequency,
              user_id,
            },
          }),
        ),
      );

      return {
        success: true,
        message: 'Setup information saved successfully',
        data: { incomes, financialCommitments, savingsGoals },
      };
    });
  }

  async findMySetUpIncome(user_id: string) {
    const [incomes, financialCommitments, savingsGoals] = await Promise.all([
      this.prisma.income.findMany({ where: { user_id, deleted_at: null } }),
      this.prisma.financialCommitment.findMany({
        where: { user_id, deleted_at: null },
      }),
      this.prisma.savingsGoal.findMany({
        where: { user_id, deleted_at: null },
      }),
    ]);

    return {
      success: true,
      data: { incomes, financialCommitments, savingsGoals },
    };
  }

  async updateMySetUpIncome(user_id: string, dto: UpdateSetUpDto) {
    return await this.prisma.$transaction(async (tx) => {
      // If incomes array is provided, replace existing
      if (dto.incomes) {
        await tx.income.deleteMany({ where: { user_id } });
        await Promise.all(
          dto.incomes.map((income) =>
            tx.income.create({
              data: {
                income_type: income.income_type,
                pay_frequency: income.pay_frequency,
                base_income: income.base_income,
                user_id,
              },
            }),
          ),
        );
      }

      // If financialCommitments array is provided, replace existing
      if (dto.financialCommitments) {
        await tx.financialCommitment.deleteMany({ where: { user_id } });
        await Promise.all(
          dto.financialCommitments.map((commitment) =>
            tx.financialCommitment.create({
              data: {
                category: commitment.category,
                name: commitment.name,
                amount: commitment.amount,
                due_day: commitment.due_day,
                frequency: commitment.frequency,
                is_recurring: commitment.is_recurring,
                user_id,
              },
            }),
          ),
        );
      }

      // If savingsGoals array is provided, replace existing
      if (dto.savingsGoals) {
        await tx.savingsGoal.deleteMany({ where: { user_id } });
        await Promise.all(
          dto.savingsGoals.map((goal) =>
            tx.savingsGoal.create({
              data: {
                goal_name: goal.goal_name,
                target_amount: goal.target_amount,
                contribution: goal.contribution,
                frequency: goal.frequency,
                user_id,
              },
            }),
          ),
        );
      }

      return this.findMySetUpIncome(user_id);
    });
  }

  async findMyGoals(user_id: string) {
    const [savingsGoals] = await Promise.all([
      this.prisma.savingsGoal.findMany({
        where: { user_id, deleted_at: null },
        select: {
          id: true,
          goal_name: true,
          target_amount: true,
          contribution: true,
          frequency: true,
        },
      }),
    ]);

    return {
      success: true,
      data: { savingsGoals },
    };
  }

  async updateMyGoal(id: string, user_id: string, dto: UpdateSavingsGoalDto) {
    return await this.prisma.$transaction(async (tx) => {
      const financialCommitment = await tx.savingsGoal.update({
        where: { id, user_id, deleted_at: null },
        data: {
          goal_name: dto.goal_name,
          target_amount: dto.target_amount,
          contribution: dto.contribution,
          frequency: dto.frequency,
        },
      });

      return {
        success: true,
        data: { financialCommitment },
      };
    });
  }

  async deleteMyGoal(id: string, user_id: string) {
    await this.prisma.savingsGoal.delete({
      where: { id, user_id, deleted_at: null },
    });

    return {
      success: true,
      message: 'Goal deleted successfully',
    };
  }

  async adddNewGoal(user_id: string, dto: UpdateSavingsGoalDto) {
    return await this.prisma.$transaction(async (tx) => {
      const financialCommitment = await tx.savingsGoal.create({
        data: {
          goal_name: dto.goal_name,
          target_amount: dto.target_amount,
          contribution: dto.contribution,
          frequency: dto.frequency,
          user_id,
        },
      });

      return {
        success: true,
        data: { financialCommitment },
      };
    });
  }

  async findMyDebts(user_id: string) {
    const [financialCommitments] = await Promise.all([
      this.prisma.financialCommitment.findMany({
        where: { user_id, deleted_at: null, category: { in: ['DEBT'] } },
        select: {
          id: true,
          category: true,
          name: true,
          amount: true,
        },
      }),
    ]);

    return {
      success: true,
      data: { financialCommitments },
    };
  }

  async removeMySetUp(user_id: string) {
    await this.prisma.$transaction([
      this.prisma.income.deleteMany({ where: { user_id } }),
      this.prisma.financialCommitment.deleteMany({ where: { user_id } }),
      this.prisma.savingsGoal.deleteMany({ where: { user_id } }),
    ]);

    return {
      success: true,
      message: 'Setup information removed successfully',
    };
  }

  async findMyMonthlyBills(user_id: string) {
    const [financialCommitments] = await Promise.all([
      this.prisma.financialCommitment.findMany({
        where: { user_id, deleted_at: null },
        select: {
          id: true,
          category: true,
          name: true,
          amount: true,
        },
      }),
    ]);

    return {
      success: true,
      data: { financialCommitments },
    };
  }

  async findBill(id: string, user_id: string) {
    const financialCommitment =
      await this.prisma.financialCommitment.findUnique({
        where: { id, user_id, deleted_at: null },
      });

    return {
      success: true,
      data: { financialCommitment },
    };
  }

  async deleteBill(id: string, user_id: string) {
    const financialCommitment = await this.prisma.financialCommitment.delete({
      where: { id, user_id, deleted_at: null },
    });

    return {
      success: true,
      data: { financialCommitment },
    };
  }

  async updateBill(
    id: string,
    user_id: string,
    dto: UpdateFinancialCommitmentDto,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const financialCommitment = await tx.financialCommitment.update({
        where: { id, user_id, deleted_at: null },
        data: {
          category: dto.category,
          name: dto.name,
          amount: dto.amount,
          due_day: dto.due_day,
          frequency: dto.frequency,
          is_recurring: dto.is_recurring,
        },
      });

      return {
        success: true,
        data: { financialCommitment },
      };
    });
  }

  async CreateANewBill(user_id: string, dto: FinancialCommitmentDto) {
    return await this.prisma.$transaction(async (tx) => {
      const financialCommitment = await tx.financialCommitment.create({
        data: {
          category: dto.category,
          name: dto.name,
          amount: dto.amount,
          due_day: dto.due_day,
          frequency: dto.frequency,
          is_recurring: dto.is_recurring,
          user_id,
        },
      });

      return {
        success: true,
        message: 'New bill added successfully',
        data: { financialCommitment },
      };
    });
  }

  async findAllPayIncomes(user_id: string, frequency?: PayFrequency) {
    const [allIncomes, allCommitments, allGoals] = await Promise.all([
      this.prisma.income.findMany({
        where: { user_id, deleted_at: null },
        select: {
          id: true,
          income_type: true,
          pay_frequency: true,
          base_income: true,
        },
      }),
      this.prisma.financialCommitment.findMany({
        where: { user_id, deleted_at: null },
        select: {
          id: true,
          category: true,
          name: true,
          amount: true,
          frequency: true,
        },
      }),
      this.prisma.savingsGoal.findMany({
        where: { user_id, deleted_at: null },
        select: {
          id: true,
          goal_name: true,
          target_amount: true,
          contribution: true,
          frequency: true,
        },
      }),
    ]);

    // Helper to normalize amount to monthly
    const toMonthly = (amount: number, freq: string) => {
      switch (freq) {
        case 'WEEKLY':
          return amount * 4.33;
        case 'EVERY_2_WEEKS':
          return amount * 2.16;
        case 'TWICE_A_MONTH':
          return amount * 2;
        case 'MONTHLY':
          return amount;
        default:
          return 0;
      }
    };

    // Calculate Global Monthly Stats
    let totalMonthlyIncome = 0;
    allIncomes.forEach((income) => {
      totalMonthlyIncome += toMonthly(
        Number(income.base_income || 0),
        income.pay_frequency,
      );
    });

    let totalMonthlyExpenses = 0;
    allCommitments.forEach((c) => {
      totalMonthlyExpenses += toMonthly(Number(c.amount || 0), c.frequency);
    });
    allGoals.forEach((g) => {
      totalMonthlyExpenses += toMonthly(
        Number(g.contribution || 0),
        g.frequency,
      );
    });

    const safeToSpend = totalMonthlyIncome - totalMonthlyExpenses;

    // Filter incomes if frequency provided
    const filteredIncomes = frequency
      ? allIncomes.filter((i) => i.pay_frequency === frequency)
      : allIncomes;

    return {
      success: true,
      data: {
        incomes: filteredIncomes,
        financialCommitments: allCommitments,
        savingsGoals: allGoals,
        summary: {
          totalMonthlyIncome: Math.round(totalMonthlyIncome),
          totalMonthlyExpenses: Math.round(totalMonthlyExpenses),
          safeToSpend: Math.max(0, Math.round(safeToSpend)),
        },
      },
    };
  }

  async updatePayIncome(id: string, user_id: string, dto: UpdateIncomeDto) {
    return await this.prisma.$transaction(async (tx) => {
      const income = await tx.income.update({
        where: { id, user_id, deleted_at: null },
        data: {
          income_type: dto.income_type,
          pay_frequency: dto.pay_frequency,
          base_income: dto.base_income,
        },
      });

      return {
        success: true,
        data: { income },
      };
    });
  }
}
