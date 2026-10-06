/**
 * G16-N-7 — FiscalYearCloseService correctness.
 *
 * The mocks here deliberately behave like the database rather than like a
 * stub:
 *  - `accountBalance.groupBy` FILTERS by the requested `financialPeriodId`
 *    and then aggregates per account, so period scoping is genuinely
 *    exercised (the pre-G16-N-7 suite returned one hand-written row per
 *    account, which is why D1/D2/D3 went unnoticed);
 *  - `periodsRepository.update` performs a real `rowVersion` compare-and-set
 *    and throws ConflictException on a mismatch, so P2-C is exercised.
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { FiscalYearCloseService } from '../services/fiscal-year-close.service';
import { PostingValidationService } from '../services/posting-validation.service';

const companyId = 'comp-1';
const userId = 'user-1';
const RE = 're-3200';
const REV = 'rev-1';
const EXP = 'exp-1';

const openPeriod = (month: number, over: Record<string, any> = {}) => ({
  id: `period-${month}`,
  companyId,
  year: 2026,
  month,
  name: `2026-${month}`,
  startDate: new Date(Date.UTC(2026, month - 1, 1)),
  endDate: new Date(Date.UTC(2026, month, 0)),
  status: 'OPEN',
  rowVersion: 0,
  ...over,
});

const baseYear = {
  id: 'fy-1',
  companyId,
  year: 2026,
  isClosed: false,
  retainedEarningsAccountId: null,
};

const retainedEarningsAccount = (over: Record<string, any> = {}) => ({
  id: RE,
  companyId,
  code: '3200',
  name: 'Retained Earnings',
  accountType: 'EQUITY',
  normalBalance: 'CREDIT',
  isActive: true,
  isSystem: true,
  deletedAt: null,
  ...over,
});

interface BalanceRow {
  accountId: string;
  financialPeriodId: string;
  closingDebit: string;
  closingCredit: string;
}

/**
 * Build an `accountBalance.groupBy` mock that behaves like Postgres:
 * honour both `accountId.in` and `financialPeriodId.in`, then SUM per account.
 */
const makeGroupBy = (rows: BalanceRow[]) =>
  jest.fn(async (args: any) => {
    const accountIds: string[] = args.where.accountId?.in ?? [];
    const periodIds: string[] = args.where.financialPeriodId?.in ?? [];
    const filtered = rows.filter(
      (r) =>
        accountIds.includes(r.accountId) &&
        periodIds.includes(r.financialPeriodId),
    );
    const byAccount = new Map<string, { d: Decimal; c: Decimal }>();
    for (const r of filtered) {
      const cur = byAccount.get(r.accountId) ?? {
        d: new Decimal(0),
        c: new Decimal(0),
      };
      cur.d = cur.d.add(new Decimal(r.closingDebit));
      cur.c = cur.c.add(new Decimal(r.closingCredit));
      byAccount.set(r.accountId, cur);
    }
    return [...byAccount.entries()].map(([accountId, v]) => ({
      accountId,
      _sum: { closingDebit: v.d, closingCredit: v.c },
    }));
  });

/** Real rowVersion CAS emulation, mirroring FinancialPeriodsRepository.update. */
const makePeriodsRepository = (periods: any[]) => {
  const store = new Map(periods.map((p) => [p.id, { ...p }]));
  const update = jest.fn(
    async (id: string, data: any, cid: string, rowVersion: number) => {
      const cur = store.get(id);
      if (!cur || cur.companyId !== cid) {
        throw new NotFoundException('Financial period not found');
      }
      if (cur.rowVersion !== rowVersion) {
        throw new ConflictException(
          'Financial period was modified by another user',
        );
      }
      cur.status = data.status;
      cur.closedAt = data.closedAt;
      cur.rowVersion += 1;
      return { ...cur };
    },
  );
  return { repository: { update } as any, update, store };
};

const linesOf = (call: any) => call[0].lines as any[];
const totalOf = (lines: any[], side: 'debit' | 'credit') =>
  lines.reduce((a, l) => a.add(new Decimal(l[side] || '0')), new Decimal(0));

