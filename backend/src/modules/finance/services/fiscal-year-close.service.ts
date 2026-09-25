import {
  BadRequestException,
  ConflictException,
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
 * 1. Validate fiscal year is not already closed
 * 2. Post the closing journal into the latest OPEN period (if P&L is
 *    non-zero) — the journal must pass the standard posting validation,
 *    which only accepts OPEN periods
 * 3. Close any remaining open periods
 * 4. Transfer revenue & expense balances to retained earnings (via journal)
 * 5. Mark fiscal year as closed
 * 6. Generate audit trail
 *
 * All operations execute inside a single Prisma $transaction, and the
 * closing journal is posted through the same transaction client, so a
 * failure anywhere rolls back periods, journal and year-close together.
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
   * G15-07-C1: retained earnings must be a credit-normal EQUITY account.
   * Validates semantics only — never repairs the account. isSystem is
   * deliberately NOT required: a valid manually-created EQUITY/CREDIT
   * account may serve the same role.
   */
  private assertValidRetainedEarningsAccount(account: {
    code: string;
    accountType: string;
    normalBalance: string;
  }): void {
    if (account.accountType !== 'EQUITY') {
      throw new BadRequestException(
        `Retained earnings account "${account.code}" must be of type EQUITY ` +
          `(found ${account.accountType}).`,
      );
    }
    if (account.normalBalance !== 'CREDIT') {
      throw new BadRequestException(
        `Retained earnings account "${account.code}" must have a CREDIT ` +
          `normal balance (found ${account.normalBalance}).`,
      );
    }
  }

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

      // G15-03-01: CAS-claim the close as the single linearization point.
      // The conditional update (id + companyId + isClosed=false) is the
      // source of truth for concurrent protection: exactly one concurrent
      // close can win; the loser gets count = 0 and must post nothing.
      // Runs inside the existing transaction BEFORE any business mutation,
      // so a later failure rolls the claim back together with everything
      // else (the year stays open and retryable).
      const claimed = await tx.fiscalYear.updateMany({
        where: {
          id: fiscalYear.id,
          companyId,
          isClosed: false,
        },
        data: {
          rowVersion: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException(
          `Fiscal year ${year} is already closed or is being closed concurrently`,
        );
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

      // G15-01: close helper — runs AFTER the closing journal is posted
      // (posting requires an OPEN period). Closes every still-OPEN period
      // and returns their ids. Shares the outer transaction: a later
      // failure rolls the closes back together with everything else.
      const closeOpenPeriods = async (): Promise<string[]> => {
        const closedIds: string[] = [];
        for (const period of periods) {
          if (period.status !== 'OPEN') continue;
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
          closedIds.push(period.id);
        }
        return closedIds;
      };

      // 4. Find retained earnings account
      // G15-07-C1: resolve and semantically validate the account before use.
      // Resolution is always company-scoped and filters inactive/deleted
      // rows; a cross-company or unusable account fails fast and is never
      // silently repaired.
      let retainedEarningsAccountId: string;
      if (fiscalYear.retainedEarningsAccountId) {
        const override = await tx.chartOfAccount.findFirst({
          where: {
            id: fiscalYear.retainedEarningsAccountId,
            companyId,
            isActive: true,
            deletedAt: null,
          },
        });
        if (!override) {
          throw new BadRequestException(
            `The configured retained earnings account ` +
              `(${fiscalYear.retainedEarningsAccountId}) was not found, is ` +
              `inactive or belongs to another company.`,
          );
        }
        this.assertValidRetainedEarningsAccount(override);
        retainedEarningsAccountId = override.id;
      } else {
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
        this.assertValidRetainedEarningsAccount(reAccount);
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
        const closedPeriodIds = await closeOpenPeriods();
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
        const closedPeriodIds = await closeOpenPeriods();
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
      //
      // G15-01: the closing journal must be posted into an OPEN period —
      // posting validation rejects CLOSED periods and must NOT be bypassed.
      // Use the latest still-OPEN period of the year (normally December);
      // periods are closed only after the journal posts successfully.
      const openPeriodsForPosting = periods.filter((p) => p.status === 'OPEN');
      const postingPeriod =
        openPeriodsForPosting[openPeriodsForPosting.length - 1];
      if (!postingPeriod) {
        throw new BadRequestException(
          `Cannot close fiscal year ${year} with non-zero profit/loss: ` +
            `all periods are already CLOSED and a closing journal requires ` +
            `an OPEN period.`,
        );
      }
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

      // Create the closing entry through the SAME outer transaction
      // (atomic with the period/year closes below) into the still-OPEN
      // posting period selected above.
      const result = await this.glEngine.post(
        {
          companyId,
          financialPeriodId: postingPeriod.id,
          entryDate: postingPeriod.endDate,
          description: `Fiscal year ${year} closing entry`,
          referenceType: 'FISCAL_YEAR_CLOSE',
          referenceId: fiscalYear.id,
          createdBy: closedBy,
          lines: closingLines,
        },
        tx,
      );

      // 7. Close the remaining open periods only after the journal posted.
      const closedPeriodIds = await closeOpenPeriods();

      // 8. Mark fiscal year as closed
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
