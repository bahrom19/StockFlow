import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerQueryService } from '../ledger-query.service';
import { LedgerRepository } from '../../repositories/ledger.repository';

const dec = (v: string | number) => new Decimal(v);

/**
 * G16-N-8-B: stand-in for the repository-owned canonical population factory.
 * It reproduces the exact shape the real LedgerRepository emits so tests can
 * assert that getPnlReport()'s daily series passes the clause through verbatim
 * instead of rebuilding it. Parity with the header aggregate is proven against
 * the REAL repository in ledger.repository.reversal.spec.ts.
 */
const canonicalPopulation = (
  companyId: string,
  opts: { asOfDate?: Date; dateFrom?: Date; dateTo?: Date } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> => {
  const where: Record<string, any> = {
    companyId,
    status: 'POSTED',
    OR: [{ referenceType: null }, { referenceType: { not: 'REVERSAL' } }],
  };
  if (opts.asOfDate) where.entryDate = { lte: opts.asOfDate };
  if (opts.dateFrom || opts.dateTo) {
    where.entryDate = {
      ...(opts.dateFrom ? { gte: opts.dateFrom } : {}),
      ...(opts.dateTo ? { lte: opts.dateTo } : {}),
    };
  }
  return where;
};

describe('LedgerQueryService — G15-06b', () => {
  let service: LedgerQueryService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;

  beforeEach(async () => {
    repo = {
      findChartOfAccounts: jest.fn(),
      aggregatedJournalLines: jest.fn().mockResolvedValue([]),
      findJournalLinesWithEntry: jest.fn().mockResolvedValue([]),
      countJournalLines: jest.fn().mockResolvedValue(0),
      findAccountBalances: jest.fn().mockResolvedValue([]),
      findAccountBalancesBulk: jest.fn().mockResolvedValue([]),
      findFirstAccountBalance: jest.fn().mockResolvedValue(null),
      findFinancialPeriodByDate: jest.fn().mockResolvedValue(null),
      positionalJournalEntryWhere: jest.fn(canonicalPopulation),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerQueryService,
        { provide: LedgerRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<LedgerQueryService>(LedgerQueryService);
  });

  // ═══════════════════════════════════════════════════════════════════
  // G15-06b-01 — Trial Balance (JournalLine-direct)
  // ═══════════════════════════════════════════════════════════════════

  describe('getTrialBalance — G15-06b-01', () => {
    const assetAccount = (id = 'acc-1', code = '1000', name = 'Cash') => ({
      id,
      code,
      name,
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
      level: 0,
    });

    const revenueAccount = (id = 'acc-2', code = '4000', name = 'Revenue') => ({
      id,
      code,
      name,
      accountType: 'REVENUE',
      normalBalance: 'CREDIT',
      level: 0,
    });

    const expenseAccount = (id = 'acc-3', code = '5000', name = 'COGS') => ({
      id,
      code,
      name,
      accountType: 'EXPENSE',
      normalBalance: 'DEBIT',
      level: 0,
    });

    it('single account — single period cumulative balance', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec('1500'), totalCredit: dec('300') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.debit).toBe('1200.0000');
      expect(result.rows[0]!.credit).toBe('0.0000');
      expect(result.totalDebit).toBe('1200.0000');
      expect(result.totalCredit).toBe('0.0000');
    });

    it('multiple accounts — correct normal balance convention', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        assetAccount(),
        revenueAccount(),
        expenseAccount(),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec('5000'), totalCredit: dec('2000') },
        { accountId: 'acc-2', totalDebit: dec('500'), totalCredit: dec('10000') },
        { accountId: 'acc-3', totalDebit: dec('3000'), totalCredit: dec('200') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      // Asset (DEBIT normal): net = 5000−2000 = 3000 → debit side
      expect(result.rows[0]!.debit).toBe('3000.0000');
      expect(result.rows[0]!.credit).toBe('0.0000');
      // Revenue (CREDIT normal): net = 10000−500 = 9500 → credit side
      expect(result.rows[1]!.debit).toBe('0.0000');
      expect(result.rows[1]!.credit).toBe('9500.0000');
      // Expense (DEBIT normal): net = 3000−200 = 2800 → debit side
      expect(result.rows[2]!.debit).toBe('2800.0000');
      expect(result.rows[2]!.credit).toBe('0.0000');
      expect(result.totalDebit).toBe('5800.0000');
      expect(result.totalCredit).toBe('9500.0000');
    });

    it('cumulative balance — includes all historical POSTED entries', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      // Simulating cumulative across multiple periods
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec('50000'), totalCredit: dec('48000') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      expect(result.rows[0]!.debit).toBe('2000.0000');
    });

    it('asOfDate before any entry — zero balances', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec(0), totalCredit: dec(0) },
      ]);

      const result = await service.getTrialBalance({
        companyId: 'comp-1',
        asOfDate: new Date('2025-01-01'),
      });
      expect(result.rows[0]!.debit).toBe('0.0000');
      expect(result.rows[0]!.credit).toBe('0.0000');
    });

    it('asOfDate after all entries — full cumulative balance', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec('10000'), totalCredit: dec('7500') },
      ]);

      const result = await service.getTrialBalance({
        companyId: 'comp-1',
        asOfDate: new Date('2027-12-31'),
      });
      expect(result.rows[0]!.debit).toBe('2500.0000');
    });

    it('asOfDate inside period — only entries up to that date', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec('3000'), totalCredit: dec('1000') },
      ]);

      const result = await service.getTrialBalance({
        companyId: 'comp-1',
        asOfDate: new Date('2026-06-15'),
      });
      expect(result.rows[0]!.debit).toBe('2000.0000');
      // Verify asOfDate was passed to aggregation
      expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('comp-1', {
        asOfDate: new Date('2026-06-15'),
        onlyPosted: true,
      });
    });

    it('POSTED entries included, DRAFT excluded', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      // aggregatedJournalLines only receives POSTED entries (onlyPosted: true)
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec('1000'), totalCredit: dec(0) },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      expect(result.rows[0]!.debit).toBe('1000.0000');
      expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('comp-1', {
        asOfDate: undefined,
        onlyPosted: true,
      });
    });

    it('tenant isolation — companyId passed to aggregation', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);

      await service.getTrialBalance({ companyId: 'tenant-A' });
      expect(repo.findChartOfAccounts).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'tenant-A' }),
      );
      expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('tenant-A', {
        asOfDate: undefined,
        onlyPosted: true,
      });
    });

    it('accountType filter — passed to chart of accounts query', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);

      await service.getTrialBalance({
        companyId: 'comp-1',
        accountType: 'ASSET',
      });
      expect(repo.findChartOfAccounts).toHaveBeenCalledWith(
        expect.objectContaining({ accountType: 'ASSET' }),
      );
    });

    it('empty chart of accounts — returns empty rows with zero totals', async () => {
      repo.findChartOfAccounts.mockResolvedValue([]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      expect(result.rows).toEqual([]);
      expect(result.totalDebit).toBe('0.0000');
      expect(result.totalCredit).toBe('0.0000');
    });

    it('accounts with no activity — show zero balance', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      // No aggregated lines for this account → balance defaults to 0
      repo.aggregatedJournalLines.mockResolvedValue([]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      expect(result.rows[0]!.debit).toBe('0.0000');
      expect(result.rows[0]!.credit).toBe('0.0000');
    });

    it('deterministic — same inputs produce same output', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec('1000'), totalCredit: dec('500') },
      ]);

      const r1 = await service.getTrialBalance({ companyId: 'comp-1' });
      const r2 = await service.getTrialBalance({ companyId: 'comp-1' });
      expect(r1).toEqual(r2);
    });

    it('historical JournalEntry without AccountBalance — still appears', async () => {
      // G15-06b-01: JournalLine-direct means historical journals without
      // AccountBalance snapshots correctly affect the Trial Balance.
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec('2000'), totalCredit: dec('500') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      expect(result.rows[0]!.debit).toBe('1500.0000');
      // No AccountBalance lookup occurred
      expect(repo.findAccountBalancesBulk).not.toHaveBeenCalled();
    });

    it('negative net on DEBIT-normal account — shows on credit side', async () => {
      repo.findChartOfAccounts.mockResolvedValue([assetAccount()]);
      // More credits than debits on an asset account (unusual but valid)
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-1', totalDebit: dec('100'), totalCredit: dec('500') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      expect(result.rows[0]!.debit).toBe('0.0000');
      expect(result.rows[0]!.credit).toBe('400.0000');
    });

    it('negative net on CREDIT-normal account — shows on debit side', async () => {
      repo.findChartOfAccounts.mockResolvedValue([revenueAccount()]);
      // More debits than credits on a revenue account (unusual but valid)
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'acc-2', totalDebit: dec('5000'), totalCredit: dec('1000') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      expect(result.rows[0]!.debit).toBe('4000.0000');
      expect(result.rows[0]!.credit).toBe('0.0000');
    });

    it('multiple accounts with mixed balances — totals balance across sides', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        assetAccount('a1', '1000', 'Cash'),
        assetAccount('a2', '1100', 'Bank'),
        revenueAccount('a3', '4000', 'Sales'),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'a1', totalDebit: dec('1000'), totalCredit: dec('200') },
        { accountId: 'a2', totalDebit: dec('5000'), totalCredit: dec('3000') },
        { accountId: 'a3', totalDebit: dec('100'), totalCredit: dec('8000') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });
      // Cash: 1000−200=800 debit, Bank: 5000−3000=2000 debit
      // Sales: 8000−100=7900 credit
      expect(result.totalDebit).toBe('2800.0000');
      expect(result.totalCredit).toBe('7900.0000');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // G16 — Trial Balance historical-account lifecycle integrity
  // CR-1: JournalLines are accounting history. isActive/deletedAt gate
  // posting (CR-2) and API visibility (CR-3) — never financial amounts.
  // ═══════════════════════════════════════════════════════════════════

  describe('getTrialBalance — G16 historical-account lifecycle integrity', () => {
    const acc = (
      id: string,
      code: string,
      accountType: string,
      normalBalance: string,
      lifecycle: Record<string, unknown> = {},
    ) => ({
      id,
      code,
      name: `${code} ${id}`,
      accountType,
      normalBalance,
      level: 0,
      ...lifecycle,
    });
    const RETIRED = { isActive: false, deletedAt: new Date('2026-01-01T00:00:00Z') };

    /** totals must equal the sum of the rendered rows — the core invariant */
    const sumRows = (rows: { debit: string; credit: string }[]) =>
      rows.reduce(
        (acc, r) => ({
          debit: acc.debit.add(r.debit),
          credit: acc.credit.add(r.credit),
        }),
        { debit: dec(0), credit: dec(0) },
      );

    it('1. active accounts still render normally', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('a1', '1000', 'ASSET', 'DEBIT'),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'a1', totalDebit: dec('1000'), totalCredit: dec('0') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.accountId).toBe('a1');
      expect(result.totalDebit).toBe('1000.0000');
    });

    it('2. an INACTIVE account renders with its historical balance', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('a1', '1500', 'ASSET', 'DEBIT', { isActive: false }),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'a1', totalDebit: dec('5000'), totalCredit: dec('0') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.accountId).toBe('a1');
      expect(result.rows[0]!.debit).toBe('5000.0000');
      expect(result.totalDebit).toBe('5000.0000');
    });

    it('3. a SOFT-DELETED account renders with its historical balance', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('a1', '1500', 'ASSET', 'DEBIT', { deletedAt: new Date() }),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'a1', totalDebit: dec('5000'), totalCredit: dec('0') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });

      expect(result.rows).toHaveLength(1);
      expect(result.totalDebit).toBe('5000.0000');
    });

    it('4. one inactive leg still foots', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('a1', '1500', 'ASSET', 'DEBIT'),
        acc('e1', '3000', 'EQUITY', 'CREDIT', { isActive: false }),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'a1', totalDebit: dec('5000'), totalCredit: dec('0') },
        { accountId: 'e1', totalDebit: dec('0'), totalCredit: dec('5000') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });

      expect(result.totalDebit).toBe('5000.0000');
      expect(result.totalCredit).toBe('5000.0000');
    });

    it('5. Mode C — BOTH legs retired => Dr 5000 / Cr 5000 and foots', async () => {
      // THE regression. Both legs of a balanced journal retired: pre-G16 this
      // produced 0 rows, Dr 0 / Cr 0 and still "balanced" — materially wrong
      // with no signal. A single retired account cannot prove the fix.
      repo.findChartOfAccounts.mockResolvedValue([
        acc('a1', '1500', 'ASSET', 'DEBIT', RETIRED),
        acc('e1', '3000', 'EQUITY', 'CREDIT', RETIRED),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'a1', totalDebit: dec('5000'), totalCredit: dec('0') },
        { accountId: 'e1', totalDebit: dec('0'), totalCredit: dec('5000') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });

      expect(result.rows).toHaveLength(2);
      expect(result.totalDebit).toBe('5000.0000');
      expect(result.totalCredit).toBe('5000.0000');
      // The old defect's exact signature must be unreachable.
      expect(result.totalDebit).not.toBe('0.0000');
      expect(result.totalCredit).not.toBe('0.0000');
    });

    it('6. an inactive REVENUE account still reports on the credit side', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('r1', '4000', 'REVENUE', 'CREDIT', { isActive: false }),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'r1', totalDebit: dec('0'), totalCredit: dec('10000') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });

      expect(result.rows[0]!.credit).toBe('10000.0000');
      expect(result.totalCredit).toBe('10000.0000');
    });

    it('7. an inactive EXPENSE account still reports on the debit side', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('x1', '6100', 'EXPENSE', 'DEBIT', { isActive: false }),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'x1', totalDebit: dec('4000'), totalCredit: dec('0') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });

      expect(result.rows[0]!.debit).toBe('4000.0000');
      expect(result.totalDebit).toBe('4000.0000');
    });

    it('8. an inactive 5xxx EXPENSE account keeps COGS accounting (it is an EXPENSE row regardless)', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('c1', '5000', 'EXPENSE', 'DEBIT', { isActive: false }),
        acc('x1', '6100', 'EXPENSE', 'DEBIT', { isActive: false }),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'c1', totalDebit: dec('300'), totalCredit: dec('0') },
        { accountId: 'x1', totalDebit: dec('120'), totalCredit: dec('0') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });

      // Trial Balance does not split COGS vs opex — it reports EXPENSE rows.
      // Both retired accounts must appear with their own amounts.
      expect(result.rows).toHaveLength(2);
      const cogs = result.rows.find((r) => r.accountCode === '5000')!;
      const opex = result.rows.find((r) => r.accountCode === '6100')!;
      expect(cogs.debit).toBe('300.0000');
      expect(opex.debit).toBe('120.0000');
      expect(result.totalDebit).toBe('420.0000');
    });

    it('9. asOfDate is still forwarded to the journal aggregate, unaffected by lifecycle', async () => {
      const asOfDate = new Date('2026-06-30T00:00:00Z');
      repo.findChartOfAccounts.mockResolvedValue([
        acc('a1', '1500', 'ASSET', 'DEBIT', { isActive: false }),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'a1', totalDebit: dec('5000'), totalCredit: dec('0') },
      ]);

      await service.getTrialBalance({ companyId: 'comp-1', asOfDate });

      expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('comp-1', {
        asOfDate,
        onlyPosted: true,
      });
    });

    it('10. tenant isolation preserved: companyId first, and foreign ids ignored', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('mine', '1500', 'ASSET', 'DEBIT', { isActive: false }),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'mine', totalDebit: dec('5000'), totalCredit: dec('0') },
        { accountId: 'theirs', totalDebit: dec('999999'), totalCredit: dec('0') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'tenant-X' });

      expect(repo.findChartOfAccounts).toHaveBeenCalledWith({
        companyId: 'tenant-X',
      });
      expect(result.rows.map((r) => r.accountId)).toEqual(['mine']);
      expect(result.totalDebit).toBe('5000.0000');
    });

    it('11. totals equal the sum of the rendered rows across a mixed population', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('a1', '1010', 'ASSET', 'DEBIT'),
        acc('a2', '1500', 'ASSET', 'DEBIT', { isActive: false }),
        acc('l1', '2100', 'LIABILITY', 'CREDIT', { deletedAt: new Date() }),
        acc('e1', '3000', 'EQUITY', 'CREDIT', { isActive: false }),
        acc('r1', '4000', 'REVENUE', 'CREDIT', { isActive: false }),
        acc('x1', '6100', 'EXPENSE', 'DEBIT', { isActive: false }),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'a1', totalDebit: dec('1900'), totalCredit: dec('0') },
        { accountId: 'a2', totalDebit: dec('5000'), totalCredit: dec('0') },
        { accountId: 'l1', totalDebit: dec('0'), totalCredit: dec('1500') },
        { accountId: 'e1', totalDebit: dec('0'), totalCredit: dec('3000') },
        { accountId: 'r1', totalDebit: dec('0'), totalCredit: dec('3000') },
        { accountId: 'x1', totalDebit: dec('600'), totalCredit: dec('0') },
      ]);

      const result = await service.getTrialBalance({ companyId: 'comp-1' });

      const summed = sumRows(result.rows);
      expect(result.totalDebit).toBe(summed.debit.toFixed(4));
      expect(result.totalCredit).toBe(summed.credit.toFixed(4));
      // Balanced fixture: Dr 7500 = Cr 7500.
      expect(result.totalDebit).toBe('7500.0000');
      expect(result.totalCredit).toBe('7500.0000');
      expect(result.rows).toHaveLength(6);
    });

    it('12. accountType filter is still applied alongside the lifecycle fix', async () => {
      repo.findChartOfAccounts.mockResolvedValue([
        acc('a1', '1500', 'ASSET', 'DEBIT', { isActive: false }),
        acc('r1', '4000', 'REVENUE', 'CREDIT'),
      ]);
      repo.aggregatedJournalLines.mockResolvedValue([
        { accountId: 'a1', totalDebit: dec('5000'), totalCredit: dec('0') },
        { accountId: 'r1', totalDebit: dec('0'), totalCredit: dec('1000') },
      ]);

      await service.getTrialBalance({ companyId: 'comp-1', accountType: 'ASSET' });

      expect(repo.findChartOfAccounts).toHaveBeenCalledWith({
        companyId: 'comp-1',
        accountType: 'ASSET',
      });
    });

    it('13. STRUCTURAL — lifecycle predicates must not return to the account population', async () => {
      // Anti-drift guard: the defect was invisible precisely because no test
      // asserted the lookup arguments. This pins that only companyId (plus the
      // optional accountType) is ever sent.
      repo.findChartOfAccounts.mockResolvedValue([]);

      await service.getTrialBalance({ companyId: 'comp-1' });

      const arg = repo.findChartOfAccounts.mock.calls[0][0];
      expect(arg).toEqual({ companyId: 'comp-1' });
      expect(arg.isActive).toBeUndefined();
      expect(arg.deletedAt).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // G15-06b-02 — GL-backed P&L
  // ═══════════════════════════════════════════════════════════════════

  describe('getPnlReport — G15-06b-02', () => {
    const revenueAcc = (id = 'r1', code = '4000') => ({
      id, code, name: 'Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', level: 0,
    });
    const cogsAcc = (id = 'c1', code = '5000') => ({
      id, code, name: 'COGS', accountType: 'EXPENSE', normalBalance: 'DEBIT', level: 0,
    });
    const expenseAcc = (id = 'e1', code = '6000') => ({
      id, code, name: 'Rent', accountType: 'EXPENSE', normalBalance: 'DEBIT', level: 0,
    });

    it('GL revenue — correctly aggregated from REVENUE accounts', async () => {
      repo.findChartOfAccounts.mockResolvedValue([revenueAcc()]);
      // REVENUE: net = credit − debit (normal credit balance)
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([
          { accountId: 'r1', totalDebit: dec('100'), totalCredit: dec('10000') },
        ])
        .mockResolvedValueOnce([]); // EXPENSE

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      expect(result.revenue).toEqual(dec('9900'));
    });

    it('GL COGS — correctly classified from 5xxx EXPENSE accounts', async () => {
      repo.findChartOfAccounts.mockResolvedValue([cogsAcc()]);
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([]) // REVENUE
        .mockResolvedValueOnce([
          { accountId: 'c1', totalDebit: dec('5000'), totalCredit: dec('200') },
        ]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      expect(result.cogs).toEqual(dec('4800'));
    });

    it('GL expenses — correctly classified from 6xxx EXPENSE accounts', async () => {
      repo.findChartOfAccounts.mockResolvedValue([expenseAcc()]);
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([]) // REVENUE
        .mockResolvedValueOnce([
          { accountId: 'e1', totalDebit: dec('3000'), totalCredit: dec('0') },
        ]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      expect(result.expenses).toEqual(dec('3000'));
    });

    it('net profit — revenue − COGS − expenses', async () => {
      repo.findChartOfAccounts.mockResolvedValue([revenueAcc(), cogsAcc(), expenseAcc()]);
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([
          { accountId: 'r1', totalDebit: dec(0), totalCredit: dec('20000') },
        ])
        .mockResolvedValueOnce([
          { accountId: 'c1', totalDebit: dec('8000'), totalCredit: dec(0) },
          { accountId: 'e1', totalDebit: dec('3000'), totalCredit: dec(0) },
        ]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      // Revenue 20000 − COGS 8000 − Expenses 3000 = 9000
      expect(result.revenue).toEqual(dec('20000'));
      expect(result.cogs).toEqual(dec('8000'));
      expect(result.expenses).toEqual(dec('3000'));
    });

    it('manual revenue journal — appears in GL when POSTED', async () => {
      repo.findChartOfAccounts.mockResolvedValue([revenueAcc()]);
      // Includes both operational revenue and manual journal
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([
          { accountId: 'r1', totalDebit: dec(0), totalCredit: dec('15000') },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      expect(result.revenue).toEqual(dec('15000'));
    });

    it('manual expense journal — appears in GL expenses', async () => {
      repo.findChartOfAccounts.mockResolvedValue([expenseAcc()]);
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { accountId: 'e1', totalDebit: dec('5000'), totalCredit: dec(0) },
        ]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      expect(result.expenses).toEqual(dec('5000'));
    });

    it('manual COGS journal — appears in GL COGS', async () => {
      repo.findChartOfAccounts.mockResolvedValue([cogsAcc()]);
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { accountId: 'c1', totalDebit: dec('2000'), totalCredit: dec(0) },
        ]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      expect(result.cogs).toEqual(dec('2000'));
    });

    it('DRAFT journals excluded — onlyPosted: true', async () => {
      repo.findChartOfAccounts.mockResolvedValue([revenueAcc()]);

      await service.getPnlReport({ companyId: 'comp-1' });
      expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('comp-1', {
        dateFrom: undefined,
        dateTo: undefined,
        accountType: 'REVENUE',
        onlyPosted: true,
      });
    });

    it('date boundaries — dateFrom and dateTo passed correctly', async () => {
      repo.findChartOfAccounts.mockResolvedValue([revenueAcc()]);

      await service.getPnlReport({
        companyId: 'comp-1',
        dateFrom: new Date('2026-01-01'),
        dateTo: new Date('2026-06-30'),
      });
      expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('comp-1', {
        dateFrom: new Date('2026-01-01'),
        dateTo: new Date('2026-06-30'),
        accountType: 'REVENUE',
        onlyPosted: true,
      });
    });

    it('empty period — returns zero revenue/COGS/expenses', async () => {
      repo.findChartOfAccounts.mockResolvedValue([]);
      repo.aggregatedJournalLines.mockResolvedValue([]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      expect(result.revenue).toEqual(dec(0));
      expect(result.cogs).toEqual(dec(0));
      expect(result.expenses).toEqual(dec(0));
    });

    it('tenant isolation — companyId passed to all queries', async () => {
      repo.findChartOfAccounts.mockResolvedValue([]);

      await service.getPnlReport({ companyId: 'tenant-B' });
      expect(repo.findChartOfAccounts).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'tenant-B' }),
      );
      expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('tenant-B', expect.anything());
    });

    it('daily buckets — correctly grouped by entry date', async () => {
      repo.findChartOfAccounts.mockResolvedValue([revenueAcc()]);
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([
          { accountId: 'r1', totalDebit: dec(0), totalCredit: dec('10000') },
        ])
        .mockResolvedValueOnce([]);

      // Mock findJournalLinesWithEntry for daily buckets
      repo.findJournalLinesWithEntry.mockResolvedValue([
        {
          accountId: 'r1',
          debit: dec(0),
          credit: dec('5000'),
          journalEntry: { entryDate: new Date('2026-01-15T10:00:00Z') },
        },
        {
          accountId: 'r1',
          debit: dec(0),
          credit: dec('5000'),
          journalEntry: { entryDate: new Date('2026-01-16T10:00:00Z') },
        },
      ]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      expect(Object.keys(result.daily)).toHaveLength(2);
      expect(result.daily['2026-01-15']!.revenue).toEqual(dec('5000'));
      expect(result.daily['2026-01-16']!.revenue).toEqual(dec('5000'));
    });

    it('pre-G15-06a JournalEntry without AccountBalance — still appears in GL', async () => {
      // G15-06b-02: JournalLine-direct aggregation means historical entries
      // without AccountBalance snapshots are correctly included.
      repo.findChartOfAccounts.mockResolvedValue([revenueAcc()]);
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([
          { accountId: 'r1', totalDebit: dec(0), totalCredit: dec('5000') },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      expect(result.revenue).toEqual(dec('5000'));
      // No AccountBalance lookup
      expect(repo.findAccountBalances).not.toHaveBeenCalled();
    });

    it('refund journals reduce GL revenue — no double-counting', async () => {
      // Refund journals (Dr Revenue / Cr AR) reduce GL revenue balance.
      // The GL balance is the sole accounting source.
      repo.findChartOfAccounts.mockResolvedValue([revenueAcc()]);
      // Revenue reduced by refund reversal
      repo.aggregatedJournalLines
        .mockResolvedValueOnce([
          { accountId: 'r1', totalDebit: dec('2000'), totalCredit: dec('12000') },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getPnlReport({ companyId: 'comp-1' });
      // Net revenue: 12000 − 2000 = 10000 (refund already included)
      expect(result.revenue).toEqual(dec('10000'));
    });
  });
});

describe('LedgerQueryService.getLedger — G16-N-8-A reversal statement semantics', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  let service: LedgerQueryService;

  beforeEach(async () => {
    repo = {
      findChartOfAccounts: jest.fn(),
      aggregatedJournalLines: jest.fn().mockResolvedValue([]),
      findJournalLinesWithEntry: jest.fn().mockResolvedValue([]),
      countJournalLines: jest.fn().mockResolvedValue(0),
      findAccountBalances: jest.fn().mockResolvedValue([]),
      findFirstAccountBalance: jest.fn().mockResolvedValue(null),
      findFinancialPeriodByDate: jest.fn().mockResolvedValue(null),
      positionalJournalEntryWhere: jest.fn(canonicalPopulation),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerQueryService,
        { provide: LedgerRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<LedgerQueryService>(LedgerQueryService);
  });

  it('includes BOTH reversal legs: status IN (POSTED, REVERSED), no referenceType exclusion', async () => {
    await service.getLedger({
      companyId: 'comp-1',
      accountId: 'acc-1',
    });

    const where = repo.findJournalLinesWithEntry.mock.calls[0][0];
    expect(where.journalEntry.status).toEqual({ in: ['POSTED', 'REVERSED'] });
    expect(where.journalEntry.referenceType).toBeUndefined();
    expect(where.journalEntry.companyId).toBe('comp-1');
  });

  it('keeps accountId/date/pagination filters intact', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-12-31T23:59:59Z');
    await service.getLedger({
      companyId: 'comp-1',
      accountId: 'acc-9',
      dateFrom: from,
      dateTo: to,
      page: 2,
      limit: 50,
    });

    const where = repo.findJournalLinesWithEntry.mock.calls[0][0];
    expect(where.accountId).toBe('acc-9');
    expect(where.journalEntry.entryDate).toEqual({ gte: from, lte: to });
    // The date branch spreads the existing clause — companyId and the
    // widened status set must survive it, not be clobbered.
    expect(where.journalEntry.companyId).toBe('comp-1');
    expect(where.journalEntry.status).toEqual({ in: ['POSTED', 'REVERSED'] });
    expect(repo.findJournalLinesWithEntry.mock.calls[0][1]).toEqual({
      skip: 50,
      take: 50,
    });
  });

  it('running balance still accumulates over both reversal legs (detail listing)', async () => {
    repo.findJournalLinesWithEntry.mockResolvedValue([
      {
        debit: '100',
        credit: '0',
        journalEntry: {
          entryDate: new Date('2026-05-01T00:00:00Z'),
          entryNumber: 7,
          description: 'Original expense',
          referenceType: null,
          referenceId: null,
        },
      },
      {
        debit: '0',
        credit: '100',
        journalEntry: {
          entryDate: new Date('2026-05-02T00:00:00Z'),
          entryNumber: 8,
          description: 'REVERSAL: reversal of entry #7',
          referenceType: 'REVERSAL',
          referenceId: 'je-orig',
        },
      },
    ]);

    const result = await service.getLedger({
      companyId: 'comp-1',
      accountId: 'acc-1',
    });

    expect(result.items).toHaveLength(2);
    // Opening = 0 (no snapshot); running: +100 then −100 → ends at 0.
    expect(result.items[0]!.runningBalance).toBe('100.0000');
    expect(result.items[1]!.runningBalance).toBe('0.0000');
  });
});

// ═══════════════════════════════════════════════════════════════════
// G16-N-8-B — Daily P&L shares ONE canonical population with the header
// ═══════════════════════════════════════════════════════════════════

describe('LedgerQueryService.getPnlReport — G16-N-8-B canonical population', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  let service: LedgerQueryService;

  const account = (
    id: string,
    code: string,
    accountType: string,
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    code,
    name: `${code} name`,
    accountType,
    normalBalance: accountType === 'REVENUE' ? 'CREDIT' : 'DEBIT',
    level: 0,
    ...extra,
  });

  const revenue = account('r1', '4000', 'REVENUE');
  const cogs = account('c1', '5000', 'EXPENSE');
  const expense = account('e1', '6000', 'EXPENSE');
  const inactiveExpense = account('e8', '6800', 'EXPENSE', { isActive: false });
  const inactiveCogs = account('c9', '5900', 'EXPENSE', { isActive: false });
  const softDeletedExpense = account('e9', '6900', 'EXPENSE', {
    deletedAt: new Date('2026-01-01T00:00:00Z'),
  });

  /** Journal line shaped exactly like findJournalLinesWithEntry returns it. */
  const line = (
    accountId: string,
    day: string,
    debit: string,
    credit: string,
  ) => ({
    accountId,
    debit: dec(debit),
    credit: dec(credit),
    journalEntry: { entryDate: new Date(`${day}T10:00:00Z`) },
  });

  const sumDaily = (daily: Record<string, { revenue: Decimal; cogs: Decimal; expenses: Decimal }>) =>
    Object.values(daily).reduce(
      (acc, d) => ({
        revenue: acc.revenue.add(d.revenue),
        cogs: acc.cogs.add(d.cogs),
        expenses: acc.expenses.add(d.expenses),
      }),
      { revenue: dec(0), cogs: dec(0), expenses: dec(0) },
    );

  beforeEach(async () => {
    repo = {
      findChartOfAccounts: jest.fn().mockResolvedValue([
        revenue,
        cogs,
        expense,
      ]),
      aggregatedJournalLines: jest.fn().mockResolvedValue([]),
      findJournalLinesWithEntry: jest.fn().mockResolvedValue([]),
      countJournalLines: jest.fn().mockResolvedValue(0),
      findAccountBalances: jest.fn().mockResolvedValue([]),
      findAccountBalancesBulk: jest.fn().mockResolvedValue([]),
      findFirstAccountBalance: jest.fn().mockResolvedValue(null),
      findFinancialPeriodByDate: jest.fn().mockResolvedValue(null),
      positionalJournalEntryWhere: jest.fn(canonicalPopulation),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LedgerQueryService, { provide: LedgerRepository, useValue: repo }],
    }).compile();

    service = module.get<LedgerQueryService>(LedgerQueryService);
  });

  // ── structural parity: the daily series must not rebuild the predicate ──

  it('daily journalEntry clause comes verbatim from the canonical factory', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-12-31T23:59:59Z');

    await service.getPnlReport({ companyId: 'comp-1', dateFrom: from, dateTo: to });

    // The factory is consulted with the report's own company + range.
    expect(repo.positionalJournalEntryWhere).toHaveBeenCalledWith('comp-1', {
      dateFrom: from,
      dateTo: to,
      onlyPosted: true,
    });

    const where = repo.findJournalLinesWithEntry.mock.calls[0][0];
    // Deep equality against what the factory returned — proves the service adds
    // no hand-written status / REVERSAL / company / date predicate of its own.
    expect(where.journalEntry).toEqual(
      repo.positionalJournalEntryWhere.mock.results[0].value,
    );
    // Only the line-level classification constraint is added by the service.
    expect(where.account).toEqual({
      accountType: { in: ['REVENUE', 'EXPENSE'] },
    });
    // And the canonical reversal exclusion is genuinely present in it.
    expect(where.journalEntry.OR).toEqual([
      { referenceType: null },
      { referenceType: { not: 'REVERSAL' } },
    ]);
    expect(where.journalEntry.status).toBe('POSTED');
    expect(where.journalEntry.companyId).toBe('comp-1');
  });

  // ── account lifecycle must not gate historical amounts ──

  it('does not filter the classification lookup by isActive / deletedAt', async () => {
    await service.getPnlReport({ companyId: 'comp-1' });

    expect(repo.findChartOfAccounts).toHaveBeenCalledWith({ companyId: 'comp-1' });
    expect(repo.findChartOfAccounts).not.toHaveBeenCalledWith(
      expect.objectContaining({ isActive: expect.anything() }),
    );
  });

  it('an INACTIVE historical expense account stays in header and daily', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      revenue,
      cogs,
      expense,
      inactiveExpense,
    ]);
    repo.aggregatedJournalLines
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { accountId: 'c1', totalDebit: dec('0'), totalCredit: dec('0') },
        { accountId: 'e8', totalDebit: dec('300'), totalCredit: dec('0') },
      ]);
    repo.findJournalLinesWithEntry.mockResolvedValue([
      line('e8', '2026-02-01', '300', '0'),
    ]);

    const result = await service.getPnlReport({ companyId: 'comp-1' });

    expect(result.expenses).toEqual(dec('300'));
    expect(sumDaily(result.daily).expenses).toEqual(dec('300'));
  });

  it('a SOFT-DELETED historical expense account stays in header and daily', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      revenue,
      cogs,
      expense,
      softDeletedExpense,
    ]);
    repo.aggregatedJournalLines.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { accountId: 'e9', totalDebit: dec('175'), totalCredit: dec('0') },
    ]);
    repo.findJournalLinesWithEntry.mockResolvedValue([
      line('e9', '2026-02-01', '175', '0'),
    ]);

    const result = await service.getPnlReport({ companyId: 'comp-1' });

    expect(result.expenses).toEqual(dec('175'));
    expect(sumDaily(result.daily).expenses).toEqual(dec('175'));
  });

  it('an INACTIVE 5xxx account is classified as COGS, never as an operating expense', async () => {
    // Regression: with an active-only lookup the inactive account was absent
    // from the map, so `account?.code.startsWith('5')` was undefined and the
    // historical COGS amount landed in operating expenses instead.
    repo.findChartOfAccounts.mockResolvedValue([revenue, cogs, inactiveCogs]);
    repo.aggregatedJournalLines.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { accountId: 'c9', totalDebit: dec('420'), totalCredit: dec('0') },
    ]);
    repo.findJournalLinesWithEntry.mockResolvedValue([
      line('c9', '2026-02-01', '420', '0'),
    ]);

    const result = await service.getPnlReport({ companyId: 'comp-1' });

    expect(result.cogs).toEqual(dec('420'));
    expect(result.expenses).toEqual(dec(0));
    expect(sumDaily(result.daily).cogs).toEqual(dec('420'));
    expect(sumDaily(result.daily).expenses).toEqual(dec(0));
  });

  // ── header ⇄ daily parity over a full reversal-relevant dataset ──

  it('header totals equal the sum of daily buckets for the whole dataset', async () => {
    // Dataset spans every referenceType class that matters: a normal POSTED
    // entry, a NULL referenceType entry, FT reversal, supplier-payment
    // reversal — plus a REVERSAL compensation which must be absent from BOTH
    // sides because the canonical population excludes it.
    repo.findChartOfAccounts.mockResolvedValue([revenue, cogs, expense]);
    // REVENUE aggregate
    repo.aggregatedJournalLines
      .mockResolvedValueOnce([
        { accountId: 'r1', totalDebit: dec('100'), totalCredit: dec('1100') },
      ])
      // EXPENSE aggregate (a REVERSAL compensation contributed nothing above)
      .mockResolvedValueOnce([
        { accountId: 'c1', totalDebit: dec('100'), totalCredit: dec('0') },
        { accountId: 'e1', totalDebit: dec('240'), totalCredit: dec('0') },
      ]);

    repo.findJournalLinesWithEntry.mockResolvedValue([
      line('r1', '2026-01-10', '0', '1100'), // normal POSTED sale
      line('e1', '2026-01-11', '240', '0'), // NULL referenceType expense
      line('r1', '2026-01-12', '100', '0'), // FT / supplier reversal leg...
      line('c1', '2026-01-12', '100', '0'), // ...and its offsetting COGS leg
    ]);

    const result = await service.getPnlReport({ companyId: 'comp-1' });

    expect(result.revenue).toEqual(dec('1000'));
    expect(result.cogs).toEqual(dec('100'));
    expect(result.expenses).toEqual(dec('240'));

    const daily = sumDaily(result.daily);
    expect(daily.revenue).toEqual(result.revenue);
    expect(daily.cogs).toEqual(result.cogs);
    expect(daily.expenses).toEqual(result.expenses);
  });

  it('a REVERSAL compensation cannot reach the daily series', async () => {
    // The factory's OR-disjunction is what makes this true; asserting the daily
    // clause carries it is the direct guard against the pre-G16-N-8-B defect
    // where daily kept only `status: POSTED` and showed the compensation.
    await service.getPnlReport({ companyId: 'comp-1' });

    const where = repo.findJournalLinesWithEntry.mock.calls[0][0];
    const survives = where.journalEntry.OR.some(
      (b: Record<string, unknown>) =>
        b.referenceType === null ||
        (b.referenceType as { not: string }).not === 'REVERSAL',
    );
    expect(survives).toBe(true);
    expect(where.journalEntry.OR).toHaveLength(2);
    // A bare `{ not }` would silently drop NULL-referenceType rows in PG.
    expect(where.journalEntry.referenceType).toBeUndefined();
  });

  // ── complete paging: no arbitrary 100000 ceiling ──

  it('pages until the final short page and combines every page', async () => {
    // Force >1 page: return exactly PNL_DAILY_PAGE_SIZE rows for the first two
    // calls, then a short page. Any implementation that stopped at the first
    // page (the old `take: 100000` single read) would under-count.
    const full = (count: number, day: string) =>
      Array.from({ length: count }, () => line('e1', day, '1', '0'));

    repo.findJournalLinesWithEntry
      .mockResolvedValueOnce(full(1000, '2026-01-01'))
      .mockResolvedValueOnce(full(1000, '2026-01-02'))
      .mockResolvedValueOnce([line('e1', '2026-01-03', '7', '0')]);
    repo.aggregatedJournalLines.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { accountId: 'e1', totalDebit: dec('2007'), totalCredit: dec('0') },
    ]);

    const result = await service.getPnlReport({ companyId: 'comp-1' });

    expect(repo.findJournalLinesWithEntry).toHaveBeenCalledTimes(3);
    expect(repo.findJournalLinesWithEntry.mock.calls[0][1]).toEqual({
      skip: 0,
      take: 1000,
    });
    expect(repo.findJournalLinesWithEntry.mock.calls[1][1]).toEqual({
      skip: 1000,
      take: 1000,
    });
    expect(repo.findJournalLinesWithEntry.mock.calls[2][1]).toEqual({
      skip: 2000,
      take: 1000,
    });
    // 1000 + 1000 + 7 rows, all combined across pages and days.
    expect(Object.keys(result.daily)).toHaveLength(3);
    expect(sumDaily(result.daily).expenses).toEqual(dec('2007'));
    expect(result.expenses).toEqual(dec('2007'));
  });

  it('stops immediately when the first page is already short', async () => {
    repo.findJournalLinesWithEntry.mockResolvedValue([
      line('e1', '2026-01-01', '10', '0'),
    ]);

    await service.getPnlReport({ companyId: 'comp-1' });

    expect(repo.findJournalLinesWithEntry).toHaveBeenCalledTimes(1);
  });

  it('an empty population issues exactly one page request', async () => {
    repo.findJournalLinesWithEntry.mockResolvedValue([]);

    const result = await service.getPnlReport({ companyId: 'comp-1' });

    expect(repo.findJournalLinesWithEntry).toHaveBeenCalledTimes(1);
    expect(result.daily).toEqual({});
  });

  it('preserves tenant isolation on every page request', async () => {
    repo.findChartOfAccounts.mockResolvedValue([revenue, cogs, expense]);
    repo.aggregatedJournalLines.mockResolvedValue([]);
    repo.findJournalLinesWithEntry
      .mockResolvedValueOnce(
        Array.from({ length: 1000 }, () => line('e1', '2026-01-01', '1', '0')),
      )
      .mockResolvedValueOnce([]);

    await service.getPnlReport({ companyId: 'tenant-9' });

    expect(repo.findChartOfAccounts).toHaveBeenCalledWith({
      companyId: 'tenant-9',
    });
    for (const call of repo.findJournalLinesWithEntry.mock.calls) {
      expect(call[0].journalEntry.companyId).toBe('tenant-9');
    }
  });
});