describe('FiscalYearCloseService (G16-N-7)', () => {
  let service: FiscalYearCloseService;
  let mockTx: any;
  let mockPrisma: any;
  let mockGlEngine: any;
  let mockAuditLog: any;
  let periodsRepo: ReturnType<typeof makePeriodsRepository>;
  let groupBy: jest.Mock;

  const periods: any[] = [];

  const setPeriods = (rows: any[]) => {
    periods.length = 0;
    rows.forEach((r) => periods.push(r));
    periodsRepo = makePeriodsRepository(periods);
    mockTx.financialPeriod.findMany.mockResolvedValue(
      periods.map((p) => ({ ...p })),
    );
    service = new FiscalYearCloseService(
      mockPrisma,
      mockGlEngine,
      mockAuditLog,
      periodsRepo.repository,
    );
  };

  const setIncomeAccounts = () => {
    // Behaves like Postgres: honours the accountType predicate, so the service
    // receives REVENUE and EXPENSE rows in the right buckets (a mock that
    // ignored `where` would hand back every account twice).
    mockTx.chartOfAccount.findMany.mockImplementation(async (args: any) =>
      [
        { id: REV, accountType: 'REVENUE', name: 'Sales' },
        { id: EXP, accountType: 'EXPENSE', name: 'COGS' },
      ].filter((a) => a.accountType === args.where.accountType),
    );
  };

  beforeEach(() => {
    mockTx = {
      fiscalYear: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      financialPeriod: { findMany: jest.fn(), update: jest.fn() },
      chartOfAccount: { findFirst: jest.fn(), findMany: jest.fn() },
      accountBalance: { groupBy: jest.fn() },
    };
    mockPrisma = { $transaction: jest.fn((cb: any) => cb(mockTx)) };
    mockGlEngine = { post: jest.fn().mockResolvedValue({ id: 'je-close' }) };
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };
    groupBy = makeGroupBy([]);
    mockTx.accountBalance.groupBy = groupBy;
    mockTx.fiscalYear.findFirst.mockResolvedValue({ ...baseYear });
    mockTx.chartOfAccount.findFirst.mockResolvedValue(
      retainedEarningsAccount(),
    );
  });

  // 1. single-period FY
  it('closes a single-period fiscal year', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '1000',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '200',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );

    const result = await service.closeFiscalYear(companyId, 2026, userId);

    expect(result.closedPeriodIds).toEqual(['period-1']);
    expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
  });

  // 2. multi-period FY — 12 monthly periods
  it('closes a 12-period fiscal year and posts once', async () => {
    setIncomeAccounts();
    const months = Array.from({ length: 12 }, (_, i) => openPeriod(i + 1));
    setPeriods(months);
    groupBy.mockImplementation(
      makeGroupBy(
        months.flatMap((p) => [
          {
            accountId: REV,
            financialPeriodId: p.id,
            closingDebit: '0',
            closingCredit: '1000',
          },
          {
            accountId: EXP,
            financialPeriodId: p.id,
            closingDebit: '200',
            closingCredit: '0',
          },
        ]),
      ).getMockImplementation()!,
    );

    const result = await service.closeFiscalYear(companyId, 2026, userId);

    expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
    expect(result.closedPeriodIds).toHaveLength(12);
    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    // true profit = 12000 - 2400 = 9600
    expect(lines.find((l) => l.accountId === RE)!.credit).toBe('9600.0000');
  });

  // 3. multiple AccountBalance rows per account (the real schema shape)
  it('sums multiple balance rows per account instead of reading one', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1), openPeriod(2)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '1000',
        },
        {
          accountId: REV,
          financialPeriodId: 'period-2',
          closingDebit: '0',
          closingCredit: '1000',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '150',
          closingCredit: '0',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-2',
          closingDebit: '150',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );

    await service.closeFiscalYear(companyId, 2026, userId);

    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    expect(lines.find((l) => l.accountId === REV)!.debit).toBe('2000.0000');
    expect(lines.find((l) => l.accountId === EXP)!.credit).toBe('300.0000');
    expect(lines.find((l) => l.accountId === RE)!.credit).toBe('1700.0000');
  });

  // 4. prior-year rows must not leak into the close
  it('excludes prior-year balance rows', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1), openPeriod(2)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '1000',
        },
        {
          accountId: REV,
          financialPeriodId: 'period-2',
          closingDebit: '0',
          closingCredit: '1000',
        },
        {
          accountId: REV,
          financialPeriodId: 'period-2025-1',
          closingDebit: '0',
          closingCredit: '999999',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '200',
          closingCredit: '0',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-2025-1',
          closingDebit: '999999',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );

    await service.closeFiscalYear(companyId, 2026, userId);

    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    expect(lines.find((l) => l.accountId === REV)!.debit).toBe('2000.0000');
    expect(lines.find((l) => l.accountId === RE)!.credit).toBe('1800.0000');
    // the query itself must carry the period scope (D1 structural guard)
    const where = groupBy.mock.calls[0][0].where;
    expect(where.financialPeriodId.in).toEqual(['period-1', 'period-2']);
  });

  // 5/9/12/13. normal revenue + expense -> profit, balanced, RE correct
  it('zeroes revenue and expense and credits retained earnings for a profit year', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '1000',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '200',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );

    const result = await service.closeFiscalYear(companyId, 2026, userId);

    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    expect(lines.find((l) => l.accountId === REV)!.debit).toBe('1000.0000');
    expect(lines.find((l) => l.accountId === EXP)!.credit).toBe('200.0000');
    expect(lines.find((l) => l.accountId === RE)!.credit).toBe('800.0000');
    // 12. balanced
    expect(totalOf(lines, 'debit').equals(totalOf(lines, 'credit'))).toBe(true);
    expect(result.retainedEarningsEntryId).toBe('je-close');
  });

  // 6. contra revenue (refund larger than sales in the year)
  it('treats contra revenue as a debit balance rather than adding abs()', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '300',
          closingCredit: '0',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '100',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );

    await service.closeFiscalYear(companyId, 2026, userId);

    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    // revenue is now debit-normal -> credit it to zero
    expect(lines.find((l) => l.accountId === REV)!.credit).toBe('300.0000');
    expect(lines.find((l) => l.accountId === EXP)!.credit).toBe('100.0000');
    // profit = -300 + -100 = -400 -> loss
    expect(lines.find((l) => l.accountId === RE)!.debit).toBe('400.0000');
    expect(totalOf(lines, 'debit').equals(totalOf(lines, 'credit'))).toBe(true);
  });

  // 8. contra expense (credit note)
  it('treats contra expense as a credit balance', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '10000',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '6000',
          closingCredit: '1500',
        },
      ]).getMockImplementation()!,
    );

    await service.closeFiscalYear(companyId, 2026, userId);

    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    expect(lines.find((l) => l.accountId === EXP)!.credit).toBe('4500.0000');
    // profit = 10000 - 4500 = 5500
    expect(lines.find((l) => l.accountId === RE)!.credit).toBe('5500.0000');
    expect(totalOf(lines, 'debit').equals(totalOf(lines, 'credit'))).toBe(true);
  });

  // 10. loss year
  it('debits retained earnings for a loss year', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '3000',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '8000',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );

    await service.closeFiscalYear(companyId, 2026, userId);

    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    expect(lines.find((l) => l.accountId === RE)!.debit).toBe('5000.0000');
    expect(totalOf(lines, 'debit').equals(totalOf(lines, 'credit'))).toBe(true);
  });

  // 11/14. zero-profit year still emits zeroing lines, no RE line
  it('emits account-zeroing lines with NO retained-earnings line at zero profit', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '500',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '500',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );

    const result = await service.closeFiscalYear(companyId, 2026, userId);

    expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    expect(lines.some((l) => l.accountId === RE)).toBe(false);
    expect(lines.find((l) => l.accountId === REV)!.debit).toBe('500.0000');
    expect(lines.find((l) => l.accountId === EXP)!.credit).toBe('500.0000');
    expect(totalOf(lines, 'debit').equals(totalOf(lines, 'credit'))).toBe(true);
    expect(result.closedPeriodIds).toEqual(['period-1']);
  });

  // nothing to post: every income account nets to zero
  it('closes without a journal when every income account is already zero', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1)]);
    groupBy.mockImplementation(makeGroupBy([]).getMockImplementation()!);

    const result = await service.closeFiscalYear(companyId, 2026, userId);

    expect(mockGlEngine.post).not.toHaveBeenCalled();
    expect(result.retainedEarningsEntryId).toBe('');
    expect(result.closedPeriodIds).toEqual(['period-1']);
  });

  // 15. failed close leaves no final state
  it('rolls everything back when the closing journal fails', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '1000',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '200',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );
    mockGlEngine.post.mockRejectedValue(new BadRequestException('unbalanced'));

    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow('unbalanced');
    expect(mockTx.fiscalYear.update).not.toHaveBeenCalled();
    expect(mockAuditLog.log).not.toHaveBeenCalled();
  });

  // 16/17. closePeriods CAS
  it('closes periods through the repository CAS with companyId and rowVersion', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1), openPeriod(2)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '1000',
        },
      ]).getMockImplementation()!,
    );

    await service.closeFiscalYear(companyId, 2026, userId);

    expect(periodsRepo.update).toHaveBeenCalled();
    for (const call of periodsRepo.update.mock.calls) {
      expect(call[2]).toBe(companyId); // companyId scoped
      expect(typeof call[3]).toBe('number'); // rowVersion predicate
    }
  });

  it('propagates ConflictException and aborts the close when a period CAS is lost', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1), openPeriod(2)]);
    groupBy.mockImplementation(makeGroupBy([]).getMockImplementation()!);
    periodsRepo.update.mockRejectedValueOnce(
      new ConflictException('Financial period was modified by another user'),
    );

    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(ConflictException);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
    expect(mockTx.fiscalYear.update).not.toHaveBeenCalled();
    expect(mockAuditLog.log).not.toHaveBeenCalled();
  });

  // 18. combined regression: multi-period + contra balances together
  it('balances the closing journal for multi-period contra balances', async () => {
    setIncomeAccounts();
    const months = [1, 2, 3].map((m) => openPeriod(m));
    setPeriods(months);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '10000',
        },
        {
          accountId: REV,
          financialPeriodId: 'period-2',
          closingDebit: '2000',
          closingCredit: '0',
        },
        {
          accountId: REV,
          financialPeriodId: 'period-3',
          closingDebit: '0',
          closingCredit: '500',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '6000',
          closingCredit: '0',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-2',
          closingDebit: '0',
          closingCredit: '1500',
        },
      ]).getMockImplementation()!,
    );

    await service.closeFiscalYear(companyId, 2026, userId);

    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    // revenue signed = (10000+500) - 2000 = 8500 -> Dr 8500
    expect(lines.find((l) => l.accountId === REV)!.debit).toBe('8500.0000');
    // expense signed = 1500 - 6000 = -4500 -> Cr 4500
    expect(lines.find((l) => l.accountId === EXP)!.credit).toBe('4500.0000');
    // profit = 8500 - 4500 = 4000
    expect(lines.find((l) => l.accountId === RE)!.credit).toBe('4000.0000');
    expect(totalOf(lines, 'debit').equals(totalOf(lines, 'credit'))).toBe(true);
  });

  // ordering: non-posting periods close BEFORE the aggregate is read
  it('closes the non-posting periods before aggregating', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1), openPeriod(12)]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '1000',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '200',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );

    await service.closeFiscalYear(companyId, 2026, userId);

    const firstCloseOrder = periodsRepo.update.mock.invocationCallOrder[0]!;
    const groupByOrder = groupBy.mock.invocationCallOrder[0]!;
    expect(firstCloseOrder).toBeLessThan(groupByOrder);
    // the posting period is the LATEST OPEN period (G15-01 semantic preserved)
    expect(mockGlEngine.post.mock.calls[0][0].financialPeriodId).toBe(
      'period-12',
    );
  });

  it('fails with BadRequest when a journal is required but no OPEN period remains', async () => {
    setIncomeAccounts();
    setPeriods([openPeriod(1, { status: 'CLOSED' })]);
    groupBy.mockImplementation(
      makeGroupBy([
        {
          accountId: REV,
          financialPeriodId: 'period-1',
          closingDebit: '0',
          closingCredit: '1000',
        },
        {
          accountId: EXP,
          financialPeriodId: 'period-1',
          closingDebit: '200',
          closingCredit: '0',
        },
      ]).getMockImplementation()!,
    );

    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(/requires an OPEN period|only accepts an OPEN period/);
  });
});

