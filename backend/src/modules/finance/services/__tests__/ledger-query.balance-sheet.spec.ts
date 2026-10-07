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
    // G16: this used to pin `isActive: true, deletedAt: null`, which is the
    // load-bearing defect — it made lifecycle flags gate the accounting
    // population. Tenant isolation is re-proved BEHAVIOURALLY below instead:
    // a retired account in ANOTHER tenant must not leak into this statement,
    // while this tenant's own retired accounts remain fully reported.
    repo.findChartOfAccounts.mockResolvedValue([
      account('cash', '1000', 'Cash', 'ASSET', 'DEBIT'),
    ]);

    await service.getBalanceSheet({ companyId: 'tenant-X' });

    // companyId still reaches the account lookup; no lifecycle filter.
    expect(repo.findChartOfAccounts).toHaveBeenCalledWith({
      companyId: 'tenant-X',
    });
    expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('tenant-X', {
      onlyPosted: true,
    });
  });

  // ── G16 — historical-account lifecycle integrity ─────────────────────
  // CR-1: JournalLines are accounting history. isActive/deletedAt gate
  // posting (CR-2) and API visibility (CR-3) — never financial amounts.

  it('G16. tenant isolation is behavioural: a retired account stays in its own statement and no other account leaks', async () => {
    // 'mine' is retired; 'theirs' belongs to a different company and must never
    // appear because it is not in this company's account list at all.
    repo.findChartOfAccounts.mockResolvedValue([
      { ...account('mine', '1000', 'Cash', 'ASSET', 'DEBIT'), isActive: false },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('mine', '5000', '0'),
      agg('theirs', '999999', '0'), // foreign account id — must be ignored
    ]);

    const result = await service.getBalanceSheet({ companyId: 'tenant-X' });

    expect(result.assets.rows.map((r) => r.accountId)).toEqual(['mine']);
    expect(result.assets.total).toBe('5000.0000');
    expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('tenant-X', {
      onlyPosted: true,
    });
  });

  it('G16. an INACTIVE asset appears in assets with its balance', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      {
        ...account('asset', '1500', 'Equipment', 'ASSET', 'DEBIT'),
        isActive: false,
      },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([agg('asset', '5000', '0')]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.assets.rows).toHaveLength(1);
    expect(result.assets.rows[0]!.accountCode).toBe('1500');
    expect(result.assets.rows[0]!.balance).toBe('5000.0000');
    expect(result.assets.total).toBe('5000.0000');
  });

  it('G16. an INACTIVE liability appears with its balance', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      {
        ...account('loan', '2100', 'Loan', 'LIABILITY', 'CREDIT'),
        isActive: false,
      },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([agg('loan', '0', '7000')]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.liabilities.rows).toHaveLength(1);
    expect(result.liabilities.rows[0]!.balance).toBe('7000.0000');
    expect(result.liabilities.total).toBe('7000.0000');
  });

  it('G16. an INACTIVE equity account appears with its balance', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      {
        ...account('cap', '3000', 'Capital', 'EQUITY', 'CREDIT'),
        isActive: false,
      },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([agg('cap', '0', '2500')]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.equity.rows).toHaveLength(1);
    expect(result.equity.rows[0]!.balance).toBe('2500.0000');
    expect(result.equity.total).toBe('2500.0000');
  });

  it('G16. a SOFT-DELETED account behaves exactly like an inactive one', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      {
        ...account('asset', '1500', 'Equipment', 'ASSET', 'DEBIT'),
        deletedAt: new Date(),
      },
      {
        ...account('cap', '3000', 'Capital', 'EQUITY', 'CREDIT'),
        deletedAt: new Date(),
      },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('asset', '5000', '0'),
      agg('cap', '0', '5000'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.assets.total).toBe('5000.0000');
    expect(result.equity.total).toBe('5000.0000');
    expect(result.balanced).toBe(true);
  });

  it('G16. an INACTIVE revenue account still contributes to currentEarnings', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      {
        ...account('rev', '4000', 'Revenue', 'REVENUE', 'CREDIT'),
        isActive: false,
      },
      account('exp', '6100', 'Rent', 'EXPENSE', 'DEBIT'),
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('rev', '0', '10000'),
      agg('exp', '4000', '0'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    // 10000 revenue − 4000 expense. Retiring the revenue account must not
    // delete revenue from the statement.
    expect(result.currentEarnings).toBe('6000.0000');
  });

  it('G16. an INACTIVE expense account still reduces currentEarnings', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      account('rev', '4000', 'Revenue', 'REVENUE', 'CREDIT'),
      {
        ...account('exp', '6100', 'Rent', 'EXPENSE', 'DEBIT'),
        isActive: false,
      },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('rev', '0', '10000'),
      agg('exp', '4000', '0'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.currentEarnings).toBe('6000.0000');
  });

  it('G16. revenue/expense accounts contribute to currentEarnings but are never balance-sheet rows', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      account('rev', '4000', 'Revenue', 'REVENUE', 'CREDIT'),
      {
        ...account('exp', '6100', 'Rent', 'EXPENSE', 'DEBIT'),
        isActive: false,
      },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('rev', '0', '10000'),
      agg('exp', '4000', '0'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.assets.rows).toEqual([]);
    expect(result.liabilities.rows).toEqual([]);
    expect(result.equity.rows).toEqual([]);
    expect(result.currentEarnings).toBe('6000.0000');
  });

  it('G16. Mode C — BOTH legs retired no longer yields a silent 0/0 "balanced" balance sheet', async () => {
    // THE regression. A historical ASSET 5000 and its EQUITY 5000 offset, both
    // retired. Before G16 both were filtered out: 0 rows, assets 0, L+E 0 and
    // `balanced: true` — a materially wrong statement with no signal at all.
    // A single retired account cannot prove this; both legs are required.
    repo.findChartOfAccounts.mockResolvedValue([
      {
        ...account('asset', '1500', 'Equipment', 'ASSET', 'DEBIT'),
        isActive: false,
        deletedAt: new Date(),
      },
      {
        ...account('cap', '3000', 'Capital', 'EQUITY', 'CREDIT'),
        isActive: false,
        deletedAt: new Date(),
      },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('asset', '5000', '0'),
      agg('cap', '0', '5000'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    // Both rows present, both amounts visible.
    expect(result.assets.rows).toHaveLength(1);
    expect(result.equity.rows).toHaveLength(1);
    expect(result.assets.rows[0]!.accountId).toBe('asset');
    expect(result.equity.rows[0]!.accountId).toBe('cap');
    expect(result.assets.total).toBe('5000.0000');
    expect(result.equity.total).toBe('5000.0000');
    // Identity holds with REAL amounts, not with zeroed ones.
    expect(result.totalLiabilitiesAndEquity).toBe('5000.0000');
    expect(result.balanced).toBe(true);
    // The exact signature of the old defect must be unreachable.
    expect(result.assets.total).not.toBe('0.0000');
  });

  it('G16. only one leg retired still produces a balanced sheet with real amounts', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      account('asset', '1500', 'Equipment', 'ASSET', 'DEBIT'),
      {
        ...account('cap', '3000', 'Capital', 'EQUITY', 'CREDIT'),
        isActive: false,
      },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('asset', '5000', '0'),
      agg('cap', '0', '5000'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.assets.total).toBe('5000.0000');
    expect(result.equity.total).toBe('5000.0000');
    expect(result.balanced).toBe(true);
  });

  it('G16. accounting identity holds across a mixed active/inactive/soft-deleted population', async () => {
    repo.findChartOfAccounts.mockResolvedValue([
      account('cash', '1010', 'Cash', 'ASSET', 'DEBIT'),
      {
        ...account('asset', '1500', 'Equipment', 'ASSET', 'DEBIT'),
        isActive: false,
      },
      {
        ...account('loan', '2100', 'Loan', 'LIABILITY', 'CREDIT'),
        deletedAt: new Date(),
      },
      {
        ...account('cap', '3000', 'Capital', 'EQUITY', 'CREDIT'),
        isActive: false,
      },
      {
        ...account('rev', '4000', 'Revenue', 'REVENUE', 'CREDIT'),
        isActive: false,
      },
      {
        ...account('exp', '6100', 'Rent', 'EXPENSE', 'DEBIT'),
        deletedAt: new Date(),
      },
    ]);
    // Balanced fixture, equity on its normal CREDIT side:
    //   Dr = 100 cash + 5000 asset + 600 expense            = 5700
    //   Cr = 1500 loan + 3000 equity + 3000 revenue        = 7500
    // equity 3000 (credit) + revenue 3000 − expense 600 ⇒ L+E = 1500 + 3000 + 2400 = 6900,
    // assets must be 6900 ⇒ cash 1900.
    repo.aggregatedJournalLines.mockResolvedValue([
      agg('cash', '1900', '0'),
      agg('asset', '5000', '0'),
      agg('loan', '0', '1500'),
      agg('cap', '0', '3000'),
      agg('rev', '0', '3000'),
      agg('exp', '600', '0'),
    ]);

    const result = await service.getBalanceSheet({ companyId: 'comp-1' });

    expect(result.assets.total).toBe('6900.0000'); // 1900 + 5000
    expect(result.liabilities.total).toBe('1500.0000');
    expect(result.equity.total).toBe('3000.0000'); // credit − debit = 3000
    expect(result.currentEarnings).toBe('2400.0000'); // 3000 − 600
    // assetsTotal === liabilitiesTotal + equityTotal + currentEarnings
    expect(result.totalLiabilitiesAndEquity).toBe(
      new Decimal(result.liabilities.total)
        .add(result.equity.total)
        .add(result.currentEarnings)
        .toFixed(4),
    );
    expect(result.balanced).toBe(true);
  });

  it('G16. asOfDate is still forwarded to the journal aggregate, unaffected by lifecycle', async () => {
    const asOfDate = new Date('2026-06-30T00:00:00Z');
    repo.findChartOfAccounts.mockResolvedValue([
      {
        ...account('asset', '1500', 'Equipment', 'ASSET', 'DEBIT'),
        isActive: false,
      },
    ]);
    repo.aggregatedJournalLines.mockResolvedValue([agg('asset', '5000', '0')]);

    await service.getBalanceSheet({ companyId: 'comp-1', asOfDate });

    expect(repo.aggregatedJournalLines).toHaveBeenCalledWith('comp-1', {
      asOfDate,
      onlyPosted: true,
    });
    // CR-4: lifecycle never participates in an as-of answer.
    expect(repo.findChartOfAccounts).toHaveBeenCalledWith({
      companyId: 'comp-1',
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
