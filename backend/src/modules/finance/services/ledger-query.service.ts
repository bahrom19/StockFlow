import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerRepository } from '../repositories/ledger.repository';

export interface LedgerLine {
  entryDate: Date;
  entryNumber: number;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface AccountBalanceResult {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  year: number;
  month: number;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
  netMovement: string;
  closingBalance: string;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  level: number;
  debit: string;
  credit: string;
}

/**
 * General Ledger query service.
 *
 * Provides read-only access to:
 * - Running balance for any account (ledger)
 * - Account statements (period-based)
 * - Trial balance
 * - Account balance snapshots (materialized)
 *
 * All queries are multi-tenant safe (companyId filtered).
 * Designed for millions of journal lines by using:
 * - AccountBalance snapshots for fast period lookups
 * - Efficient paginated queries on JournalLine
 * - Composite indexes on (companyId, accountId, entryDate)
 */
@Injectable()
export class LedgerQueryService {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  /**
   * Query the general ledger for a specific account with running balance.
   * Returns paginated journal lines with the cumulative balance after each line.
   */
  async getLedger(params: {
    companyId: string;
    accountId: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    items: LedgerLine[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      companyId,
      accountId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = params;

    // Build date filter
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    const where: Record<string, any> = {
      accountId,
      journalEntry: { companyId, status: 'POSTED' },
    };
    if (dateFrom || dateTo) {
      where.journalEntry = {
        ...where.journalEntry,
        entryDate: dateFilter,
      };
    }

    const items = await this.ledgerRepository.findJournalLinesWithEntry(where, {
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await this.ledgerRepository.countJournalLines(where);

    // Calculate opening balance from AccountBalance snapshot
    const openingBalance = await this.getOpeningBalance(
      companyId,
      accountId,
      dateFrom,
    );

    // Compute running balances
    let runningBalance = openingBalance;
    const ledgerLines: LedgerLine[] = items.map((line) => {
      const debit = new Decimal(line.debit.toString());
      const credit = new Decimal(line.credit.toString());
      runningBalance = runningBalance.add(debit).sub(credit);

      return {
        entryDate: line.journalEntry.entryDate,
        entryNumber: line.journalEntry.entryNumber,
        description: line.journalEntry.description,
        referenceType: line.journalEntry.referenceType,
        referenceId: line.journalEntry.referenceId,
        debit: line.debit.toString(),
        credit: line.credit.toString(),
        runningBalance: runningBalance.toFixed(4),
      };
    });

    return { items: ledgerLines, total, page, limit };
  }

  /**
   * Get account balance snapshots for a specific period or range.
   */
  async getAccountBalance(params: {
    companyId: string;
    accountId?: string;
    financialPeriodId?: string;
    year?: number;
    month?: number;
  }): Promise<AccountBalanceResult[]> {
    const { companyId, accountId, financialPeriodId, year, month } = params;

    const where: Record<string, any> = { companyId };
    if (accountId) where.accountId = accountId;
    if (financialPeriodId) where.financialPeriodId = financialPeriodId;
    if (year) where.year = year;
    if (month) where.month = month;

    const balances = await this.ledgerRepository.findAccountBalances(where);

    return balances.map((b) => {
      const closingDebit = new Decimal(b.closingDebit.toString());
      const closingCredit = new Decimal(b.closingCredit.toString());
      const normalBalance = closingDebit.sub(closingCredit);

      return {
        accountId: b.accountId,
        accountCode: b.account.code,
        accountName: b.account.name,
        accountType: b.account.accountType,
        year: b.year,
        month: b.month,
        openingDebit: b.openingDebit.toString(),
        openingCredit: b.openingCredit.toString(),
        periodDebit: b.periodDebit.toString(),
        periodCredit: b.periodCredit.toString(),
        closingDebit: b.closingDebit.toString(),
        closingCredit: b.closingCredit.toString(),
        netMovement: b.periodDebit.sub(b.periodCredit).toString(),
        closingBalance: normalBalance.toString(),
      };
    });
  }

  /**
   * Generate a trial balance as of a specific date.
   * Returns all active accounts with their net debit/credit balances.
   *
   * G15-06b-01: Uses JournalLine-direct cumulative aggregation instead of
   * AccountBalance snapshots. The opening position is derived from historical
   * POSTED JournalLines up to asOfDate — no snapshot dependency.
   */
  async getTrialBalance(params: {
    companyId: string;
    asOfDate?: Date;
    accountType?: string;
  }): Promise<{
    rows: TrialBalanceRow[];
    totalDebit: string;
    totalCredit: string;
  }> {
    const { companyId, asOfDate, accountType } = params;

    const accountWhere: Record<string, any> = {
      companyId,
      isActive: true,
      deletedAt: null,
    };
    if (accountType) accountWhere.accountType = accountType;

    const accounts =
      await this.ledgerRepository.findChartOfAccounts(accountWhere);

    if (accounts.length === 0) {
      return { rows: [], totalDebit: '0.0000', totalCredit: '0.0000' };
    }

    // G15-06b-01: Cumulative balance from POSTED JournalLines up to asOfDate.
    // Replaces AccountBalance snapshot lookup — historical journals without
    // snapshots now correctly affect the Trial Balance.
    const aggregated =
      await this.ledgerRepository.aggregatedJournalLines(companyId, {
        asOfDate,
        onlyPosted: true,
      });

    const balanceMap = new Map<string, { debit: Decimal; credit: Decimal }>();
    for (const agg of aggregated) {
      balanceMap.set(agg.accountId, {
        debit: agg.totalDebit,
        credit: agg.totalCredit,
      });
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    const rows: TrialBalanceRow[] = accounts.map((account) => {
      const bal = balanceMap.get(account.id);
      const debit = bal?.debit ?? new Decimal(0);
      const credit = bal?.credit ?? new Decimal(0);

      // For accounts with normal credit balance (LIABILITY, EQUITY, REVENUE),
      // show net on credit side; for ASSET/EXPENSE, show on debit side
      let displayDebit = debit;
      let displayCredit = credit;

      if (account.normalBalance === 'CREDIT') {
        const net = credit.sub(debit);
        if (net.gte(0)) {
          displayDebit = new Decimal(0);
          displayCredit = net;
        } else {
          displayDebit = net.abs();
          displayCredit = new Decimal(0);
        }
      } else {
        const net = debit.sub(credit);
        if (net.gte(0)) {
          displayDebit = net;
          displayCredit = new Decimal(0);
        } else {
          displayDebit = new Decimal(0);
          displayCredit = net.abs();
        }
      }

      totalDebit = totalDebit.add(displayDebit);
      totalCredit = totalCredit.add(displayCredit);

      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        level: account.level,
        debit: displayDebit.toFixed(4),
        credit: displayCredit.toFixed(4),
      };
    });

    return {
      rows,
      totalDebit: totalDebit.toFixed(4),
      totalCredit: totalCredit.toFixed(4),
    };
  }

  /**
   * G15-06b-02: GL-backed Profit & Loss aggregation.
   *
   * Aggregates POSTED JournalLines by account type within a date range,
   * producing revenue, COGS, and operating expenses directly from the GL.
   * Replaces operational Sale/CostLayer queries as the accounting source.
   *
   * Revenue: accountType=REVENUE, net = credit − debit (normal credit balance)
   * COGS:    accountType=EXPENSE, code starts with '5', net = debit − credit
   * Expenses: accountType=EXPENSE, code starts with '6', net = debit − credit
   */
  async getPnlReport(params: {
    companyId: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    revenue: Decimal;
    cogs: Decimal;
    expenses: Decimal;
    daily: Record<
      string,
      { revenue: Decimal; cogs: Decimal; expenses: Decimal }
    >;
  }> {
    const { companyId, dateFrom, dateTo } = params;

    // Fetch all active accounts to classify by code pattern.
    const accounts = await this.ledgerRepository.findChartOfAccounts({
      companyId,
      isActive: true,
      deletedAt: null,
    });

    // Aggregate JournalLines for REVENUE and EXPENSE accounts in date range.
    const [revenueAgg, expenseAgg] = await Promise.all([
      this.ledgerRepository.aggregatedJournalLines(companyId, {
        dateFrom,
        dateTo,
        accountType: 'REVENUE',
        onlyPosted: true,
      }),
      this.ledgerRepository.aggregatedJournalLines(companyId, {
        dateFrom,
        dateTo,
        accountType: 'EXPENSE',
        onlyPosted: true,
      }),
    ]);

    // Build account lookup for code-based COGS/expense classification.
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    let totalRevenue = new Decimal(0);
    let totalCogs = new Decimal(0);
    let totalExpenses = new Decimal(0);

    // REVENUE: net = credit − debit (normal credit balance)
    for (const agg of revenueAgg) {
      totalRevenue = totalRevenue.add(agg.totalCredit.sub(agg.totalDebit));
    }

    // EXPENSE: classify by account code prefix.
    // 5xxx = COGS, 6xxx = operating expenses (matching seed chart of accounts).
    for (const agg of expenseAgg) {
      const account = accountMap.get(agg.accountId);
      const net = agg.totalDebit.sub(agg.totalCredit); // normal debit balance
      if (account?.code.startsWith('5')) {
        totalCogs = totalCogs.add(net);
      } else {
        totalExpenses = totalExpenses.add(net);
      }
    }

    // Daily breakdown — re-aggregate by entry date.
    const lineWhere: Record<string, any> = {
      journalEntry: {
        companyId,
        status: 'POSTED',
        entryDate: {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        },
      },
      account: { accountType: { in: ['REVENUE', 'EXPENSE'] } },
    };

    const dailyMap: Record<
      string,
      { revenue: Decimal; cogs: Decimal; expenses: Decimal }
    > = {};

    // Aggregate per-line with entry date for daily buckets.
    const lines = await this.ledgerRepository.findJournalLinesWithEntry(
      lineWhere,
      { skip: 0, take: 100000 },
    );

    for (const line of lines) {
      const dayKey = line.journalEntry.entryDate.toISOString().slice(0, 10);
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = {
          revenue: new Decimal(0),
          cogs: new Decimal(0),
          expenses: new Decimal(0),
        };
      }

      const account = accountMap.get(line.accountId);
      if (!account) continue;

      const debit = new Decimal(line.debit.toString());
      const credit = new Decimal(line.credit.toString());

      if (account.accountType === 'REVENUE') {
        dailyMap[dayKey].revenue = dailyMap[dayKey].revenue
          .add(credit)
          .sub(debit);
      } else if (account.accountType === 'EXPENSE') {
        const net = debit.sub(credit);
        if (account.code.startsWith('5')) {
          dailyMap[dayKey].cogs = dailyMap[dayKey].cogs.add(net);
        } else {
          dailyMap[dayKey].expenses = dailyMap[dayKey].expenses.add(net);
        }
      }
    }

    return {
      revenue: totalRevenue,
      cogs: totalCogs,
      expenses: totalExpenses,
      daily: dailyMap,
    };
  }

  /**
   * Get the opening balance for an account as of a specific date.
   * Uses AccountBalance snapshots for performance.
   */
  private async getOpeningBalance(
    companyId: string,
    accountId: string,
    asOfDate?: Date,
  ): Promise<Decimal> {
    if (!asOfDate) return new Decimal(0);

    const period = await this.ledgerRepository.findFinancialPeriodByDate(
      {
        companyId,
        startDate: { lte: asOfDate },
        endDate: { gte: asOfDate },
      },
      { startDate: 'asc' as const },
      { id: true, startDate: true },
    );

    if (!period) return new Decimal(0);

    // Get the previous period's balance
    const prevBalance = await this.ledgerRepository.findFirstAccountBalance(
      {
        companyId,
        accountId,
        financialPeriod: { endDate: { lt: period.startDate } },
      },
      { year: 'desc', month: 'desc' },
    );

    if (prevBalance) {
      return new Decimal(prevBalance.closingDebit.toString()).sub(
        new Decimal(prevBalance.closingCredit.toString()),
      );
    }

    // Check current period's opening balance
    const currentBalance = await this.ledgerRepository.findFirstAccountBalance({
      companyId,
      accountId,
      financialPeriodId: period.id,
    });

    if (currentBalance) {
      return new Decimal(currentBalance.openingDebit.toString()).sub(
        new Decimal(currentBalance.openingCredit.toString()),
      );
    }

    return new Decimal(0);
  }
}