describe('FiscalYearCloseService CAS claim (G15-03-01)', () => {
  let service: FiscalYearCloseService;
  let mockTx: any;
  let mockPrisma: any;
  let mockGlEngine: any;
  let mockAuditLog: any;
  let periodsRepo: ReturnType<typeof makePeriodsRepository>;

  beforeEach(() => {
    mockTx = {
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue({ ...baseYear }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      financialPeriod: {
        findMany: jest.fn().mockResolvedValue([openPeriod(12)]),
        update: jest.fn().mockResolvedValue({}),
      },
      chartOfAccount: {
        findFirst: jest.fn().mockResolvedValue(retainedEarningsAccount()),
        findMany: jest.fn().mockResolvedValue([
          { id: REV, accountType: 'REVENUE', name: 'Sales' },
          { id: EXP, accountType: 'EXPENSE', name: 'COGS' },
        ]),
      },
      accountBalance: {
        groupBy: makeGroupBy([
          {
            accountId: REV,
            financialPeriodId: 'period-12',
            closingDebit: '0',
            closingCredit: '1000',
          },
          {
            accountId: EXP,
            financialPeriodId: 'period-12',
            closingDebit: '200',
            closingCredit: '0',
          },
        ]),
      },
    };
    mockPrisma = { $transaction: jest.fn((cb: any) => cb(mockTx)) };
    mockGlEngine = { post: jest.fn().mockResolvedValue({ id: 'je-close-1' }) };
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };
    periodsRepo = makePeriodsRepository([openPeriod(12)]);
    service = new FiscalYearCloseService(
      mockPrisma,
      mockGlEngine,
      mockAuditLog,
      periodsRepo.repository,
    );
  });

  it('CAS-claims the year before posting exactly one closing journal', async () => {
    const result = await service.closeFiscalYear(companyId, 2026, userId);

    expect(mockTx.fiscalYear.updateMany).toHaveBeenCalledWith({
      where: { id: 'fy-1', companyId, isClosed: false },
      data: { rowVersion: { increment: 1 } },
    });
    expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
    expect(mockGlEngine.post).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'FISCAL_YEAR_CLOSE',
        referenceId: 'fy-1',
      }),
      mockTx,
    );
    expect(result.retainedEarningsEntryId).toBe('je-close-1');
    expect(
      mockTx.fiscalYear.updateMany.mock.invocationCallOrder[0]!,
    ).toBeLessThan(mockGlEngine.post.mock.invocationCallOrder[0]!);
  });

  it('rejects a concurrent close with ConflictException and posts nothing', async () => {
    mockTx.fiscalYear.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(ConflictException);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
    expect(periodsRepo.update).not.toHaveBeenCalled();
    expect(mockAuditLog.log).not.toHaveBeenCalled();
  });

  it('leaves no final close mutations when posting fails after the CAS', async () => {
    mockGlEngine.post.mockRejectedValue(
      new BadRequestException('posting failed'),
    );

    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow('posting failed');
    expect(mockTx.fiscalYear.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.fiscalYear.update).not.toHaveBeenCalled();
    expect(mockAuditLog.log).not.toHaveBeenCalled();
  });

  it('scopes the CAS claim to the company', async () => {
    await service.closeFiscalYear(companyId, 2026, userId);
    expect(mockTx.fiscalYear.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId }),
      }),
    );
  });
});

