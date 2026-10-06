import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FinancialPeriod } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { FinancialPeriodsRepository } from '../repositories/financial-periods.repository';
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
 * 1. Validate fiscal year is not already closed (CAS claim — G15-03-01)
 * 2. Load the fiscal year's FinancialPeriod rows
 * 3. Close every still-OPEN period EXCEPT the closing-journal posting period
 * 4. Aggregate the year's income-statement balances into ONE dataset
 * 5. Post the closing journal into the one remaining OPEN period
 * 6. Close that final period
 * 7. Mark the fiscal year as closed and write the audit trail
 *
 * G16-N-7 — closing-entry correctness:
 *  - Period scoping (D1): balances are read ONLY for this fiscal year's
 *    period ids. Prior-year rows can never leak into the result.
 *  - Signed semantics (D2): the P&L uses Σ(credit − debit) with NO abs().
 *    Contra revenue (refund) and contra expense (credit note) therefore
 *    reduce the result instead of being counted as if normal.
 *  - One dataset (D3): the retained-earnings figure and every per-account
 *    closing line are derived from the SAME Map<accountId, signedNet>.
 *    There is no second per-account lookup.
 *  Because Σ signedNet over all income accounts equals the profit and the
 *  closing lines zero each of those accounts, the generated journal balances
 *  BY CONSTRUCTION for any combination of contra balances.
 *
 * Ordering (step 3 before step 4): posting requires an OPEN period, but
 * closing the non-posting periods first removes them from the set of periods
 * that can still accept a concurrent posting while the aggregate is read.
 * Everything stays inside ONE Prisma transaction, so any failure (including a
 * period CAS loss) rolls the closes back together with the journal and the
 * year-close.
 *
 * KNOWN RESIDUAL (approved P3): a posting that lands in the *posting period*
 * between step 5 and step 6 is still not seen by the aggregate. Fully closing
 * that window would require a CLOSING two-phase state or a lock protocol
 * across every posting path; both are explicitly out of scope for G16-N-7.
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
    private readonly periodsRepository: FinancialPeriodsRepository,
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

      // G16-N-7 P2-C: close helper now goes through FinancialPeriodsRepository,
      // which performs a REAL compare-and-set: `updateMany` on
      // (id + companyId + rowVersion). The previous direct
      // `tx.financialPeriod.update({ where: { id } })` had no rowVersion
      // predicate and therefore silently overwrote a concurrent period
      // edit. A CAS loss raises ConflictException, which aborts the whole
      // fiscal-year-close transaction — never a silent overwrite.
      const closePeriods = async (
        targets: FinancialPeriod[],
      ): Promise<string[]> => {
        const closedIds: string[] = [];
        for (const period of targets) {
          if (period.status !== 'OPEN') continue;
          await this.periodsRepository.update(
            period.id,
            {
              status: 'CLOSED',
              closedAt: new Date(),
              // Same shape as FinancialPeriodsService.close(): the raw
              // `closedBy` scalar is not part of the relation-capable
              // UpdateInput, so attribution goes through the relation.
              closedByUser: { connect: { id: closedBy } },
            },
            companyId,
            period.rowVersion,
            tx,
          );
          closedIds.push(period.id);
        }
        return closedIds;
      };

      // G15-01: the closing journal must be posted into an OPEN period —
      // posting validation rejects CLOSED periods and must NOT be bypassed.
      // The semantic is preserved exactly: the LATEST still-OPEN period of
      // the year (normally December).
      const openPeriodsForPosting = periods.filter((p) => p.status === 'OPEN');
      const postingPeriod =
        openPeriodsForPosting[openPeriodsForPosting.length - 1] ?? null;

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
        // No revenue or expense accounts — close every period directly.
        const closedPeriodIds = await closePeriods(periods);
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

      // G16-N-7 step 3: close every still-OPEN period EXCEPT the posting
      // period BEFORE the aggregate is read. Posting requires an OPEN
      // period, so the posting period is necessarily left open; closing the
      // others first removes them from the set of periods that can still
      // accept a concurrent posting while we read. Atomic: any later failure
      // rolls these closes back together with the journal and the year.
      const closedPeriodIds = await closePeriods(
        postingPeriod
          ? periods.filter((p) => p.id !== postingPeriod.id)
          : periods,
      );

      // G16-N-7 D1: the balance read is scoped to THIS fiscal year's period
      // ids, so a prior-year row can never contribute to the close.
      const incomeAccountIds = allIncomeAccounts.map((a) => a.id);
      const grouped = await tx.accountBalance.groupBy({
        by: ['accountId'],
        where: {
          companyId,
          accountId: { in: incomeAccountIds },
          financialPeriodId: { in: periods.map((p) => p.id) },
        },
        _sum: { closingDebit: true, closingCredit: true },
      });

      // G16-N-7 D2 + D3: ONE signed map, aggregated DB-side per account.
      // signedNet = SUM(credit) - SUM(debit); positive means credit-normal,
      // i.e. the account's contribution to profit. NO abs(): a contra balance
      // stays negative and therefore reduces the result.
      const signedNetByAccount = new Map<string, Decimal>(
        grouped.map((g) => [
          g.accountId,
          new Decimal(g._sum.closingCredit?.toString() ?? '0').sub(
            new Decimal(g._sum.closingDebit?.toString() ?? '0'),
          ),
        ]),
      );

      // Profit = SUM(signedNet) over every income account. Revenue is
      // credit-normal and expense debit-normal, so a plain sum of the same
      // signed measure yields profit directly - no type-conditional branch
      // and no sign loss.
      let profit = new Decimal(0);
      for (const net of signedNetByAccount.values()) {
        profit = profit.add(net);
      }

      const closingLines: Array<{
        accountId: string;
        debit: string;
        credit: string;
        description?: string;
      }> = [];

      // G16-N-7: closing lines derive from the SAME map as `profit`. There is
      // no second per-account lookup. Each non-zero income account is zeroed
      // on the side that carries its balance.
      for (const account of allIncomeAccounts) {
        const net = signedNetByAccount.get(account.id);
        if (!net || net.isZero()) continue;
        closingLines.push({
          accountId: account.id,
          debit: net.gt(0) ? net.toFixed(4) : '0.0000',
          credit: net.lt(0) ? net.abs().toFixed(4) : '0.0000',
          description: `Close ${account.accountType === 'REVENUE' ? 'revenue' : 'expense'}: ${account.name}`,
        });
      }

      // Retained earnings: profit => credit, loss => debit, zero => NO line.
      // The zeroing lines above are still emitted at zero profit: revenue and
      // expense accounts are individually non-zero even when they cancel, and
      // leaving them open after the year is closed would double-count them in
      // the next GL-backed report.
      if (profit.gt(0)) {
        closingLines.push({
          accountId: retainedEarningsAccountId,
          debit: '0.0000',
          credit: profit.toFixed(4),
          description: `Net profit transfer for year ${year}`,
        });
      } else if (profit.lt(0)) {
        closingLines.push({
          accountId: retainedEarningsAccountId,
          debit: profit.abs().toFixed(4),
          credit: '0.0000',
          description: `Net loss transfer for year ${year}`,
        });
      }

      // Steps 5-6: post the closing journal into the one remaining OPEN
      // period, then close that period with the same CAS helper.
      //
      // Nothing to post happens when every income account already nets to
      // zero (e.g. a brand-new tenant): the close still completes.
      let retainedEarningsEntryId = '';
      if (closingLines.length > 0) {
        if (!postingPeriod) {
          throw new BadRequestException(
            `Cannot close fiscal year ${year}: a closing journal is required ` +
              `but all periods are already CLOSED and posting validation ` +
              `only accepts an OPEN period.`,
          );
        }

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
        retainedEarningsEntryId = result.id;
      }

      // Step 6: close the posting period. This runs whether or not a journal
      // was posted, so the year can never finish with one period still OPEN.
      if (postingPeriod) {
        closedPeriodIds.push(...(await closePeriods([postingPeriod])));
      }

      // Step 7: mark fiscal year as closed
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

      // Step 8: audit log
      await this.auditLog.log(
        {
          companyId,
          userId: closedBy,
          entityType: 'FiscalYear',
          entityId: fiscalYear.id,
          action: 'CLOSE',
          before: { isClosed: false },
          after: {
            isClosed: true,
            retainedEarningsEntryId,
            closedPeriods: closedPeriodIds.length,
          },
        },
        tx,
      );

      return {
        fiscalYearId: fiscalYear.id,
        year,
        closedAt: new Date(),
        retainedEarningsEntryId,
        closedPeriodIds,
      };
    });
  }
}
