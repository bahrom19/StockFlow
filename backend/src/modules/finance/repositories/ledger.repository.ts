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
   *
   * G16-N-8-B (R4): ordering is `entryDate ASC, id ASC`. `entryDate` alone is
   * NOT unique, so a skip/take page loop over it can skip or duplicate rows
   * across pages. `id` is the primary key and therefore a stable, total
   * tiebreaker; adding it changes no observable ordering (it only orders rows
   * that previously tied) and makes multi-page iteration provably complete.
   * The P&L daily page loop depends on this.
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
      orderBy: [
        { journalEntry: { entryDate: 'asc' as const } },
        { id: 'asc' as const },
      ],
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
   * G16-N-8-B — CANONICAL positional journal-entry population predicate.
   *
   * This factory is the single source of truth for which journal entries a
   * *positional* financial report may see. It exists because a positional
   * aggregate must be economically neutral for a GlEngine reversal, and that
   * rule was previously re-implemented by hand at each call site — G16-N-8-B
   * found `getPnlReport().daily` carrying its own inline copy of the status
   * filter without the reversal exclusion, which silently desynchronised the
   * P&L headline from its own daily breakdown.
   *
   * Ownership: this lives in the repository because the repository owns every
   * Prisma predicate in the finance ledger, so a caller cannot construct a
   * divergent copy without deliberately bypassing this method. It is PUBLIC by
   * design: LedgerQueryService.getPnlReport() consumes it so that the P&L
   * daily series and the P&L header totals are guaranteed to describe one and
   * the same population.
   *
   * Canonical semantics:
   *   - companyId: ALWAYS present (tenant isolation is not optional);
   *   - status: 'POSTED' unless the caller explicitly opts out;
   *   - referenceType: NULL OR != 'REVERSAL'.
   *
   * Why the disjunction and not `{ not: 'REVERSAL' }`: referenceType is
   * NULLABLE (GlEngineService writes `input.referenceType ?? null`), and
   * PostgreSQL three-valued logic makes a bare `not`/`notIn`/`NOT (=)` evaluate
   * to NULL for a NULL column, i.e. DROP the row. Verified against real
   * PostgreSQL: the bare form discarded every NULL-referenceType entry that the
   * pre-G16-N-8-A status-only filter did include.
   *
   * Why ONLY the GlEngine reversal taxonomy is excluded: a GlEngine reversal
   * flips its original POSTED -> REVERSED (so the status filter already
   * removes it) and posts a compensating entry with referenceType='REVERSAL'.
   * Excluding exactly that compensation makes the pair contribute zero,
   * matching the AccountBalance snapshot layer. FINANCIAL_TRANSACTION_REVERSAL
   * and SUPPLIER_PAYMENT_REVERSAL use a different lifecycle — their original
   * JE stays POSTED — so both of their legs must remain included in order to
   * net to zero naturally.
   *
   * Account LIFECYCLE deliberately plays no part here: `isActive`/`deletedAt`
   * gate future posting targets and API visibility (see
   * FinanceIntegrationService's posting lookup), never historical accounting.
   * An account deactivated after posting still owns real historical amounts
   * that must stay in every financial statement.
   */
  positionalJournalEntryWhere(
    companyId: string,
    opts: {
      asOfDate?: Date;
      dateFrom?: Date;
      dateTo?: Date;
      onlyPosted?: boolean;
    } = {},
  ): Record<string, any> {
    const entryWhere: Record<string, any> = { companyId };
    if (opts.onlyPosted !== false) {
      entryWhere.status = 'POSTED';
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
    return entryWhere;
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
    // G16-N-8-B: the population predicate now comes from the single
    // repository-owned factory, so this aggregate and getPnlReport().daily
    // cannot drift apart. The exact same NULL-safe reversal exclusion
    // semantics as G16-N-8-A are preserved verbatim inside that factory.
    const entryWhere = this.positionalJournalEntryWhere(companyId, {
      asOfDate: opts.asOfDate,
      dateFrom: opts.dateFrom,
      dateTo: opts.dateTo,
      onlyPosted: opts.onlyPosted,
    });

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
    // G16-N-8-B: reuse the canonical factory so the cash-flow POSITIONAL reads
    // (beginning/ending cash) cannot drift from aggregatedJournalLines either.
    // `includeReversalCompensations: true` is the cash-flow MOVEMENT opt-out —
    // it suppresses only the reversal exclusion, never the status filter, and
    // never the companyId. Behaviour is byte-identical to the previous inline
    // construction.
    const entryWhere = this.positionalJournalEntryWhere(companyId, {
      asOfDate: opts.asOfDate,
      dateFrom: opts.dateFrom,
      dateTo: opts.dateTo,
      onlyPosted: opts.onlyPosted,
    });
    if (opts.includeReversalCompensations) {
      delete entryWhere.OR;
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
      /**
       * G16-N-8-B — opt-in inclusion of REVERSED entries so the cash-flow
       * MOVEMENT view can show BOTH legs of a GlEngine reversal.
       *
       * Why it exists: `GlEngineService.reverse()` flips the original to
       * REVERSED and posts a compensating POSTED entry with
       * referenceType='REVERSAL'. A POSTED-only enumeration therefore returns
       * the compensation but drops the original, so the movement section
       * showed a phantom one-sided inflow while the POSITIONAL balances
       * (which are reversal-neutral) said otherwise — leaving `reconciled`
       * permanently false for any period containing a reversal.
       *
       * Default MUST stay false: every existing caller relies on POSTED-only
       * enumeration, and widening a shared primitive implicitly would change
       * behaviour for all of them. Only the cash-flow movement path opts in.
       *
       * When true the caller receives POSTED ∪ REVERSED and is responsible for
       * aggregating exactly that id set (see CashFlowService, which pairs it
       * with `onlyPosted: false`).
       */
      includeReversedOriginals?: boolean;
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
        // G16-N-8-B: POSTED-only unless the caller explicitly opts into the
        // reversal-aware movement view. `onlyPosted: false` keeps its original
        // meaning of "no status filter at all".
        status: opts.includeReversedOriginals
          ? { in: ['POSTED', 'REVERSED'] }
          : opts.onlyPosted !== false
            ? 'POSTED'
            : undefined,
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
   *
   * G16-N-8-B: intentionally STATUS-AGNOSTIC and must stay that way. A
   * GlEngine reversal's original is REVERSED at the moment the compensation
   * needs to resolve it, so filtering by status here would make the original
   * unresolvable and collapse classifyEntry() to UNCLASSIFIED. Pairing is by
   * referenceType='REVERSAL' + referenceId=originalEntryId only.
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
