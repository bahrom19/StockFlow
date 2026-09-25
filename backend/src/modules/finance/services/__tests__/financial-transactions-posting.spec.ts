import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { FinancialTransactionsService } from '../financial-transactions.service';
import { FinancialTransactionsRepository } from '../../repositories/financial-transactions.repository';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { GlEngineService } from '../gl-engine.service';
import { FiscalCalendarService } from '../fiscal-calendar.service';
import { IdempotencyService } from '../../../../infrastructure/idempotency/idempotency.service';
import {
  claimsSaleRefundOwnership,
  planPosting,
} from '../financial-transaction-posting.policy';

const dec = (v: string | number) => new Decimal(v);
const companyId = 'comp-1';
const userId = 'user-1';
const user = { companyId, userId } as any;

const ftRow = (over: Record<string, unknown> = {}) => ({
  id: 'ft-1',
  companyId,
  type: 'BANK_DEPOSIT',
  direction: 'INFLOW',
  amount: dec('1000'),
  fee: dec('0'),
  netAmount: dec('1000'),
  currency: 'KZT',
  exchangeRate: dec('1'),
  transactionDate: new Date('2026-09-10T00:00:00.000Z'),
  description: null,
  referenceNumber: null,
  isReconciled: false,
  reconciledAt: null,
  cashAccountId: 'cash-1',
  bankAccountId: 'bank-1',
  destinationBankAccountId: null,
  referenceType: null,
  referenceId: null,
  postingStatus: 'DRAFT',
  journalEntryId: null,
  idempotencyKey: null,
  createdBy: userId,
  rowVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe('FinancialTransactionsService.post — G15-07-C3-A', () => {
  let service: FinancialTransactionsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tx: Record<string, any>;
  let glPost: jest.Mock;
  let calendar: { ensureCurrentCalendar: jest.Mock };
  let auditLog: { log: jest.Mock };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let idempotency: Record<string, any>;

  beforeEach(async () => {
    tx = {
      chartOfAccount: { findFirst: jest.fn() },
      cashAccount: { findFirst: jest.fn() },
      bankAccount: { findFirst: jest.fn() },
      financialPeriod: { findFirst: jest.fn() },
      journalEntry: { findFirst: jest.fn() },
      sale: { findFirst: jest.fn().mockResolvedValue(null) },
      salesRefund: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    // Default: registers without linked GL accounts (family fallback),
    // chart codes resolve, an OPEN period covers the date.
    tx.cashAccount.findFirst.mockResolvedValue({ chartOfAccountId: null });
    tx.bankAccount.findFirst.mockResolvedValue({ chartOfAccountId: null });
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) =>
      where?.code ? { id: `acc-${where.code}` } : null,
    );
    tx.financialPeriod.findFirst.mockResolvedValue({ id: 'fp-1' });

    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      claimPostingStatus: jest.fn().mockResolvedValue(1),
      linkJournalEntry: jest.fn().mockResolvedValue(undefined),
    };
    glPost = jest
      .fn()
      .mockResolvedValue({ id: 'je-1', entryNumber: 7, status: 'POSTED' });
    calendar = { ensureCurrentCalendar: jest.fn().mockResolvedValue({}) };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    idempotency = {
      reserve: jest
        .fn()
        .mockResolvedValue({ type: 'created', requestHash: 'h' }),
      complete: jest.fn().mockResolvedValue(undefined),
      hashRequest: jest.fn((p: unknown) => JSON.stringify(p)),
    };

    const mockPrisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialTransactionsService,
        { provide: FinancialTransactionsRepository, useValue: repo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: auditLog },
        {
          provide: CompaniesService,
          useValue: { getBaseCurrency: jest.fn().mockResolvedValue('KZT') },
        },
        { provide: GlEngineService, useValue: { post: glPost } },
        { provide: FiscalCalendarService, useValue: calendar },
        { provide: IdempotencyService, useValue: idempotency },
      ],
    }).compile();

    service = mod.get(FinancialTransactionsService);
  });

  const setupPost = (over: Record<string, unknown> = {}) => {
    const row = ftRow(over);
    repo.findById.mockResolvedValue(row);
    return row;
  };

  const linesOf = () => glPost.mock.calls[0][0].lines as Array<any>;

  // ── posting happy paths ────────────────────────────────────────────

  it('BANK_DEPOSIT posts one JE: Dr bank / Cr cash with date + period', async () => {
    setupPost();
    repo.findById.mockResolvedValueOnce(ftRow()).mockResolvedValueOnce(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );

    const result = await service.post('ft-1', user);

    expect(glPost).toHaveBeenCalledTimes(1);
    const input = glPost.mock.calls[0][0];
    expect(input.companyId).toBe(companyId);
    expect(input.financialPeriodId).toBe('fp-1');
    expect(input.entryDate).toEqual(
      new Date('2026-09-10T00:00:00.000Z'),
    );
    expect(input.referenceType).toBe('FINANCIAL_TRANSACTION');
    expect(input.referenceId).toBe('ft-1');
    const lines = linesOf();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual(
      expect.objectContaining({ accountId: 'acc-1020', debit: '1000.0000' }),
    );
    expect(lines[1]).toEqual(
      expect.objectContaining({ accountId: 'acc-1010', credit: '1000.0000' }),
    );
    expect(repo.linkJournalEntry).toHaveBeenCalledWith(
      'ft-1',
      companyId,
      'je-1',
      tx,
    );
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'POST', entityId: 'ft-1' }),
      tx,
    );
    expect(calendar.ensureCurrentCalendar).toHaveBeenCalledWith(
      companyId,
      tx,
    );
    expect(result.postingStatus).toBe('POSTED');
    expect(result.journalEntryId).toBe('je-1');
  });

  it('uses the register linked GL account instead of the family fallback', async () => {
    setupPost();
    repo.findById.mockResolvedValueOnce(ftRow()).mockResolvedValueOnce(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );
    tx.cashAccount.findFirst.mockResolvedValue({
      chartOfAccountId: 'acc-custom-cash',
    });
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.id) return { id: where.id };
      if (where?.code) return { id: `acc-${where.code}` };
      return null;
    });

    await service.post('ft-1', user);

    const lines = linesOf();
    expect(lines[1].accountId).toBe('acc-custom-cash');
    expect(lines[0].accountId).toBe('acc-1020');
  });

  it('FEE posts Dr 6100 / Cr cash', async () => {
    setupPost({ type: 'FEE', direction: 'OUTFLOW', bankAccountId: null });
    repo.findById.mockResolvedValueOnce(
      ftRow({ type: 'FEE', direction: 'OUTFLOW', bankAccountId: null }),
    ).mockResolvedValueOnce(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );

    await service.post('ft-1', user);

    const lines = linesOf();
    expect(lines[0]).toEqual(
      expect.objectContaining({ accountId: 'acc-6100', debit: '1000.0000' }),
    );
    expect(lines[1]).toEqual(
      expect.objectContaining({ accountId: 'acc-1010', credit: '1000.0000' }),
    );
  });

  it('INTEREST posts Dr bank / Cr 4200', async () => {
    setupPost({
      type: 'INTEREST',
      direction: 'INFLOW',
      cashAccountId: null,
    });
    repo.findById.mockResolvedValueOnce(
      ftRow({ type: 'INTEREST', direction: 'INFLOW', cashAccountId: null }),
    ).mockResolvedValueOnce(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );

    await service.post('ft-1', user);

    const lines = linesOf();
    expect(lines[0]).toEqual(
      expect.objectContaining({ accountId: 'acc-1020', debit: '1000.0000' }),
    );
    expect(lines[1]).toEqual(
      expect.objectContaining({ accountId: 'acc-4200', credit: '1000.0000' }),
    );
  });

  it('BANK_TRANSFER posts one JE between the two banks, no P&L', async () => {
    setupPost({
      type: 'BANK_TRANSFER',
      direction: 'OUTFLOW',
      cashAccountId: null,
      destinationBankAccountId: 'bank-2',
    });
    repo.findById.mockResolvedValueOnce(
      ftRow({
        type: 'BANK_TRANSFER',
        direction: 'OUTFLOW',
        cashAccountId: null,
        destinationBankAccountId: 'bank-2',
      }),
    ).mockResolvedValueOnce(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );
    tx.bankAccount.findFirst.mockImplementation(async ({ where }: any) =>
      where?.id === 'bank-2'
        ? { chartOfAccountId: 'acc-bank-2' }
        : { chartOfAccountId: null },
    );
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.id) return { id: where.id };
      if (where?.code) return { id: `acc-${where.code}` };
      return null;
    });

    await service.post('ft-1', user);

    expect(glPost).toHaveBeenCalledTimes(1);
    const lines = linesOf();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual(
      expect.objectContaining({ accountId: 'acc-bank-2', debit: '1000.0000' }),
    );
    expect(lines[1]).toEqual(
      expect.objectContaining({ accountId: 'acc-1020', credit: '1000.0000' }),
    );
  });

  it('INTERNAL_TRANSFER INFLOW posts Dr cash / Cr bank', async () => {
    setupPost({ type: 'INTERNAL_TRANSFER', direction: 'INFLOW' });
    repo.findById.mockResolvedValueOnce(
      ftRow({ type: 'INTERNAL_TRANSFER', direction: 'INFLOW' }),
    ).mockResolvedValueOnce(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );

    await service.post('ft-1', user);

    const lines = linesOf();
    expect(lines[0].accountId).toBe('acc-1010');
    expect(lines[1].accountId).toBe('acc-1020');
  });

  // ── default-deny ───────────────────────────────────────────────────

  it.each([
    ['LOAN_DISBURSEMENT', 'OUTFLOW'],
    ['LOAN_REPAYMENT', 'OUTFLOW'],
    ['DIVIDEND', 'OUTFLOW'],
    ['TAX_PAYMENT', 'OUTFLOW'],
  ])('deferred type %s fails closed with no JE', async (type, direction) => {
    setupPost({ type, direction });

    await expect(service.post('ft-1', user)).rejects.toThrow(
      BadRequestException,
    );
    expect(glPost).not.toHaveBeenCalled();
    expect(repo.claimPostingStatus).not.toHaveBeenCalled();
  });

  it('CASH_IN without a domain reference fails closed (never guesses)', async () => {
    setupPost({ type: 'CASH_IN', direction: 'INFLOW' });

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /no resolvable economic counterpart/,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  it('CASH_IN with a registered domain resolver posts the resolved leg', async () => {
    setupPost({
      type: 'CASH_IN',
      direction: 'INFLOW',
      referenceType: 'SUPPLIER_RETURN',
      referenceId: 'ref-9',
    });
    repo.findById.mockResolvedValueOnce(
      ftRow({
        type: 'CASH_IN',
        direction: 'INFLOW',
        referenceType: 'SUPPLIER_RETURN',
        referenceId: 'ref-9',
      }),
    ).mockResolvedValueOnce(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );
    service.registerCounterpartResolver('SUPPLIER_RETURN', async () => ({
      accountId: 'acc-domain',
    }));
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.id) return { id: where.id };
      if (where?.code) return { id: `acc-${where.code}` };
      return null;
    });

    await service.post('ft-1', user);

    const lines = linesOf();
    expect(lines[0].accountId).toBe('acc-1010');
    expect(lines[1].accountId).toBe('acc-domain');
  });

  it('direction mismatch fails deterministically (CASH_OUT + INFLOW)', async () => {
    setupPost({ type: 'CASH_OUT', direction: 'INFLOW' });

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /requires direction "OUTFLOW"/,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  it('BANK_TRANSFER to the same bank is rejected', async () => {
    setupPost({
      type: 'BANK_TRANSFER',
      direction: 'OUTFLOW',
      cashAccountId: null,
      destinationBankAccountId: 'bank-1',
    });

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /must differ/,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  // ── D6 refund guard ────────────────────────────────────────────────

  it('REFUND with sale-claiming referenceType is rejected (no double post)', async () => {
    setupPost({ type: 'REFUND', direction: 'OUTFLOW', referenceType: 'REFUND' });

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /sale-linked refunds must flow through the sales refund domain/,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  it('REFUND whose referenceId resolves to a Sale is rejected', async () => {
    setupPost({
      type: 'REFUND',
      direction: 'OUTFLOW',
      referenceType: 'CUSTOM_RETURN',
      referenceId: 'sale-1',
    });
    tx.sale.findFirst.mockResolvedValue({ id: 'sale-1' });

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /references an existing Sale\/SalesRefund/,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  it('non-sale REFUND with a registered resolver posts', async () => {
    setupPost({
      type: 'REFUND',
      direction: 'OUTFLOW',
      bankAccountId: null,
      referenceType: 'SUPPLIER_RETURN',
      referenceId: 'ref-9',
    });
    repo.findById.mockResolvedValueOnce(
      ftRow({
        type: 'REFUND',
        direction: 'OUTFLOW',
        bankAccountId: null,
        referenceType: 'SUPPLIER_RETURN',
        referenceId: 'ref-9',
      }),
    ).mockResolvedValueOnce(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );
    service.registerCounterpartResolver('SUPPLIER_RETURN', async () => ({
      accountId: 'acc-domain',
    }));
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.id) return { id: where.id };
      if (where?.code) return { id: `acc-${where.code}` };
      return null;
    });

    await service.post('ft-1', user);

    const lines = linesOf();
    expect(lines[0].accountId).toBe('acc-domain');
    expect(lines[1].accountId).toBe('acc-1010');
  });

  // ── lifecycle / tenancy / currency / period ────────────────────────

  it('create persists DRAFT with the new legs and traceability fields', async () => {
    repo.create.mockResolvedValue(ftRow());

    await service.create(
      {
        amount: '1000',
        type: 'BANK_TRANSFER',
        direction: 'OUTFLOW',
        bankAccountId: 'bank-1',
        destinationBankAccountId: 'bank-2',
      } as any,
      user,
      'key-1',
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        postingStatus: 'DRAFT',
        idempotencyKey: 'key-1',
        destinationBankAccount: { connect: { id: 'bank-2' } },
      }),
      tx,
    );
  });

  it('second post of a POSTED row conflicts without a second JE', async () => {
    repo.findById.mockResolvedValue(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );

    await expect(service.post('ft-1', user)).rejects.toThrow(
      ConflictException,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  it('lost CAS race (claim count 0) conflicts without posting', async () => {
    setupPost();
    repo.claimPostingStatus.mockResolvedValue(0);

    await expect(service.post('ft-1', user)).rejects.toThrow(
      ConflictException,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  it('non-base currency row is rejected at post time', async () => {
    setupPost({ currency: 'USD' });

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /base currency/,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  it('zero amount is rejected deterministically', async () => {
    setupPost({ amount: dec('0') });

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /non-positive amount/,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  it('missing OPEN period fails closed with no partial state', async () => {
    setupPost();
    tx.financialPeriod.findFirst.mockResolvedValue(null);

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /No OPEN financial period/,
    );
    expect(glPost).not.toHaveBeenCalled();
    expect(repo.linkJournalEntry).not.toHaveBeenCalled();
  });

  it('GL failure propagates and leaves no linkage', async () => {
    setupPost();
    glPost.mockRejectedValueOnce(new Error('period closed'));

    await expect(service.post('ft-1', user)).rejects.toThrow('period closed');
    expect(repo.linkJournalEntry).not.toHaveBeenCalled();
  });

  it('cross-company register resolves fail closed', async () => {
    setupPost();
    tx.cashAccount.findFirst.mockResolvedValue(null);
    tx.chartOfAccount.findFirst.mockResolvedValue(null);

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /not configured|missing/,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  it('F-AUD-02: deactivated/deleted register fails closed even with family fallback present', async () => {
    setupPost();
    // Register row exists but is dead → findFirst (live-only filter) is null.
    tx.cashAccount.findFirst.mockResolvedValue(null);

    await expect(service.post('ft-1', user)).rejects.toThrow(
      /not available for posting/,
    );
    expect(glPost).not.toHaveBeenCalled();
    expect(repo.claimPostingStatus).toHaveBeenCalledTimes(1);
  });

  it('F-AUD-02: register lookup carries the live-row filter', async () => {
    setupPost();
    repo.findById.mockResolvedValueOnce(ftRow()).mockResolvedValueOnce(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );

    await service.post('ft-1', user);

    expect(tx.cashAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cash-1',
          companyId,
          isActive: true,
          deletedAt: null,
        }),
      }),
    );
  });

  // ── update freeze ──────────────────────────────────────────────────

  it('POSTED financial fields are immutable; description stays editable', async () => {
    repo.findById.mockResolvedValue(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );

    await expect(
      service.update('ft-1', { amount: '5' } as any, user),
    ).rejects.toThrow(/immutable/);
    await expect(
      service.update('ft-1', { transactionDate: new Date() } as any, user),
    ).rejects.toThrow(/immutable/);

    repo.update.mockResolvedValue(ftRow());
    await service.update('ft-1', { description: 'note' } as any, user);
    expect(repo.update).toHaveBeenCalled();
  });

  it('transactionDate persists before POSTED (silent-drop gap closed)', async () => {
    const before = ftRow();
    repo.findById.mockResolvedValue(before);
    repo.update.mockResolvedValue(before);
    const date = new Date('2026-08-01T00:00:00.000Z');

    await service.update('ft-1', { transactionDate: date } as any, user);

    expect(repo.update).toHaveBeenCalledWith(
      'ft-1',
      expect.objectContaining({ transactionDate: date }),
      companyId,
      0,
      tx,
    );
  });

  it('F-AUD-04: reference linkage persists before POSTED, freezes after', async () => {
    const before = ftRow();
    repo.findById.mockResolvedValue(before);
    repo.update.mockResolvedValue(before);

    await service.update(
      'ft-1',
      { referenceType: 'SUPPLIER_RETURN', referenceId: 'ref-9' } as any,
      user,
    );
    expect(repo.update).toHaveBeenCalledWith(
      'ft-1',
      expect.objectContaining({
        referenceType: 'SUPPLIER_RETURN',
        referenceId: 'ref-9',
      }),
      companyId,
      0,
      tx,
    );

    repo.findById.mockResolvedValue(
      ftRow({ postingStatus: 'POSTED', journalEntryId: 'je-1' }),
    );
    await expect(
      service.update('ft-1', { referenceId: 'other' } as any, user),
    ).rejects.toThrow(/immutable/);
  });

  // ── idempotency ────────────────────────────────────────────────────

  it('same key replays the stored body without re-executing', async () => {
    const stored = { id: 'ft-1', postingStatus: 'POSTED' };
    idempotency.reserve.mockResolvedValue({
      type: 'replayed',
      status: 200,
      body: stored,
    });

    const result = await service.post('ft-1', user, 'key-1');

    expect(result).toEqual(stored);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(glPost).not.toHaveBeenCalled();
  });

  it('same key + different payload conflicts deterministically', async () => {
    idempotency.reserve.mockRejectedValue(
      new UnprocessableEntityException('different payload'),
    );

    await expect(service.post('ft-1', user, 'key-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(glPost).not.toHaveBeenCalled();
  });

  // ── reversal ───────────────────────────────────────────────────────

  const setupReverse = () => {
    const original = ftRow({
      type: 'FEE',
      direction: 'OUTFLOW',
      bankAccountId: null,
      postingStatus: 'POSTED',
      journalEntryId: 'je-0',
    });
    repo.findById.mockResolvedValue(original);
    tx.journalEntry.findFirst.mockResolvedValue({
      id: 'je-0',
      status: 'POSTED',
      lines: [
        { accountId: 'acc-6100', debit: dec('1000'), credit: dec('0') },
        { accountId: 'acc-1010', debit: dec('0'), credit: dec('1000') },
      ],
    });
    repo.create.mockImplementation(async (data: any) => ({
      ...ftRow(),
      ...data,
      id: 'ft-2',
    }));
    return original;
  };

  it('reverses with negated JE lines and a compensating POSTED FT', async () => {
    setupReverse();

    const result = await service.reverse('ft-1', user, 'duplicate');

    expect(repo.claimPostingStatus).toHaveBeenCalledWith(
      'ft-1',
      companyId,
      'POSTED',
      'REVERSED',
      0,
      tx,
    );
    expect(glPost).toHaveBeenCalledTimes(1);
    const input = glPost.mock.calls[0][0];
    expect(input.referenceType).toBe('FINANCIAL_TRANSACTION_REVERSAL');
    expect(input.referenceId).toBe('je-0');
    expect(input.lines).toEqual([
      expect.objectContaining({ accountId: 'acc-6100', credit: '1000' }),
      expect.objectContaining({ accountId: 'acc-1010', debit: '1000' }),
    ]);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        postingStatus: 'POSTED',
        direction: 'INFLOW',
        referenceType: 'FINANCIAL_TRANSACTION_REVERSAL',
        referenceId: 'ft-1',
      }),
      tx,
    );
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REVERSE', entityId: 'ft-1' }),
      tx,
    );
    expect(result.id).toBe('ft-2');
  });

  it('double reversal is rejected; non-POSTED cannot reverse', async () => {
    repo.findById.mockResolvedValue(
      ftRow({ postingStatus: 'REVERSED', journalEntryId: 'je-0' }),
    );
    await expect(service.reverse('ft-1', user)).rejects.toThrow(
      ConflictException,
    );

    repo.findById.mockResolvedValue(ftRow());
    await expect(service.reverse('ft-1', user)).rejects.toThrow(
      ConflictException,
    );
    expect(glPost).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('missing original JE fails closed', async () => {
    setupReverse();
    tx.journalEntry.findFirst.mockResolvedValue(null);

    await expect(service.reverse('ft-1', user)).rejects.toThrow(
      /not available for reversal/,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('financial-transaction-posting.policy — G15-07-C3-A', () => {
  it('rejects deferred types deterministically', () => {
    for (const type of [
      'LOAN_DISBURSEMENT',
      'LOAN_REPAYMENT',
      'DIVIDEND',
      'TAX_PAYMENT',
    ]) {
      const plan = planPosting({
        type,
        direction: 'OUTFLOW',
        cashAccountId: 'c',
        bankAccountId: 'b',
        destinationBankAccountId: null,
        hasDomainCounterpart: false,
      });
      expect(plan.postable).toBe(false);
      if (!plan.postable) expect(plan.code).toBe('DEFERRED_TYPE');
    }
  });

  it('detects sale-claiming reference types case-insensitively', () => {
    expect(claimsSaleRefundOwnership('REFUND')).toBe(true);
    expect(claimsSaleRefundOwnership('sale')).toBe(true);
    expect(claimsSaleRefundOwnership('SalesRefund')).toBe(true);
    expect(claimsSaleRefundOwnership('SUPPLIER_RETURN')).toBe(false);
    expect(claimsSaleRefundOwnership(null)).toBe(false);
  });

  it('unknown types fail closed', () => {
    const plan = planPosting({
      type: 'SOMETHING_NEW',
      direction: 'INFLOW',
      cashAccountId: 'c',
      bankAccountId: null,
      destinationBankAccountId: null,
      hasDomainCounterpart: false,
    });
    expect(plan.postable).toBe(false);
  });
});
