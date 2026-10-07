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

/**
 * G16-N-8-B — page size for the P&L daily journal-line page loop.
 *
 * The daily breakdown is the only row-hydrating query in the P&L (header
 * totals aggregate database-side), so it must be paged. The previous
 * implementation used a single `take: 100000` which silently truncated any
 * larger population — a report that quietly stops being a report. A named
 * constant plus a complete loop removes the arbitrary ceiling while keeping
 * each query bounded.
 *
 * Ordering is deterministic (`entryDate ASC, id ASC`, enforced in
 * LedgerRepository.findJournalLinesWithEntry), which is what makes
 * skip/take paging provably complete rather than merely probably complete.
 */
const PNL_DAILY_PAGE_SIZE = 1000;

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

export interface BalanceSheetRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY';
  level: number;
  balance: string;
}

export interface BalanceSheetSection {
  rows: BalanceSheetRow[];
  total: string;
}

export interface BalanceSheetResult {
  asOfDate: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  currentEarnings: string;
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
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
      // G16-N-8-A: the account statement is a DETAIL listing, not a position
      // aggregate. A GlEngine reversal leaves two real rows — the original
      // (now REVERSED) and its POSTED compensation — and both must remain
      // visible so the running balance reconciles with the snapshot-layer
      // opening/closing balances even when the pair straddles `dateFrom`.
      // FT / supplier-payment reversals keep their POSTED originals, so the
      // widened status set changes nothing for them.
      journalEntry: { companyId, status: { in: ['POSTED', 'REVERSED'] } },
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

