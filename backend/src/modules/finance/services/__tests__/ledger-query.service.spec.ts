import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerQueryService } from '../ledger-query.service';
import { LedgerRepository } from '../../repositories/ledger.repository';

const dec = (v: string | number) => new Decimal(v);

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
