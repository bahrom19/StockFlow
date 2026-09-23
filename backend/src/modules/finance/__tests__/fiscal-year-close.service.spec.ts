import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FiscalYearCloseService } from '../services/fiscal-year-close.service';
import { PostingValidationService } from '../services/posting-validation.service';

const companyId = 'comp-1';
const userId = 'user-1';

const openPeriod = (month: number) => ({
  id: `period-${month}`,
  companyId,
  year: 2026,
  month,
  name: `2026-${month}`,
  startDate: new Date(2026, month - 1, 1),
  endDate: new Date(2026, month, 0),
  status: 'OPEN',
  rowVersion: 0,
});

const baseYear = {
  id: 'fy-1',
  companyId,
  year: 2026,
  isClosed: false,
  retainedEarningsAccountId: null,
};

describe('FiscalYearCloseService (G15-01)', () => {
  let service: FiscalYearCloseService;
  let mockTx: any;
  let mockPrisma: any;
  let mockGlEngine: any;
  let mockAuditLog: any;

  beforeEach(() => {
    mockTx = {
      fiscalYear: { findFirst: jest.fn(), update: jest.fn() },
      financialPeriod: { findMany: jest.fn(), update: jest.fn() },
      chartOfAccount: { findFirst: jest.fn(), findMany: jest.fn() },
      accountBalance: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mockPrisma = {
      $transaction: jest.fn((cb: (tx: any) => any) => cb(mockTx)),
    };
    mockGlEngine = {
      post: jest.fn().mockResolvedValue({ id: 'je-1' }),
    };
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };
    service = new FiscalYearCloseService(mockPrisma, mockGlEngine, mockAuditLog);
    mockTx.fiscalYear.findFirst.mockResolvedValue({ ...baseYear });
    mockTx.financialPeriod.findMany.mockResolvedValue([
      openPeriod(1),
      openPeriod(12),
    ]);
  });

  const balances = (revenue: string, expense: string) => {
    mockTx.chartOfAccount.findMany.mockResolvedValue([
      { id: 'rev-1', accountType: 'REVENUE' },
      { id: 'exp-1', accountType: 'EXPENSE' },
    ]);
    mockTx.accountBalance.findMany.mockResolvedValue([
      { accountId: 'rev-1', closingDebit: '0', closingCredit: revenue },
      { accountId: 'exp-1', closingDebit: expense, closingCredit: '0' },
    ]);
  };

  // 1. Positive P&L closes successfully with a POSTED closing journal.
  it('should close a profitable year: post journal, close periods and year', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue({ id: 're-3200' });
    balances('1000.0000', '200.0000');
    mockTx.fiscalYear.update.mockResolvedValue({});

    const result = await service.closeFiscalYear(companyId, 2026, userId);

    // Journal posted through the SAME outer transaction into December (OPEN).
    expect(mockGlEngine.post).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        financialPeriodId: 'period-12',
        referenceType: 'FISCAL_YEAR_CLOSE',
      }),
      mockTx,
    );
    const postedLines = mockGlEngine.post.mock.calls[0][0].lines;
    const reCredit = postedLines.find((l: any) => l.accountId === 're-3200');
    expect(reCredit.credit).toBe('800.0000');
    // Periods closed only after posting; year closed; audit written.
    expect(mockTx.financialPeriod.update).toHaveBeenCalledTimes(2);
    expect(mockTx.fiscalYear.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fy-1' } }),
    );
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CLOSE' }),
    );
    expect(result.retainedEarningsEntryId).toBe('je-1');
    expect(result.closedPeriodIds).toEqual(['period-1', 'period-12']);
  });

  // 2. Negative P&L closes with debit retained-earnings leg.
  it('should close a loss year with debit retained earnings', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue({ id: 're-3200' });
    balances('200.0000', '1000.0000');
    mockTx.fiscalYear.update.mockResolvedValue({});

    await service.closeFiscalYear(companyId, 2026, userId);

    const postedLines = mockGlEngine.post.mock.calls[0][0].lines;
    const reDebit = postedLines.find((l: any) => l.accountId === 're-3200');
    expect(reDebit.debit).toBe('800.0000');
    expect(mockTx.financialPeriod.update).toHaveBeenCalledTimes(2);
  });

  // 3. Zero P&L closes with no journal.
  it('should close a zero-P&L year without a closing journal', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue({ id: 're-3200' });
    balances('500.0000', '500.0000');
    mockTx.fiscalYear.update.mockResolvedValue({});

    const result = await service.closeFiscalYear(companyId, 2026, userId);

    expect(mockGlEngine.post).not.toHaveBeenCalled();
    expect(result.retainedEarningsEntryId).toBe('');
    expect(mockTx.financialPeriod.update).toHaveBeenCalledTimes(2);
  });

  // 4. Already closed fiscal year is rejected with no side effects.
  it('should reject an already closed fiscal year', async () => {
    mockTx.fiscalYear.findFirst.mockResolvedValue({ ...baseYear, isClosed: true });

    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(BadRequestException);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
    expect(mockTx.financialPeriod.update).not.toHaveBeenCalled();
    expect(mockTx.fiscalYear.update).not.toHaveBeenCalled();
  });

  // 5. Missing retained earnings account rejects with no partial state.
  it('should reject when no retained earnings account exists', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue(null);
    balances('1000.0000', '200.0000');

    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow(/retained earnings/i);
    expect(mockGlEngine.post).not.toHaveBeenCalled();
    expect(mockTx.fiscalYear.update).not.toHaveBeenCalled();
    expect(mockTx.financialPeriod.update).not.toHaveBeenCalled();
  });

  // 7. Rollback: journal failure leaves year open and periods untouched.
  it('should roll back everything when the closing journal fails', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue({ id: 're-3200' });
    balances('1000.0000', '200.0000');
    mockGlEngine.post.mockRejectedValue(new BadRequestException('posting failed'));

    await expect(
      service.closeFiscalYear(companyId, 2026, userId),
    ).rejects.toThrow('posting failed');
    expect(mockTx.fiscalYear.update).not.toHaveBeenCalled();
    expect(mockTx.financialPeriod.update).not.toHaveBeenCalled();
    expect(mockAuditLog.log).not.toHaveBeenCalled();
  });

  // 8. Tenant isolation: everything is scoped to the caller's company.
  it('should scope fiscal year, periods and journal to the company', async () => {
    mockTx.chartOfAccount.findFirst.mockResolvedValue({ id: 're-3200' });
    balances('1000.0000', '200.0000');
    mockTx.fiscalYear.update.mockResolvedValue({});

    await service.closeFiscalYear(companyId, 2026, userId);

    expect(mockTx.fiscalYear.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId }) }),
    );
    expect(mockGlEngine.post).toHaveBeenCalledWith(
      expect.objectContaining({ companyId }),
      expect.anything(),
    );
  });
});

describe('PostingValidationService CLOSED-period guard (G15-01)', () => {
  it('6. posting into a CLOSED period remains rejected', async () => {
    const validation = new PostingValidationService();
    const tx = {
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p-dec',
          companyId,
          name: '2026-12',
          status: 'CLOSED',
          startDate: new Date(2026, 11, 1),
          endDate: new Date(2026, 11, 31),
        }),
      },
    } as any;

    await expect(
      validation.validate(
        {
          companyId,
          entryDate: new Date(2026, 11, 15),
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
