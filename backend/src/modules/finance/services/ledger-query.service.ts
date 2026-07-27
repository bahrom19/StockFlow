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

    // Get balance snapshots for the most recent period
    const balanceWhere: Record<string, any> = {
      companyId,
      accountId: { in: accounts.map((a) => a.id) },
    };
    if (asOfDate) {
      const period = await this.ledgerRepository.findFinancialPeriodByDate(
        {
          companyId,
          startDate: { lte: asOfDate },
          endDate: { gte: asOfDate },
        },
        undefined,
        { id: true },
      );
      if (period) balanceWhere.financialPeriodId = period.id;
    }

    const balances =
      await this.ledgerRepository.findAccountBalancesBulk(balanceWhere);

    const balanceMap = new Map<string, { debit: Decimal; credit: Decimal }>();
    for (const b of balances) {
      balanceMap.set(b.accountId, {
        debit: new Decimal(b.closingDebit.toString()),
        credit: new Decimal(b.closingCredit.toString()),
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
