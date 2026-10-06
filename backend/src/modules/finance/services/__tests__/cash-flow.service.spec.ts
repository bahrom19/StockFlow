import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { CashFlowService } from '../cash-flow.service';
import { LedgerRepository } from '../../repositories/ledger.repository';
import { FinancialTransactionsRepository } from '../../repositories/financial-transactions.repository';

const dec = (v: string | number) => new Decimal(v);
const companyId = 'comp-1';

const cashAcc = (id = 'cash-1', code = '1010', name = 'Cash on hand') => ({
  id,
  code,
  name,
  accountType: 'ASSET',
  normalBalance: 'DEBIT',
  isCashOrBank: true,
  isActive: true,
  level: 0,
});

const aggRow = (accountId: string, debit: string, credit: string) => ({
  accountId,
  totalDebit: dec(debit),
  totalCredit: dec(credit),
});

const je = (id: string, referenceType: string | null, referenceId: string | null = null) => ({
  id,
  referenceType,
  referenceId,
});

describe('CashFlowService — G15-07-C3-C', () => {
  let service: CashFlowService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ledger: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ftRepo: Record<string, any>;

  /** Cumulative sums keyed by asOfDate.getTime(). */
  let cumulative: Map<number, ReturnType<typeof aggRow>[]>;
  /** Partition sums keyed by sorted JE ids. */
  let partitions: Map<string, ReturnType<typeof aggRow>[]>;
  const partKey = (ids: string[]) => [...ids].sort().join(',');

  beforeEach(async () => {
    cumulative = new Map();
    partitions = new Map();

    ledger = {
      findChartOfAccounts: jest.fn().mockResolvedValue([cashAcc()]),
      aggregatedCashFlowLines: jest.fn(
        async (_companyId: string, opts: any) => {
          if (opts.asOfDate) {
            return cumulative.get(opts.asOfDate.getTime()) ?? [];
          }
          if (opts.journalEntryIds) {
            return partitions.get(partKey(opts.journalEntryIds)) ?? [];
          }
          return [];
        },
      ),
      findCashJournalEntries: jest.fn().mockResolvedValue([]),
      findJournalEntriesByIds: jest.fn().mockResolvedValue([]),
    };
    ftRepo = {
      findTypesByIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashFlowService,
        { provide: LedgerRepository, useValue: ledger },
        { provide: FinancialTransactionsRepository, useValue: ftRepo },
      ],
    }).compile();

    service = module.get(CashFlowService);
  });

  const range = { dateFrom: new Date('2026-09-01'), dateTo: new Date('2026-09-30') };
  const call = (over: Record<string, any> = {}) =>
    service.getCashFlow({ companyId, ...range, ...over });

  // ── A/B: empty period, beginning balance ───────────────────────────

  it('A. empty period returns zeroed sections and reconciled=true', async () => {
    const result = await call();

    expect(result.beginningCash).toBe('0.0000');
    expect(result.operating.rows).toEqual([]);
    expect(result.transfers.rows).toEqual([]);
    expect(result.unclassified.rows).toEqual([]);
    expect(result.netCashMovement).toBe('0.0000');
    expect(result.endingCash).toBe('0.0000');
    expect(result.reconciled).toBe(true);
  });

  it('B. beginning balance is cumulative cash before dateFrom', async () => {
    cumulative.set(
      new Date('2026-08-31T23:59:59.999Z').getTime(),
      [aggRow('cash-1', '1000', '0')],
    );
    cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '1000', '0'),
    ]);

    const result = await call();

    expect(result.beginningCash).toBe('1000.0000');
    expect(result.endingCash).toBe('1000.0000');
    expect(result.reconciled).toBe(true);
  });

  // ── C/D/I/J: sale receipt, receivable exclusion ────────────────────

  it('C/I/J. SALE cash receipt is operating inflow; AR leg excluded', async () => {
    // JE: Dr 1010 500 / Cr 4000 500 — the revenue leg is not in population.
    ledger.findCashJournalEntries.mockResolvedValue([je('je-1', 'SALE', 's-1')]);
    partitions.set('je-1', [aggRow('cash-1', '500', '0')]);
    cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '500', '0'),
    ]);

    const result = await call();

    expect(result.netOperating).toBe('500.0000');
    expect(result.operating.rows).toHaveLength(1);
    expect(result.operating.rows[0]).toEqual(
      expect.objectContaining({
        accountCode: '1010',
        referenceType: 'SALE',
        category: 'OPERATING',
        inflow: '500.0000',
        outflow: '0.0000',
        amount: '500.0000',
      }),
    );
    expect(result.reconciled).toBe(true);
  });

  it('D. operating outflow is negative (supplier payment)', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'SUPPLIER_PAYMENT', 'p-1'),
    ]);
    partitions.set('je-1', [aggRow('cash-1', '0', '300')]);
    cumulative.set(new Date('2026-08-31T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '1000', '0'),
    ]);
    cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '1000', '300'),
    ]);

    const result = await call();

    expect(result.netOperating).toBe('-300.0000');
    expect(result.beginningCash).toBe('1000.0000');
    expect(result.endingCash).toBe('700.0000');
    expect(result.netCashMovement).toBe('-300.0000');
    expect(result.reconciled).toBe(true);
  });

  it('E/F. investing and financing are zero with no domains', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([je('je-1', 'SALE', 's-1')]);
    partitions.set('je-1', [aggRow('cash-1', '100', '0')]);

    const result = await call();

    expect(result.investing).toEqual({ rows: [], total: '0.0000' });
    expect(result.financing).toEqual({ rows: [], total: '0.0000' });
    expect(result.netInvesting).toBe('0.0000');
    expect(result.netFinancing).toBe('0.0000');
  });

  // ── G/H/P: transfers ───────────────────────────────────────────────

  it('G/H/P. BANK_TRANSFER nets zero in Transfers, excluded from Operating', async () => {
    ledger.findChartOfAccounts.mockResolvedValue([
      cashAcc('cash-1', '1010', 'Cash on hand'),
      cashAcc('bank-1', '1020', 'Bank accounts'),
    ]);
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'FINANCIAL_TRANSACTION', 'ft-1'),
    ]);
    ftRepo.findTypesByIds.mockResolvedValue([
      { id: 'ft-1', type: 'BANK_TRANSFER' },
    ]);
    partitions.set('je-1', [
      aggRow('bank-1', '200', '0'),
      aggRow('cash-1', '0', '200'),
    ]);
    cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
      aggRow('bank-1', '200', '0'),
      aggRow('cash-1', '0', '200'),
    ]);

    const result = await call();

    expect(result.netTransfers).toBe('0.0000');
    expect(result.transfers.rows).toHaveLength(2);
    expect(result.operating.rows).toEqual([]);
    expect(result.netOperating).toBe('0.0000');
    expect(result.netCashMovement).toBe('0.0000');
    expect(result.reconciled).toBe(true);
  });

  // ── K/M: refund + reversal ─────────────────────────────────────────

  it('K. REFUND cash repayment is operating outflow', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([je('je-1', 'REFUND', 'r-1')]);
    partitions.set('je-1', [aggRow('cash-1', '0', '150')]);

    const result = await call();

    expect(result.netOperating).toBe('-150.0000');
  });

  it('M. SUPPLIER_PAYMENT_REVERSAL is operating inflow', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'SUPPLIER_PAYMENT_REVERSAL', 'p-1'),
    ]);
    partitions.set('je-1', [aggRow('cash-1', '150', '0')]);

    const result = await call();

    expect(result.netOperating).toBe('150.0000');
  });

  it('V. manual REVERSAL inherits the original category and nets', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'SALE', 's-1'),
      je('je-2', 'REVERSAL', 'je-1'),
    ]);
    ledger.findJournalEntriesByIds.mockResolvedValue([
      { id: 'je-1', referenceType: 'SALE', referenceId: 's-1' },
    ]);
    // SALE and its REVERSAL are distinct (category, referenceType)
    // partitions; each nets within its own bucket.
    partitions.set('je-1', [aggRow('cash-1', '500', '0')]);
    partitions.set('je-2', [aggRow('cash-1', '0', '500')]);

    const result = await call();

    // Both legs land in Operating (inherited category) and net to zero —
    // one row per (category, referenceType), amounts opposite.
    expect(result.netOperating).toBe('0.0000');
    expect(result.operating.rows).toHaveLength(2);
    expect(result.operating.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ referenceType: 'SALE', amount: '500.0000' }),
        expect.objectContaining({
          referenceType: 'REVERSAL',
          amount: '-500.0000',
        }),
      ]),
    );
    expect(result.unclassified.rows).toEqual([]);
  });

  // ── N/O: fee + interest ────────────────────────────────────────────

  it('N/O. FEE is outflow, INTEREST is inflow (Operating)', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'FINANCIAL_TRANSACTION', 'ft-fee'),
      je('je-2', 'FINANCIAL_TRANSACTION', 'ft-int'),
    ]);
    ftRepo.findTypesByIds.mockImplementation(async (_c: string, ids: string[]) =>
      ids.map((id) => ({
        id,
        type: id === 'ft-fee' ? 'FEE' : 'INTEREST',
      })),
    );
    partitions.set('je-1,je-2', [aggRow('cash-1', '50', '25')]);

    const result = await call();

    // Partitioning is per (category, referenceType): both JEs share the
    // FINANCIAL_TRANSACTION reference but split by FT type.
    expect(result.netOperating).toBe('25.0000');
    expect(result.transfers.rows).toEqual([]);
  });

  // ── Q/R/S/T: shift movements ───────────────────────────────────────

  it.each([
    ['Q. CASH_IN posts operating inflow', '500', '0', '500.0000'],
    ['R. CASH_OUT posts operating outflow', '0', '200', '-200.0000'],
  ])('%s', async (_label, debit, credit, expected) => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'CASH_SHIFT', 'shift-1'),
    ]);
    partitions.set('je-1', [aggRow('cash-1', debit, credit)]);

    const result = await call();

    expect(result.netOperating).toBe(expected);
    expect(result.operating.rows[0]!.referenceType).toBe('CASH_SHIFT');
  });

  it('S/T. SHORTAGE is outflow, OVERAGE is inflow (Operating)', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'CASH_SHIFT', 'shift-1'),
      je('je-2', 'CASH_SHIFT', 'shift-2'),
    ]);
    partitions.set('je-1,je-2', [aggRow('cash-1', '15', '10')]);

    const result = await call();

    // Direction comes from debit-credit math, not JE labels.
    expect(result.netOperating).toBe('5.0000');
  });

  it('U. zero-difference close leaves no JE and no rows', async () => {
    const result = await call();

    expect(ledger.findCashJournalEntries).toHaveBeenCalled();
    expect(result.operating.rows).toEqual([]);
    expect(result.reconciled).toBe(true);
  });

  // ── W/X: date bounds ───────────────────────────────────────────────

  it('W/X. bounds are UTC day-inclusive and opening excludes dateFrom', async () => {
    await call();

    const rangeCall = ledger.findCashJournalEntries.mock.calls[0][1];
    expect(rangeCall.dateFrom).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    expect(rangeCall.dateTo).toEqual(new Date('2026-09-30T23:59:59.999Z'));
    // Opening is strictly before dateFromStart.
    const openingAsOf = new Date('2026-08-31T23:59:59.999Z').getTime();
    expect(
      ledger.aggregatedCashFlowLines.mock.calls.some(
        ([, opts]: any) => opts.asOfDate?.getTime() === openingAsOf,
      ),
    ).toBe(true);
  });

  it('AI. validation rejects missing/invalid/inverted dates', async () => {
    await expect(
      service.getCashFlow({ companyId }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.getCashFlow({
        companyId,
        dateFrom: new Date('not-a-date'),
        dateTo: new Date('2026-09-30'),
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.getCashFlow({
        companyId,
        dateFrom: new Date('2026-10-01'),
        dateTo: new Date('2026-09-30'),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(ledger.findChartOfAccounts).not.toHaveBeenCalled();
  });

  // ── Y/Z/AA/AB/AC: population ───────────────────────────────────────

  it('Y/Z/AB. population query is company-scoped flag filter', async () => {
    await call();

    expect(ledger.findChartOfAccounts).toHaveBeenCalledWith({
      companyId,
      isCashOrBank: true,
      isActive: true,
      deletedAt: null,
    });
    for (const [c] of ledger.aggregatedCashFlowLines.mock.calls) {
      expect(c).toBe(companyId);
    }
    for (const [c] of ledger.findCashJournalEntries.mock.calls) {
      expect(c).toBe(companyId);
    }
  });

  it('AA. custom cash accounts join the population', async () => {
    ledger.findChartOfAccounts.mockResolvedValue([
      cashAcc('cash-1', '1010', 'Cash on hand'),
      {
        ...cashAcc('petty-9', '1900', 'Petty drawer'),
        accountType: 'ASSET',
      },
    ]);
    ledger.findCashJournalEntries.mockResolvedValue([je('je-1', 'SALE', 's-1')]);
    partitions.set('je-1', [aggRow('petty-9', '75', '0')]);
    cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
      aggRow('petty-9', '75', '0'),
    ]);

    const result = await call();

    expect(result.operating.rows[0]).toEqual(
      expect.objectContaining({ accountCode: '1900', amount: '75.0000' }),
    );
    expect(result.reconciled).toBe(true);
  });

  it('AC. no cash accounts returns zeroed reconciled result', async () => {
    ledger.findChartOfAccounts.mockResolvedValue([]);

    const result = await call();

    expect(result).toEqual(
      expect.objectContaining({
        beginningCash: '0.0000',
        netCashMovement: '0.0000',
        endingCash: '0.0000',
        reconciled: true,
      }),
    );
    expect(ledger.findCashJournalEntries).not.toHaveBeenCalled();
  });

  // ── AD/AE: footing + reconciliation ────────────────────────────────

  it('AD/AE. footing holds and independent ending reconciles', async () => {
    cumulative.set(new Date('2026-08-31T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '1000', '0'),
    ]);
    cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '1200', '0'),
    ]);
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'SALE', 's-1'),
      je('je-2', 'SUPPLIER_PAYMENT', 'p-1'),
    ]);
    // Distinct referenceTypes aggregate in separate partitions.
    partitions.set('je-1', [aggRow('cash-1', '500', '0')]);
    partitions.set('je-2', [aggRow('cash-1', '0', '300')]);

    const result = await call();

    // Partitions split by (category, referenceType): SALE→Operating +500,
    // SUPPLIER_PAYMENT→Operating −300; footing 1000 + 200 = 1200.
    expect(result.beginningCash).toBe('1000.0000');
    expect(result.endingCash).toBe('1200.0000');
    expect(result.netCashMovement).toBe('200.0000');
    expect(result.reconciled).toBe(true);
  });

  it('AD. mismatch surfaces reconciled=false without adjustment', async () => {
    cumulative.set(new Date('2026-08-31T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '1000', '0'),
    ]);
    // Ending disagrees with footing (e.g. late backdated JE counted
    // differently): values returned as-is, flag false.
    cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '1300', '0'),
    ]);
    ledger.findCashJournalEntries.mockResolvedValue([je('je-1', 'SALE', 's-1')]);
    partitions.set('je-1', [aggRow('cash-1', '200', '0')]);

    const result = await call();

    expect(result.beginningCash).toBe('1000.0000');
    expect(result.netCashMovement).toBe('200.0000');
    expect(result.endingCash).toBe('1300.0000');
    expect(result.reconciled).toBe(false);
  });

  // ── AF/AG/AJ ───────────────────────────────────────────────────────

  it('AF. unknown cash reference is surfaced, counted, never forced', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'SOMETHING_NEW', 'x-1'),
    ]);
    partitions.set('je-1', [aggRow('cash-1', '75', '0')]);
    cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '75', '0'),
    ]);

    const result = await call();

    expect(result.unclassified.rows).toHaveLength(1);
    expect(result.unclassified.rows[0]).toEqual(
      expect.objectContaining({
        referenceType: 'SOMETHING_NEW',
        category: 'UNCLASSIFIED',
        amount: '75.0000',
      }),
    );
    expect(result.operating.rows).toEqual([]);
    expect(result.netUnclassified).toBe('75.0000');
    expect(result.netCashMovement).toBe('75.0000');
    expect(result.reconciled).toBe(true);
  });

  it('AG. Decimal exactness (0.1 + 0.2)', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([je('je-1', 'SALE', 's-1')]);
    partitions.set('je-1', [aggRow('cash-1', '0.3', '0.1')]);

    const result = await call();

    expect(result.netOperating).toBe('0.2000');
  });

  it('AJ. sale buckets cannot duplicate: one JE counts its cash leg once', async () => {
    // A sale JE touches cash once (Dr 1010) alongside revenue/AR legs that
    // are outside the population — operating counts exactly the cash leg.
    ledger.findCashJournalEntries.mockResolvedValue([je('je-1', 'SALE', 's-1')]);
    partitions.set('je-1', [aggRow('cash-1', '1000', '0')]);
    cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
      aggRow('cash-1', '1000', '0'),
    ]);

    const result = await call();

    expect(result.netOperating).toBe('1000.0000');
    expect(result.operating.rows).toHaveLength(1);
    expect(result.reconciled).toBe(true);
  });

  it('L. FT type lookup is company-scoped and batched', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'FINANCIAL_TRANSACTION', 'ft-1'),
      je('je-2', 'FINANCIAL_TRANSACTION', 'ft-2'),
    ]);
    ftRepo.findTypesByIds.mockResolvedValue([
      { id: 'ft-1', type: 'FEE' },
      { id: 'ft-2', type: 'BANK_WITHDRAWAL' },
    ]);
    partitions.set('je-1,je-2', [aggRow('cash-1', '100', '10')]);

    await call();

    // One bulk call with both ids (no per-JE queries).
    expect(ftRepo.findTypesByIds).toHaveBeenCalledTimes(1);
    expect(ftRepo.findTypesByIds).toHaveBeenCalledWith(
      companyId,
      expect.arrayContaining(['ft-1', 'ft-2']),
    );
  });

  // ── G16-N-8-A: reversal position/movement split ────────────────────

  it('G16-N-8-A: movement partitions pass includeReversalCompensations=true', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'REVERSAL', 'je-orig'),
    ]);
    ledger.findJournalEntriesByIds.mockResolvedValue([
      {
        id: 'je-orig',
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: 'pay-1',
      },
    ]);
    partitions.set('je-1', [aggRow('cash-1', '100', '0')]);

    await call();

    const movementCalls = ledger.aggregatedCashFlowLines.mock.calls.filter(
      (c: any[]) => c[1].journalEntryIds,
    );
    expect(movementCalls).toHaveLength(1);
    expect(movementCalls[0]![1].includeReversalCompensations).toBe(true);
  });

  it('G16-N-8-A: beginning/ending position calls never opt into reversal compensations', async () => {
    await call();

    const positionCalls = ledger.aggregatedCashFlowLines.mock.calls.filter(
      (c: any[]) => c[1].asOfDate,
    );
    expect(positionCalls.length).toBeGreaterThanOrEqual(2);
    for (const c of positionCalls) {
      expect(c[1].includeReversalCompensations).toBeUndefined();
    }
  });

  it('G16-N-8-A: REVERSAL movement inherits the original category (SUPPLIER_PAYMENT → OPERATING, opposite net)', async () => {
    ledger.findCashJournalEntries.mockResolvedValue([
      je('je-1', 'REVERSAL', 'je-orig'),
    ]);
    ledger.findJournalEntriesByIds.mockResolvedValue([
      {
        id: 'je-orig',
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: 'pay-1',
      },
    ]);
    // The compensation cash leg: Dr cash 100 (payment was Cr cash 100).
    partitions.set('je-1', [aggRow('cash-1', '100', '0')]);

    const result = await call();

    expect(result.operating.rows).toHaveLength(1);
    // Dr cash 100 → inflow; amount = net of the leg.
    expect(result.operating.rows[0]!.inflow).toBe('100.0000');
    expect(result.operating.rows[0]!.amount).toBe('100.0000');
    expect(result.netCashMovement).toBe('100.0000');
  });

  // ── G16-N-8-B: movement shows BOTH legs of a GL-engine reversal ────────

  describe('G16-N-8-B — GL-engine reversal shows both movement legs', () => {
    it('enumeration opts into POSTED ∪ REVERSED', async () => {
      await call();

      expect(ledger.findCashJournalEntries).toHaveBeenCalledWith(
        companyId,
        expect.objectContaining({ includeReversedOriginals: true }),
      );
    });

    it('movement partition aggregates the exact enumerated ids regardless of status', async () => {
      ledger.findCashJournalEntries.mockResolvedValue([
        je('je-1', 'SALE', 's-1'),
      ]);

      await call();

      const movementCalls = ledger.aggregatedCashFlowLines.mock.calls.filter(
        (c: any[]) => c[1].journalEntryIds,
      );
      expect(movementCalls.length).toBeGreaterThan(0);
      for (const c of movementCalls) {
        expect(c[1].onlyPosted).toBe(false);
        expect(c[1].includeReversalCompensations).toBe(true);
      }
    });

    it('POSITIONS keep canonical semantics — never onlyPosted:false', async () => {
      await call();

      const positionCalls = ledger.aggregatedCashFlowLines.mock.calls.filter(
        (c: any[]) => c[1].asOfDate,
      );
      expect(positionCalls.length).toBeGreaterThanOrEqual(2);
      for (const c of positionCalls) {
        expect(c[1].onlyPosted).toBeUndefined();
        expect(c[1].includeReversalCompensations).toBeUndefined();
      }
    });

    it('a reversed original (REVERSED) and its compensation both render and net to zero', async () => {
      // Exactly the production shape: GlEngineService.reverse() flips the
      // original to REVERSED and posts a POSTED compensation carrying
      // referenceType='REVERSAL' + referenceId=originalId.
      ledger.findCashJournalEntries.mockResolvedValue([
        je('je-orig', 'SALE', 's-1'),
        je('je-comp', 'REVERSAL', 'je-orig'),
      ]);
      // Status-agnostic original lookup: the original IS REVERSED now.
      ledger.findJournalEntriesByIds.mockResolvedValue([
        { id: 'je-orig', referenceType: 'SALE', referenceId: 's-1' },
      ]);
      // Original: Cr cash 250 (outflow). Compensation: Dr cash 250 (inflow).
      partitions.set('je-orig', [aggRow('cash-1', '0', '250')]);
      partitions.set('je-comp', [aggRow('cash-1', '250', '0')]);
      // Positions are reversal-neutral → both zero, as G16-N-8-A mandates.
      cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), []);

      const result = await call();

      // Both legs present, inherited category, opposite signs.
      expect(result.operating.rows).toHaveLength(2);
      expect(result.operating.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            referenceType: 'SALE',
            outflow: '250.0000',
            amount: '-250.0000',
          }),
          expect.objectContaining({
            referenceType: 'REVERSAL',
            inflow: '250.0000',
            amount: '250.0000',
          }),
        ]),
      );
      // Section nets to zero — the pair is visible but neutral.
      expect(result.netOperating).toBe('0.0000');
      expect(result.netCashMovement).toBe('0.0000');
    });

    it('same-window reversal: positions unchanged and reconciled stays true', async () => {
      ledger.findCashJournalEntries.mockResolvedValue([
        je('je-orig', 'SALE', 's-1'),
        je('je-comp', 'REVERSAL', 'je-orig'),
      ]);
      ledger.findJournalEntriesByIds.mockResolvedValue([
        { id: 'je-orig', referenceType: 'SALE', referenceId: 's-1' },
      ]);
      partitions.set('je-orig', [aggRow('cash-1', '0', '250')]);
      partitions.set('je-comp', [aggRow('cash-1', '250', '0')]);
      // Positions: opening 400, ending 400 (the pair contributes zero).
      cumulative.set(new Date('2026-08-31T23:59:59.999Z').getTime(), [
        aggRow('cash-1', '0', '400'),
      ]);
      cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
        aggRow('cash-1', '0', '400'),
      ]);

      const result = await call();

      expect(result.beginningCash).toBe('-400.0000');
      expect(result.endingCash).toBe('-400.0000');
      expect(result.netCashMovement).toBe('0.0000');
      // restored information, not a weakened check
      expect(result.reconciled).toBe(true);
    });

    it('compensation pairing stays traceable via referenceId — original lookup is status-agnostic', async () => {
      ledger.findCashJournalEntries.mockResolvedValue([
        je('je-comp', 'REVERSAL', 'je-orig'),
      ]);
      ledger.findJournalEntriesByIds.mockResolvedValue([
        { id: 'je-orig', referenceType: 'SALE', referenceId: 's-1' },
      ]);
      partitions.set('je-comp', [aggRow('cash-1', '250', '0')]);

      await call();

      // Only the compensation's referenceId is resolved — by exact id, and the
      // repository method is deliberately status-agnostic (unit-proved in
      // ledger.repository.reversal.spec.ts).
      expect(ledger.findJournalEntriesByIds).toHaveBeenCalledWith(companyId, [
        'je-orig',
      ]);
    });

    it('an UNCLASSIFIABLE reversal original degrades safely, never mis-categorised', async () => {
      // Original cannot be resolved (e.g. purged). classifyEntry must fall back
      // to UNCLASSIFIED rather than inventing a category.
      ledger.findCashJournalEntries.mockResolvedValue([
        je('je-comp', 'REVERSAL', 'je-missing'),
      ]);
      ledger.findJournalEntriesByIds.mockResolvedValue([]);
      partitions.set('je-comp', [aggRow('cash-1', '250', '0')]);

      const result = await call();

      expect(result.operating.rows).toEqual([]);
      expect(result.unclassified.rows).toHaveLength(1);
      expect(result.unclassified.rows[0]!.referenceType).toBe('REVERSAL');
    });
  });

  // ── unchanged behaviour for non-reversal taxonomies ────────────────────

  describe('G16-N-8-B — existing semantics unchanged', () => {
    it('normal movement unchanged', async () => {
      ledger.findCashJournalEntries.mockResolvedValue([je('je-1', 'SALE', 's-1')]);
      partitions.set('je-1', [aggRow('cash-1', '500', '0')]);
      cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
        aggRow('cash-1', '500', '0'),
      ]);

      const result = await call();

      expect(result.netOperating).toBe('500.0000');
      expect(result.reconciled).toBe(true);
    });

    it('FINANCIAL_TRANSACTION reversal classification unchanged', async () => {
      ledger.findCashJournalEntries.mockResolvedValue([
        je('je-1', 'FINANCIAL_TRANSACTION', 'ft-1'),
      ]);
      // 'FEE' is an FT_OPERATING_TYPE; the FT-type join is untouched by
      // G16-N-8-B.
      ftRepo.findTypesByIds.mockResolvedValue([{ id: 'ft-1', type: 'FEE' }]);
      partitions.set('je-1', [aggRow('cash-1', '0', '300')]);
      cumulative.set(new Date('2026-09-30T23:59:59.999Z').getTime(), [
        aggRow('cash-1', '0', '300'),
      ]);

      const result = await call();

      expect(result.netOperating).toBe('-300.0000');
      expect(result.reconciled).toBe(true);
    });

    it('SUPPLIER_PAYMENT_REVERSAL stays an operating inflow', async () => {
      ledger.findCashJournalEntries.mockResolvedValue([
        je('je-1', 'SUPPLIER_PAYMENT_REVERSAL', 'p-1'),
      ]);
      partitions.set('je-1', [aggRow('cash-1', '150', '0')]);

      const result = await call();

      expect(result.netOperating).toBe('150.0000');
    });
  });
});