    // G16 — CR-1/CR-3/CR-4: the Trial Balance is ACCOUNTING HISTORY, not an
    // account-lifecycle view. `isActive`/`deletedAt` gate who may POST to an
    // account (CR-2) and API/picker visibility (CR-3); they must NEVER remove
    // historical amounts from a financial statement. `aggregatedJournalLines`
    // below already returns every account's POSTED balance with no lifecycle
    // filter, so restricting this list used to place those balances in the map
    // and then silently drop both the row and its contribution to the totals.
    //
    // The failure was undetectable in its worst form: when the retired accounts
    // net to zero on each side (e.g. a historical ASSET and its EQUITY offset)
    // the report rendered 0 rows, Dr 0 / Cr 0 and still reported as balanced.
    const accountWhere: Record<string, any> = { companyId };
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
   * G15-07-C2: GL-backed Balance Sheet as of a specific date.
   *
   * Sources POSTED JournalLines cumulatively up to asOfDate (same canonical
   * source as the Trial Balance) — never AccountBalance snapshots and never
   * operational tables.
   *
   * Permanent accounts (ASSET/LIABILITY/EQUITY) carry their cumulative
   * balance. The retained earnings account (e.g. 3200) is NOT special-cased:
   * its posted closing journals surface naturally inside equity.
   * currentEarnings is cumulative REVENUE (credit − debit) minus EXPENSE
   * (debit − credit); because fiscal-year close zeroes those accounts, this
   * equals earnings accumulated after the latest close (or lifetime earnings
   * when no close has occurred).
   */
  async getBalanceSheet(params: {
    companyId: string;
    asOfDate?: Date;
  }): Promise<BalanceSheetResult> {
    const { companyId, asOfDate } = params;
    const effectiveAsOf = asOfDate ?? new Date();

    // G16 — CR-1/CR-3/CR-4: same accounting-history rule as getTrialBalance.
    // A retired account keeps its historical balances in the statement, and
    // `currentEarnings` below is derived from the same POSTED journal aggregate
    // as the P&L, so it is lifecycle-independent too. Dropping the lifecycle
    // filter also restores the balance-sheet identity as a real check: an
    // omitted REVENUE/EXPENSE leg previously shifted `currentEarnings` without
    // shifting the opposite side, and `balanced` could not be trusted.
    const accounts = await this.ledgerRepository.findChartOfAccounts({
      companyId,
    });

    const zeroSection = (): BalanceSheetSection => ({
      rows: [],
      total: '0.0000',
    });

    if (accounts.length === 0) {
      return {
        asOfDate: effectiveAsOf.toISOString(),
        assets: zeroSection(),
        liabilities: zeroSection(),
        equity: zeroSection(),
        currentEarnings: '0.0000',
        totalLiabilitiesAndEquity: '0.0000',
        balanced: true,
      };
    }

    // Single aggregation for the whole statement — section split and
    // current-earnings derivation both reuse this result.
    const aggregated = await this.ledgerRepository.aggregatedJournalLines(
      companyId,
      {
        ...(asOfDate ? { asOfDate } : {}),
        onlyPosted: true,
      },
    );

    const balanceMap = new Map<string, { debit: Decimal; credit: Decimal }>();
    for (const agg of aggregated) {
      balanceMap.set(agg.accountId, {
        debit: agg.totalDebit,
        credit: agg.totalCredit,
      });
    }

    const assetRows: BalanceSheetRow[] = [];
    const liabilityRows: BalanceSheetRow[] = [];
    const equityRows: BalanceSheetRow[] = [];
    let assetsTotal = new Decimal(0);
    let liabilitiesTotal = new Decimal(0);
    let equityTotal = new Decimal(0);
    let currentEarnings = new Decimal(0);

    for (const account of accounts) {
      const bal = balanceMap.get(account.id);
      const debit = bal?.debit ?? new Decimal(0);
      const credit = bal?.credit ?? new Decimal(0);
      const type = account.accountType as string;

      if (type === 'REVENUE') {
        currentEarnings = currentEarnings.add(credit.sub(debit));
        continue;
      }
      if (type === 'EXPENSE') {
        currentEarnings = currentEarnings.sub(debit.sub(credit));
        continue;
      }

      // Signed balance on the account's normal side; contra positions stay
      // inline and are never moved to another section.
      let balance: Decimal;
      if (type === 'ASSET') {
        balance = debit.sub(credit);
      } else if (type === 'LIABILITY' || type === 'EQUITY') {
        balance = credit.sub(debit);
      } else {
        continue;
      }

      const row: BalanceSheetRow = {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: type as 'ASSET' | 'LIABILITY' | 'EQUITY',
        level: account.level,
        balance: balance.toFixed(4),
      };

      if (type === 'ASSET') {
        assetRows.push(row);
        assetsTotal = assetsTotal.add(balance);
      } else if (type === 'LIABILITY') {
        liabilityRows.push(row);
        liabilitiesTotal = liabilitiesTotal.add(balance);
      } else {
        equityRows.push(row);
        equityTotal = equityTotal.add(balance);
      }
    }

    const totalLiabilitiesAndEquity = liabilitiesTotal
      .add(equityTotal)
      .add(currentEarnings);

    return {
      asOfDate: effectiveAsOf.toISOString(),
      assets: { rows: assetRows, total: assetsTotal.toFixed(4) },
      liabilities: { rows: liabilityRows, total: liabilitiesTotal.toFixed(4) },
      equity: { rows: equityRows, total: equityTotal.toFixed(4) },
      currentEarnings: currentEarnings.toFixed(4),
      totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(4),
      balanced: assetsTotal.equals(totalLiabilitiesAndEquity),
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

    // G16-N-8-B: account LIFECYCLE must not gate historical amounts.
    //
    // `isActive`/`deletedAt` control who may POST to an account and whether
    // the account is selectable in the API — not whether money already posted
    // to it appears in a financial statement. Deactivating or soft-deleting an
    // account never removes its historical journal lines (JournalLine has no
    // cascade from ChartOfAccount), and FinanceIntegrationService only ever
    // *posts* to active, non-deleted accounts — so every line on a
    // deactivated account is by construction historical and must stay visible.
    //
    // The previous `isActive: true, deletedAt: null` filter also caused a
    // second, sharper bug: an account outside the map made
    // `account?.code.startsWith('5')` evaluate to undefined, so a historical
    // COGS amount on a deactivated 5xxx account was misclassified as an
    // operating expense. Classifying the FULL company account set removes both
    // failure modes at once and keeps COGS purely code-prefix based.
    const accounts = await this.ledgerRepository.findChartOfAccounts({
      companyId,
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

    // Daily breakdown — same canonical journal-entry population as the header
    // above, grouped by entry date.
    //
    // G16-N-8-B: `journalEntry` is taken VERBATIM from the repository-owned
    // canonical predicate (`positionalJournalEntryWhere`), so the daily series
    // and the header totals are guaranteed to describe the same set of journal
    // entries. Previously this clause was hand-written with only
    // `status: 'POSTED'` and NO reversal exclusion, which meant a GlEngine
    // reversal left the header reversal-neutral while the daily series still
    // carried the compensation — the report's own breakdown stopped footing to
    // its own headline. Only the line-level grouping/classification constraint
    // (accountType) is added here.
    const lineWhere: Record<string, any> = {
      journalEntry: this.ledgerRepository.positionalJournalEntryWhere(
        companyId,
        { dateFrom, dateTo, onlyPosted: true },
      ),
      account: { accountType: { in: ['REVENUE', 'EXPENSE'] } },
    };

    const dailyMap: Record<
      string,
      { revenue: Decimal; cogs: Decimal; expenses: Decimal }
    > = {};

    // Aggregate per-line with entry date for daily buckets.
    //
    // G16-N-8-B: complete paged read. The previous single `take: 100000`
    // silently truncated any larger population. The loop runs to the final
    // short page and the repository's deterministic `entryDate ASC, id ASC`
    // ordering guarantees no row is skipped or double-counted across pages.
    let skip = 0;
    for (;;) {
      const lines = await this.ledgerRepository.findJournalLinesWithEntry(
        lineWhere,
        { skip, take: PNL_DAILY_PAGE_SIZE },
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

      if (lines.length < PNL_DAILY_PAGE_SIZE) break;
      skip += PNL_DAILY_PAGE_SIZE;
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
