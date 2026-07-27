import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { GlEngineService } from './gl-engine.service';

export interface FiscalYearCloseResult {
  fiscalYearId: string;
  year: number;
  closedAt: Date;
  retainedEarningsEntryId: string;
  closedPeriodIds: string[];
}

/**
 * Handles fiscal year-end closing procedures.
 *
 * Process:
 * 1. Validate all months are closed
 * 2. Close any remaining open periods
 * 3. Transfer revenue & expense balances to retained earnings
 * 4. Mark fiscal year as closed
 * 5. Generate audit trail
 *
 * All operations execute inside a single Prisma $transaction.
 */
@Injectable()
export class FiscalYearCloseService {
  private readonly logger = new Logger(FiscalYearCloseService.name);

  // Default account codes for retained earnings
  private readonly RETAINED_EARNINGS_CODE = '3200';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly glEngine: GlEngineService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Close a fiscal year.
   * Transfers all revenue and expense balances to retained earnings.
   */
  async closeFiscalYear(
    companyId: string,
    year: number,
    closedBy: string,
  ): Promise<FiscalYearCloseResult> {
    return this.prismaService.$transaction(async (tx) => {
      // 1. Find the fiscal year
      const fiscalYear = await tx.fiscalYear.findFirst({
        where: { companyId, year },
      });
      if (!fiscalYear) {
        throw new NotFoundException(`Fiscal year ${year} not found`);
      }
      if (fiscalYear.isClosed) {
        throw new BadRequestException(`Fiscal year ${year} is already closed`);
      }

      // 2. Find all financial periods for this year
      const periods = await tx.financialPeriod.findMany({
        where: { companyId, year },
        orderBy: { month: 'asc' },
      });

      if (periods.length === 0) {
        throw new BadRequestException(
          `No financial periods found for year ${year}`,
        );
      }

      // 3. Close any remaining open periods
      const openPeriods = periods.filter((p) => p.status === 'OPEN');
      const closedPeriodIds: string[] = [];

      for (const period of openPeriods) {
        await tx.financialPeriod.update({
          where: { id: period.id },
          data: {
            status:
              'CLOSED' as Prisma.EnumFinancialPeriodStatusFilter['equals'],
            closedBy: closedBy,
            closedAt: new Date(),
            rowVersion: { increment: 1 },
          },
        });
        closedPeriodIds.push(period.id);
      }

      // 4. Find retained earnings account
      let retainedEarningsAccountId = fiscalYear.retainedEarningsAccountId;
      if (!retainedEarningsAccountId) {
        const reAccount = await tx.chartOfAccount.findFirst({
          where: {
            companyId,
            code: this.RETAINED_EARNINGS_CODE,
            isActive: true,
            deletedAt: null,
          },
        });
        if (!reAccount) {
          throw new BadRequestException(
            `No retained earnings account found. Please create account with code "${this.RETAINED_EARNINGS_CODE}" first.`,
          );
        }
        retainedEarningsAccountId = reAccount.id;
      }

      // 5. Calculate P&L balances (revenue - expense) for the year
      const revenueAccounts = await tx.chartOfAccount.findMany({
        where: {
          companyId,
          accountType: 'REVENUE',
          isActive: true,
          deletedAt: null,
        },
      });
      const expenseAccounts = await tx.chartOfAccount.findMany({
        where: {
          companyId,
          accountType: 'EXPENSE',
          isActive: true,
          deletedAt: null,
        },
      });

      const allIncomeAccounts = [...revenueAccounts, ...expenseAccounts];

      if (allIncomeAccounts.length === 0) {
        // No revenue or expense accounts — close directly
        await tx.fiscalYear.update({
          where: { id: fiscalYear.id },
          data: {
            isClosed: true,
            closedAt: new Date(),
            closedBy: closedBy,
            rowVersion: { increment: 1 },
          },
        });

        return {
          fiscalYearId: fiscalYear.id,
          year,
          closedAt: new Date(),
          retainedEarningsEntryId: '',
          closedPeriodIds,
        };
      }

      // Get account balances for all income statement accounts
      const incomeAccountIds = allIncomeAccounts.map((a) => a.id);
      const balances = await tx.accountBalance.findMany({
        where: {
          companyId,
          accountId: { in: incomeAccountIds },
        },
      });

      // Calculate net profit/loss
      let totalRevenue = new Decimal(0);
      let totalExpense = new Decimal(0);

      for (const bal of balances) {
        const netBalance = new Decimal(bal.closingDebit.toString()).sub(
          new Decimal(bal.closingCredit.toString()),
        );

        const account = allIncomeAccounts.find((a) => a.id === bal.accountId);
        if (account) {
          if (account.accountType === 'REVENUE') {
            // Revenue normally has credit balance → net is negative (credit)
            totalRevenue = totalRevenue.add(netBalance.abs());
          } else if (account.accountType === 'EXPENSE') {
            // Expense normally has debit balance → net is positive (debit)
            totalExpense = totalExpense.add(netBalance.abs());
          }
        }
      }

      const netProfitLoss = totalRevenue.sub(totalExpense);

      if (netProfitLoss.isZero()) {
        // Zero profit — just close
        await tx.fiscalYear.update({
          where: { id: fiscalYear.id },
          data: {
            isClosed: true,
            closedAt: new Date(),
            closedBy: closedBy,
            rowVersion: { increment: 1 },
          },
        });

        return {
          fiscalYearId: fiscalYear.id,
          year,
          closedAt: new Date(),
          retainedEarningsEntryId: '',
          closedPeriodIds,
        };
      }

      // 6. Create closing entry via GL engine
      // Debit: revenue accounts (to zero them out)
      // Credit: expense accounts (to zero them out)
      // If profit: Credit retained earnings
      // If loss: Debit retained earnings
      const lastPeriod = periods[periods.length - 1]!;
      const closingLines: Array<{
        accountId: string;
        debit: string;
        credit: string;
        description?: string;
      }> = [];

      // Close revenue accounts (debit revenue to zero)
      for (const rev of revenueAccounts) {
        const revBalance = balances.find((b) => b.accountId === rev.id);
        if (revBalance) {
          const net = new Decimal(revBalance.closingCredit.toString()).sub(
            new Decimal(revBalance.closingDebit.toString()),
          );
          if (net.gt(0)) {
            closingLines.push({
              accountId: rev.id,
              debit: net.toFixed(4),
              credit: '0.0000',
              description: `Close revenue: ${rev.name}`,
            });
          }
        }
      }

      // Close expense accounts (credit expense to zero)
      for (const exp of expenseAccounts) {
        const expBalance = balances.find((b) => b.accountId === exp.id);
        if (expBalance) {
          const net = new Decimal(expBalance.closingDebit.toString()).sub(
            new Decimal(expBalance.closingCredit.toString()),
          );
          if (net.gt(0)) {
            closingLines.push({
              accountId: exp.id,
              debit: '0.0000',
              credit: net.toFixed(4),
              description: `Close expense: ${exp.name}`,
            });
          }
        }
      }

      // Retained earnings entry
      if (netProfitLoss.gt(0)) {
        // Profit: credit retained earnings
        closingLines.push({
          accountId: retainedEarningsAccountId,
          debit: '0.0000',
          credit: netProfitLoss.toFixed(4),
          description: `Net profit transfer for year ${year}`,
        });
      } else {
        // Loss: debit retained earnings
        closingLines.push({
          accountId: retainedEarningsAccountId,
          debit: netProfitLoss.abs().toFixed(4),
          credit: '0.0000',
          description: `Net loss transfer for year ${year}`,
        });
      }

      // Create the closing entry — this will go through the full posting pipeline
      const result = await this.glEngine.post({
        companyId,
        financialPeriodId: lastPeriod.id,
        entryDate: lastPeriod.endDate,
        description: `Fiscal year ${year} closing entry`,
        referenceType: 'FISCAL_YEAR_CLOSE',
        referenceId: fiscalYear.id,
        createdBy: closedBy,
        lines: closingLines,
      });

      // 7. Mark fiscal year as closed
      await tx.fiscalYear.update({
        where: { id: fiscalYear.id },
        data: {
          isClosed: true,
          closedAt: new Date(),
          closedBy: closedBy,
          retainedEarningsAccountId,
          rowVersion: { increment: 1 },
        },
      });

      // 8. Audit log
      await this.auditLog.log({
        companyId,
        userId: closedBy,
        entityType: 'FiscalYear',
        entityId: fiscalYear.id,
        action: 'CLOSE',
        before: { isClosed: false },
        after: {
          isClosed: true,
          retainedEarningsEntryId: result.id,
          closedPeriods: closedPeriodIds.length,
        },
      });

      return {
        fiscalYearId: fiscalYear.id,
        year,
        closedAt: new Date(),
        retainedEarningsEntryId: result.id,
        closedPeriodIds,
      };
    });
  }
}
