/**
 * G16-N-8-A — REVERSED semantics in journal-based financial aggregates.
 *
 * Unit level: pin the EXACT Prisma predicates the repository emits, because
 * the reversal-neutral behavior is entirely encoded in the `where` shape:
 *   - positional reads exclude ONLY referenceType='REVERSAL' (the GlEngine
 *     compensation whose original was flipped POSTED -> REVERSED);
 *   - FINANCIAL_TRANSACTION_REVERSAL / SUPPLIER_PAYMENT_REVERSAL must stay
 *     included (their originals stay POSTED, so both legs net to zero);
 *   - NULL referenceType must stay included (the column is nullable and
 *     PostgreSQL three-valued logic drops NULL under `not`/`notIn`/`NOT`);
 *   - `includeReversalCompensations: true` restores REVERSAL rows for the
 *     cash-flow movement partitions;
 *   - companyId scoping is untouched.
 */
import { LedgerRepository } from '../ledger.repository';
import { PrismaService } from '../../../../common/prisma';

describe('LedgerRepository — G16-N-8-A reversal predicates', () => {
  let repo: LedgerRepository;
  let groupBy: jest.Mock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  const aggResult = [
    { accountId: 'acc-1', _sum: { debit: '10', credit: '0' } },
  ];

  /**
   * Evaluate an emitted `where.journalEntry.OR` disjunction the way
   * PostgreSQL would, including three-valued logic. Returns true when a row
   * with the given referenceType survives the predicate.
   */
  const survives = (or: unknown, referenceType: string | null): boolean => {
    if (or === undefined) return true;
    const branches = or as Record<string, unknown>[];
    return branches.some((b) => {
      if ('referenceType' in b && b.referenceType === null) {
        return referenceType === null;
      }
      const inner = (b.referenceType ?? {}) as { not?: string };
      if (typeof inner.not === 'string') {
        // SQL: referenceType <> 'X' -> NULL when referenceType IS NULL.
        if (referenceType === null) return false;
        return referenceType !== inner.not;
      }
      throw new Error(`unsupported branch: ${JSON.stringify(b)}`);
    });
  };

  beforeEach(() => {
    groupBy = jest.fn().mockResolvedValue(aggResult);
    prisma = {
      journalLine: { groupBy },
    };
    repo = new LedgerRepository(prisma as unknown as PrismaService);
  });

  describe('aggregatedJournalLines', () => {
    it('excludes ONLY referenceType=REVERSAL by default (positional semantics)', async () => {
      await repo.aggregatedJournalLines('comp-1', {});

      expect(groupBy).toHaveBeenCalledTimes(1);
      const where = groupBy.mock.calls[0][0].where.journalEntry;
      expect(where.status).toBe('POSTED');
      expect(where.OR).toEqual([
        { referenceType: null },
        { referenceType: { not: 'REVERSAL' } },
      ]);
      // The exclusion must be expressed as a disjunction, never as a bare
      // top-level `not` / `notIn` / `NOT` — those drop NULL rows in PG.
      expect(where.referenceType).toBeUndefined();
      expect(where.NOT).toBeUndefined();
    });

    it('retains entries whose referenceType IS NULL (nullable column regression guard)', async () => {
      await repo.aggregatedJournalLines('comp-1', {});
      const where = groupBy.mock.calls[0][0].where.journalEntry;

      expect(survives(where.OR, null)).toBe(true);
      expect(survives(where.OR, 'REVERSAL')).toBe(false);
    });

    it('keeps FINANCIAL_TRANSACTION_REVERSAL rows included', async () => {
      // The exclusion is a single `not: 'REVERSAL'` branch — any other
      // referenceType passes the predicate. Prove it by evaluating the
      // emitted shape the same way PostgreSQL would.
      await repo.aggregatedJournalLines('comp-1', {});
      const where = groupBy.mock.calls[0][0].where.journalEntry;
      const notValue = (where.OR[1].referenceType as { not: string }).not;

      expect(notValue).toBe('REVERSAL');
      expect(notValue).not.toBe('FINANCIAL_TRANSACTION_REVERSAL');
      expect(survives(where.OR, 'FINANCIAL_TRANSACTION_REVERSAL')).toBe(true);
    });

    it('keeps SUPPLIER_PAYMENT_REVERSAL rows included', async () => {
      await repo.aggregatedJournalLines('comp-1', {});
      const where = groupBy.mock.calls[0][0].where.journalEntry;

      expect(survives(where.OR, 'SUPPLIER_PAYMENT_REVERSAL')).toBe(true);
    });

    it('does not restrict referenceType when onlyPosted is false (detail mode unchanged)', async () => {
      await repo.aggregatedJournalLines('comp-1', { onlyPosted: false });
      const where = groupBy.mock.calls[0][0].where.journalEntry;

      expect(where.status).toBeUndefined();
      expect(where.referenceType).toBeUndefined();
      expect(where.OR).toBeUndefined();
    });

    it('keeps other filters (companyId, asOfDate, accountType) intact', async () => {
      await repo.aggregatedJournalLines('comp-1', {
        asOfDate: new Date('2026-06-30T23:59:59Z'),
        accountType: 'CASH',
      });
      const args = groupBy.mock.calls[0][0];
      const where = args.where.journalEntry;

      expect(where.companyId).toBe('comp-1');
      expect(where.entryDate).toEqual({
        lte: new Date('2026-06-30T23:59:59Z'),
      });
      expect(args.where.account).toEqual({ accountType: 'CASH' });
    });
  });

  describe('aggregatedCashFlowLines', () => {
    it('excludes REVERSAL by default (positions: beginning/ending cash)', async () => {
      await repo.aggregatedCashFlowLines('comp-1', { accountIds: ['a1'] });

      const where = groupBy.mock.calls[0][0].where.journalEntry;
      expect(where.status).toBe('POSTED');
      expect(where.OR).toEqual([
        { referenceType: null },
        { referenceType: { not: 'REVERSAL' } },
      ]);
    });

    it('retains NULL referenceType in positions too', async () => {
      await repo.aggregatedCashFlowLines('comp-1', { accountIds: ['a1'] });
      const where = groupBy.mock.calls[0][0].where.journalEntry;

      expect(survives(where.OR, null)).toBe(true);
      expect(survives(where.OR, 'REVERSAL')).toBe(false);
    });

    it('includeReversalCompensations=true restores REVERSAL rows', async () => {
      await repo.aggregatedCashFlowLines('comp-1', {
        accountIds: ['a1'],
        includeReversalCompensations: true,
      });

      const where = groupBy.mock.calls[0][0].where.journalEntry;
      expect(where.status).toBe('POSTED');
      expect(where.OR).toBeUndefined();
      expect(where.referenceType).toBeUndefined();
    });

    it('explicit referenceType filter still wins when provided (movement partitions unchanged)', async () => {
      await repo.aggregatedCashFlowLines('comp-1', {
        referenceType: 'SUPPLIER_PAYMENT',
        includeReversalCompensations: true,
      });

      const where = groupBy.mock.calls[0][0].where.journalEntry;
      // With opt-in, no `not` filter is added; the explicit filter must remain
      expect(where.referenceType).toBe('SUPPLIER_PAYMENT');
    });

    it('explicit referenceType replaces the positional exclusion instead of AND-ing onto it', async () => {
      await repo.aggregatedCashFlowLines('comp-1', {
        referenceType: 'SUPPLIER_PAYMENT',
      });

      const where = groupBy.mock.calls[0][0].where.journalEntry;
      expect(where.referenceType).toBe('SUPPLIER_PAYMENT');
      expect(where.OR).toBeUndefined();
    });

    it('companyId isolation remains', async () => {
      await repo.aggregatedCashFlowLines('comp-A', { accountIds: ['a1'] });
      expect(groupBy.mock.calls[0][0].where.journalEntry.companyId).toBe(
        'comp-A',
      );

      await repo.aggregatedCashFlowLines('comp-B', { accountIds: ['a1'] });
      expect(groupBy.mock.calls[1][0].where.journalEntry.companyId).toBe(
        'comp-B',
      );
    });
  });

  describe('findCashJournalEntries (enumeration unchanged)', () => {
    it('still lists POSTED entries with no referenceType restriction', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      prisma.journalEntry = { findMany };

      await repo.findCashJournalEntries('comp-1', {
        accountIds: ['a1'],
        dateFrom: new Date('2026-01-01T00:00:00Z'),
        dateTo: new Date('2026-12-31T23:59:59Z'),
      });

      const where = findMany.mock.calls[0][0].where;
      expect(where.status).toBe('POSTED');
      expect(where.referenceType).toBeUndefined();
    });
  });
});
