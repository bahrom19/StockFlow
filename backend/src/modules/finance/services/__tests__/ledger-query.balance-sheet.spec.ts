import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerQueryService } from '../ledger-query.service';
import { LedgerRepository } from '../../repositories/ledger.repository';

const dec = (v: string | number) => new Decimal(v);

describe('LedgerQueryService.getBalanceSheet — G15-07-C2', () => {
  let service: LedgerQueryService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;

  const account = (
    id: string,
    code: string,
    name: string,
    accountType: string,
    normalBalance: string,
  ) => ({ id, code, name, accountType, normalBalance, level: 0 });

  const agg = (accountId: string, debit: string, credit: string) => ({
    accountId,
    totalDebit: dec(debit),
    totalCredit: dec(credit),
  });

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

  it('1. empty chart returns zeroed result and balanced=true', async () => {
    repo.findChartOfAccounts.mockResolvedValue([]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.assets).toEqual({ rows: [], total: '0.0000' });
    expect(result.liabilities).toEqual({ rows: [], total: '0.0000' });
    expect(result.equity).toEqual({ rows: [], total: '0.0000' });
    expect(result.currentEarnings).toBe('0.0000');
    expect(result.totalLiabilitiesAndEquity).toBe('0.0000');
    expect(result.balanced).toBe(true);
    // Early return — no journal aggregation for an empty chart.
    expect(repo.aggregatedJournalLines).not.toHaveBeenCalled();
  });

  it('2. asset + liability + equity rows, totals and footing', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      account('cash', '1000', 'Cash', 'ASSET', 'DEBIT'),
      account('ap', '2000', 'Accounts Payable', 'LIABILITY', 'CREDIT'),
      account('cap', '3000', 'Owner Capital', 'EQUITY', 'CREDIT'),
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('cash', '10000', '0'),
      agg('ap', '0', '4000'),
      agg('cap', '0', '6000'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.assets.rows).toHaveLength(1);
    expect(result.assets.rows[0]).toEqual({
      accountId: 'cash',
      accountCode: '1000',
      accountName: 'Cash',
      accountType: 'ASSET',
      level: 0,
      balance: '10000.0000',
    });
    expect(result.assets.total).toBe('10000.0000');
    expect(result.liabilities.total).toBe('4000.0000');
    expect(result.equity.total).toBe('6000.0000');
    expect(result.currentEarnings).toBe('0.0000');
    expect(result.totalLiabilitiesAndEquity).toBe('10000.0000');
    expect(result.balanced).toBe(true);
  });

  it('3. fiscal-year-close simulation: RE stays in equity, only post-close profit is currentEarnings', async () => {
    // Journals (double-entry, balanced by construction):
    //  1. Purchase 20000: Dr Inventory / Cr AP
    //  2. Sale 10000: Dr Cash / Cr Revenue
    //  3. COGS 6000: Dr COGS / Cr Inventory
    //  4. Close (FISCAL_YEAR_CLOSE): Dr Revenue 10000 / Cr COGS 6000 / Cr RE-3200 4000
    //  5. Post-close sale 5000: Dr Cash / Cr Revenue
    //  6. Post-close COGS 1500: Dr COGS / Cr Inventory
    repo.findChartOfAccounts.mockResolvedValue([
      account('cash', '1000', 'Cash', 'ASSET', 'DEBIT'),
      account('inv', '1400', 'Inventory', 'ASSET', 'DEBIT'),
      account('ap', '2000', 'Accounts Payable', 'LIABILITY', 'CREDIT'),
      account('re', '3200', 'Retained Earnings', 'EQUITY', 'CREDIT'),
      account('rev', '4000', 'Sales Revenue', 'REVENUE', 'CREDIT'),
      account('cogs', '5000', 'COGS', 'EXPENSE', 'DEBIT'),
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('cash', '15000', '0'),
      agg('inv', '20000', '7500'),
      agg('ap', '0', '20000'),
      agg('re', '0', '4000'),
      agg('rev', '10000', '15000'),
      agg('cogs', '7500', '6000'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    // Retained earnings is a plain posted EQUITY row — never special-cased.
    const reRow = result.equity.rows.find((r) => r.accountCode === '3200');
    expect(reRow).toBeDefined();
    expect(reRow!.balance).toBe('4000.0000');
    // Only post-close earnings: (15000−10000) − (7500−6000) = 5000 − 1500.
    expect(result.currentEarnings).toBe('3500.0000');
    expect(result.assets.total).toBe('27500.0000');
    expect(result.totalLiabilitiesAndEquity).toBe('27500.0000');
    expect(result.balanced).toBe(true);
  });

  it('4. loss produces negative currentEarnings with exact footing', async () => {
    // Dr Cash 1000 / Cr Revenue 1000; Dr Expense 3000 / Cr Cash 3000.
    repo.findChartOfAccounts.mockResolvedValue([
      account('cash', '1000', 'Cash', 'ASSET', 'DEBIT'),
      account('rev', '4000', 'Revenue', 'REVENUE', 'CREDIT'),
      account('exp', '6000', 'Expenses', 'EXPENSE', 'DEBIT'),
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('cash', '1000', '3000'),
      agg('rev', '0', '1000'),
      agg('exp', '3000', '0'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.currentEarnings).toBe('-2000.0000');
    expect(result.assets.total).toBe('-2000.0000');
    expect(result.totalLiabilitiesAndEquity).toBe('-2000.0000');
    expect(result.balanced).toBe(true);
  });

  it('5. asOfDate reaches the repository with onlyPosted:true', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      account('cash', '1000', 'Cash', 'ASSET', 'DEBIT'),
    ]);
    const asOfDate = new Date('2026-06-30T23:59:59.999Z');

    await service.getBalanceSheet({ companyId: 'comp-1', asOfDate });

    // Single aggregation call carrying the cutoff — later lines are excluded
    // by the repository filter, not in memory.
    expect(repo.aggregatedJournalLines).toHaveBeenCalledTimes(1);
    expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('comp-1', {
      asOfDate,
      onlyPosted: true,
    });
  });

  it('6. tenant isolation: both repository calls receive companyId', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      account('cash', '1000', 'Cash', 'ASSET', 'DEBIT'),
    ]);

    await service.getBalanceSheet({ companyId: 'tenant-X' });

    expect(repo.findChartOfAccounts).toHaveBeenCalledWith({
      companyId: 'tenant-X',
      isActive: true,
      deletedAt: null,
    });
    expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('tenant-X', {
      onlyPosted: true,
    });
  });

  it('7. contra position stays signed inside assets', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      account('eq', '1500', 'Equipment', 'ASSET', 'DEBIT'),
      account('dep', '1510', 'Accumulated Depreciation', 'ASSET', 'DEBIT'),
      account('cap', '3000', 'Owner Capital', 'EQUITY', 'CREDIT'),
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('eq', '5000', '0'),
      agg('dep', '0', '1500'),
      agg('cap', '0', '3500'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    const contra = result.assets.rows.find((r) => r.accountCode === '1510');
    expect(contra).toBeDefined();
    expect(contra!.balance).toBe('-1500.0000');
    // Never moved to liabilities.
    expect(
      result.liabilities.rows.find((r) => r.accountCode === '1510'),
    ).toBeUndefined();
    expect(result.assets.total).toBe('3500.0000');
    expect(result.balanced).toBe(true);
  });

  it('8. exact Decimal arithmetic with four-decimal output', async () => {
    // 0.1 + 0.2 style values that break binary floating point.
    repo.findChartOfAccounts.mockResolvedValue([
      account('cash', '1000', 'Cash', 'ASSET', 'DEBIT'),
      account('rev', '4000', 'Revenue', 'REVENUE', 'CREDIT'),
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('cash', '0.3', '0.1'),
      agg('rev', '0', '0.2'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.assets.rows[0]!.balance).toBe('0.2000');
    expect(result.currentEarnings).toBe('0.2000');
    expect(result.assets.total).toBe('0.2000');
    expect(result.totalLiabilitiesAndEquity).toBe('0.2000');
    expect(result.balanced).toBe(true);
  });
});