describe('FiscalYearCloseService retained-earnings validation (G15-07-C1)', () => {
  let service: FiscalYearCloseService;
  let mockTx: any;
  let mockPrisma: any;
  let mockGlEngine: any;
  let mockAuditLog: any;

  const build = () => {
    mockTx = {
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue({ ...baseYear }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      financialPeriod: {
        findMany: jest.fn().mockResolvedValue([openPeriod(12)]),
        update: jest.fn().mockResolvedValue({}),
      },
      chartOfAccount: { findFirst: jest.fn(), findMany: jest.fn() },
      accountBalance: {
        groupBy: makeGroupBy([
          {
            accountId: REV,
            financialPeriodId: 'period-12',
            closingDebit: '0',
            closingCredit: '1000',
          },
          {
            accountId: EXP,
            financialPeriodId: 'period-12',
            closingDebit: '200',
            closingCredit: '0',
          },
        ]),
      },
    };
    mockPrisma = { $transaction: jest.fn((cb: any) => cb(mockTx)) };
    mockGlEngine = { post: jest.fn().mockResolvedValue({ id: 'je-1' }) };
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };
    service = new FiscalYearCloseService(
      mockPrisma,
      mockGlEngine,
      mockAuditLog,
      makePeriodsRepository([openPeriod(12)]).repository,
    );
    mockTx.chartOfAccount.findMany.mockResolvedValue([
      { id: REV, accountType: 'REVENUE', name: 'Sales' },
      { id: EXP, accountType: 'EXPENSE', name: 'COGS' },
    ]);
  };

  beforeEach(build);

  it('resolves a valid code-3200 EQUITY/CREDIT account, company-scoped', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue(
      retainedEarningsAccount(),
    );
    await service.closeFiscalYear(companyId, 2026, userId);
    expect(mockTx.chartOfAccount.findFirst).toHaveBeenCalledWith({
      where: { companyId, code: '3200', isActive: true, deletedAt: null },
    });
    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    expect(lines.some((l: any) => l.accountId === RE)).toBe(true);
  });

  it('rejects a 3200 account with the wrong accountType', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue(
      retainedEarningsAccount({ accountType: 'ASSET' }),
    );
    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(/EQUITY/);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
  });

  it('rejects a 3200 account with the wrong normalBalance', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue(
      retainedEarningsAccount({ normalBalance: 'DEBIT' }),
    );
    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(/CREDIT/);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
  });

  it('rejects when the 3200 account is inactive or soft-deleted', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue(null);
    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(/retained earnings/i);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
  });

  it('validates and uses a retainedEarningsAccountId override', async () => {
    mockTx.fiscalYear.findFirst.mockResolvedValue({
      ...baseYear,
      retainedEarningsAccountId: 're-custom',
    });
    mockTx.chartOfAccount.findFirst.mockResolvedValue(
      retainedEarningsAccount({
        id: 're-custom',
        code: '3900',
        isSystem: false,
      }),
    );
    await service.closeFiscalYear(companyId, 2026, userId);
    const lines = linesOf(mockGlEngine.post.mock.calls[0]);
    expect(lines.some((l: any) => l.accountId === 're-custom')).toBe(true);
  });

  it('rejects an override of the wrong account type', async () => {
    mockTx.fiscalYear.findFirst.mockResolvedValue({
      ...baseYear,
      retainedEarningsAccountId: 're-custom',
    });
    mockTx.chartOfAccount.findFirst.mockResolvedValue(
      retainedEarningsAccount({
        id: 're-custom',
        accountType: 'LIABILITY',
      }),
    );
    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(/EQUITY/);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
  });

  it('rejects an override that is inactive or soft-deleted', async () => {
    mockTx.fiscalYear.findFirst.mockResolvedValue({
      ...baseYear,
      retainedEarningsAccountId: 're-gone',
    });
    mockTx.chartOfAccount.findFirst.mockResolvedValue(null);
    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(BadRequestException);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
  });

  it('rejects a cross-company override', async () => {
    mockTx.fiscalYear.findFirst.mockResolvedValue({
      ...baseYear,
      retainedEarningsAccountId: 're-other-company',
    });
    mockTx.chartOfAccount.findFirst.mockResolvedValue(null);
    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(/another company/i);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
  });
});

describe('PostingValidationService CLOSED-period guard (G15-01)', () => {
  it('posting into a CLOSED period remains rejected', async () => {
    const validation = new PostingValidationService();
    const tx = {
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p-dec',
          companyId,
          name: '2026-12',
          status: 'CLOSED',
          startDate: new Date(Date.UTC(2026, 11, 1)),
          endDate: new Date(Date.UTC(2026, 11, 31)),
        }),
      },
      chartOfAccount: { findMany: jest.fn() },
    } as any;

    await expect(
      validation.validate(
        {
          companyId,
          entryDate: new Date(Date.UTC(2026, 11, 15)),
          financialPeriodId: 'p-dec',
          lines: [
            { accountId: 'a1', debit: '100.0000', credit: '0' },
            { accountId: 'a2', debit: '0', credit: '100.0000' },
          ],
        },
        tx,
      ),
    ).rejects.toThrow(/Only OPEN periods accept postings/);
  });
});
