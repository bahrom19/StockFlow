import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class LedgerRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prismaService;
  }

  /**
   * Find journal lines filtered by account and company with journal entry details.
   * Used by getLedger() for running balance queries.
   */
  async findJournalLinesWithEntry(
    where: Record<string, unknown>,
    pagination: { skip: number; take: number },
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).journalLine.findMany({
      where,
      include: {
        journalEntry: {
          select: {
            entryDate: true,
            entryNumber: true,
            description: true,
            referenceType: true,
            referenceId: true,
          },
        },
      },
      orderBy: { journalEntry: { entryDate: 'asc' as const } },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  /**
   * Count journal lines matching the filter.
   */
  async countJournalLines(
    where: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.prisma(tx).journalLine.count({ where });
  }

  /**
   * Find account balances with account code/name/type included.
   */
  async findAccountBalances(
    where: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).accountBalance.findMany({
      where,
      include: {
        account: { select: { code: true, name: true, accountType: true } },
      },
      orderBy: { year: 'asc', month: 'asc' },
    });
  }

  /**
   * Find account balances without includes (bulk).
   */
  async findAccountBalancesBulk(
    where: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).accountBalance.findMany({
      where,
    });
  }

  /**
   * Find a single account balance record.
   */
  async findFirstAccountBalance(
    where: Record<string, unknown>,
    orderBy?: Record<string, string>,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).accountBalance.findFirst({
      where,
      orderBy: orderBy as Record<string, 'asc' | 'desc'> | undefined,
    });
  }

  /**
   * Find all active Chart of Accounts for a company.
   */
  async findChartOfAccounts(
    where: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).chartOfAccount.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Aggregate JournalLine debit/credit grouped by accountId.
   * Used by Trial Balance and P&L to compute cumulative GL positions
   * directly from posted journal entries without AccountBalance snapshots.
   */
  async aggregatedJournalLines(
    companyId: string,
    opts: {
      asOfDate?: Date;
      dateFrom?: Date;
      dateTo?: Date;
      accountType?: string;
      onlyPosted?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<
    {
      accountId: string;
      totalDebit: Decimal;
      totalCredit: Decimal;
    }[]
  > {
    const entryWhere: Record<string, any> = { companyId };
    if (opts.onlyPosted !== false) {
      entryWhere.status = 'POSTED';
      // G16-N-8-A: positional aggregates must be economically neutral for a
      // GlEngine reversal. The original JE is flipped POSTED -> REVERSED (so
      // it is already excluded by the status filter) and its compensating
      // entry is created as a POSTED entry with referenceType='REVERSAL' —
      // excluding exactly that compensation makes the pair contribute zero,
      // matching the AccountBalance snapshot layer. IMPORTANT: only the
      // GlEngine reversal taxonomy is excluded. FINANCIAL_TRANSACTION_REVERSAL
      // and SUPPLIER_PAYMENT_REVERSAL use a different lifecycle — their
      // original JE stays POSTED, so both legs must remain included to net
      // to zero naturally.
      //
      // referenceType is NULLABLE (GlEngineService writes
      // `input.referenceType ?? null`), and PostgreSQL three-valued logic
      // makes a bare `{ not: 'REVERSAL' }` (SQL `referenceType <> 'REVERSAL'`,
      // or `NOT IN`, or `NOT (=)`) evaluate to NULL for a NULL column, i.e.
      // DROP the row. Verified against real PostgreSQL: the bare `not` form
      // silently discards NULL-referenceType entries that the pre-G16-N-8-A
      // status-only filter did include. The explicit `IS NULL OR <> 'REVERSAL'`
      // disjunction preserves them.
      entryWhere.OR = [
        { referenceType: null },
        { referenceType: { not: 'REVERSAL' } },
      ];
    }
    if (opts.asOfDate) entryWhere.entryDate = { lte: opts.asOfDate };
    if (opts.dateFrom || opts.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (opts.dateFrom) dateFilter.gte = opts.dateFrom;
      if (opts.dateTo) dateFilter.lte = opts.dateTo;
      entryWhere.entryDate = dateFilter;
    }

    const lineWhere: Record<string, any> = { journalEntry: entryWhere };
    if (opts.accountType) {
      lineWhere.account = { accountType: opts.accountType };
    }

    const grouped = await this.prisma(tx).journalLine.groupBy({
      by: ['accountId'],
      where: lineWhere,
      _sum: { debit: true, credit: true },
    });

    return grouped.map((g) => ({
      accountId: g.accountId,
      totalDebit: new Decimal(g._sum.debit?.toString() ?? '0'),
      totalCredit: new Decimal(g._sum.credit?.toString() ?? '0'),
    }));
  }

  /**
   * G15-07-C3-C — cash-flow aggregation primitive.
   *
   * Extends the aggregatedJournalLines pattern with cash-flow filters:
   * selected account ids, a single referenceType, and an explicit journal
   * entry id set. Grouping stays per accountId (database-side sums, no
   * hydration). The existing aggregatedJournalLines is intentionally left
   * untouched — trial balance and P&L keep their proven behavior.
   */
  async aggregatedCashFlowLines(
    companyId: string,
    opts: {
      asOfDate?: Date;
      dateFrom?: Date;
      dateTo?: Date;
      accountIds?: string[];
      referenceType?: string;
      journalEntryIds?: string[];
      onlyPosted?: boolean;
      // G16-N-8-A: positional reads (beginning/ending cash) default to the
      // same reversal-neutral semantics as aggregatedJournalLines. The
      // cash-flow MOVEMENT partitions pass true so a reversal compensation
      // stays visible as a real cash movement and classifyEntry() can
      // inherit the original's category.
      includeReversalCompensations?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<
    {
      accountId: string;
      totalDebit: Decimal;
      totalCredit: Decimal;
    }[]
  > {
    const entryWhere: Record<string, any> = { companyId };
    if (opts.onlyPosted !== false) {
      entryWhere.status = 'POSTED';
      // G16-N-8-A: same positional semantics as aggregatedJournalLines —
      // exclude only the GlEngine reversal compensation so a reversed pair
      // nets to zero against the AccountBalance snapshots. The movement
      // partitions opt back in via includeReversalCompensations: true.
      // NULL referenceType must survive (nullable column + PostgreSQL
      // three-valued logic drops it under a bare `not`/`notIn`/`NOT`).
      if (!opts.includeReversalCompensations) {
        entryWhere.OR = [
          { referenceType: null },
          { referenceType: { not: 'REVERSAL' } },
        ];
      }
    }
    if (opts.asOfDate) entryWhere.entryDate = { lte: opts.asOfDate };
    if (opts.dateFrom || opts.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (opts.dateFrom) dateFilter.gte = opts.dateFrom;
      if (opts.dateTo) dateFilter.lte = opts.dateTo;
      entryWhere.entryDate = dateFilter;
    }
    if (opts.referenceType) {
      // An explicit single-referenceType filter fully determines the taxonomy
      // of the read, so drop the positional reversal exclusion instead of
      // AND-ing a stale one onto it.
      delete entryWhere.OR;
      entryWhere.referenceType = opts.referenceType;
    }

    const lineWhere: Record<string, any> = { journalEntry: entryWhere };
    if (opts.accountIds) {
      lineWhere.accountId = { in: opts.accountIds };
    }
    if (opts.journalEntryIds) {
      lineWhere.journalEntryId = { in: opts.journalEntryIds };
    }

    const grouped = await this.prisma(tx).journalLine.groupBy({
      by: ['accountId'],
      where: lineWhere,
      _sum: { debit: true, credit: true },
    });

    return grouped.map((g) => ({
      accountId: g.accountId,
      totalDebit: new Decimal(g._sum.debit?.toString() ?? '0'),
      totalCredit: new Decimal(g._sum.credit?.toString() ?? '0'),
    }));
  }

  /**
   * G15-07-C3-C — list journal entries touching selected accounts in a
   * date range, with their classification references. Bounded bulk lookup
   * (one query for the whole range); the service partitions ids in memory
   * and aggregates per partition — no per-JE queries, no N+1.
   */
  async findCashJournalEntries(
    companyId: string,
    opts: {
      accountIds: string[];
      dateFrom: Date;
      dateTo: Date;
      onlyPosted?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<
    {
      id: string;
      referenceType: string | null;
      referenceId: string | null;
    }[]
  > {
    return this.prisma(tx).journalEntry.findMany({
      where: {
        companyId,
        status: opts.onlyPosted !== false ? 'POSTED' : undefined,
        entryDate: { gte: opts.dateFrom, lte: opts.dateTo },
        lines: { some: { accountId: { in: opts.accountIds } } },
      },
      select: { id: true, referenceType: true, referenceId: true },
      orderBy: { entryDate: 'asc' },
    });
  }

  /**
   * G15-07-C3-C — resolve reference attributes for a bounded id set
   * (reversal inheritance: a REVERSAL entry points at its original JE).
   */
  async findJournalEntriesByIds(
    companyId: string,
    ids: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<
    {
      id: string;
      referenceType: string | null;
      referenceId: string | null;
    }[]
  > {
    if (ids.length === 0) return [];
    return this.prisma(tx).journalEntry.findMany({
      where: { companyId, id: { in: ids } },
      select: { id: true, referenceType: true, referenceId: true },
    });
  }

  /**
   * Find a financial period by company and date range.
   */
  async findFinancialPeriodByDate(
    where: Record<string, unknown>,
    orderBy?: Record<string, string>,
    select?: Record<string, boolean>,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).financialPeriod.findFirst({
      where,
      orderBy: orderBy as Record<string, 'asc' | 'desc'> | undefined,
      select: select as Prisma.FinancialPeriodSelect | undefined,
    });
  }
}
