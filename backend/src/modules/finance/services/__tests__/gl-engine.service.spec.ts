import { ConflictException, NotFoundException } from '@nestjs/common';
import { GlEngineService } from '../gl-engine.service';
import { JournalEntriesRepository } from '../../repositories/journal-entries.repository';
import { PostingValidationService } from '../posting-validation.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../../common/events';
import { JournalEntryStatus, Prisma } from '@prisma/client';

/**
 * M1 regression — GL Engine accountBalance race.
 *
 * Previously `updateAccountBalances` did `findFirst()` then `create()` for a
 * missing balance: two concurrent journal postings for a NEW account+period
 * both observed "no balance" and both called create(), the second hitting
 * P2002 (unique violation) → HTTP 400/500.
 *
 * The fix is a single atomic `upsert` on the compound unique
 * (companyId, accountId, financialPeriodId): the create branch initializes the
 * snapshot, the update branch atomically increments the running totals — no
 * lost update, no spurious conflict.
 */
describe('GlEngineService — atomic AccountBalance upsert (M1)', () => {
  let service: GlEngineService;
  let tx: {
    accountBalance: {
      upsert: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  const companyId = 'comp-1';
  const financialPeriodId = 'fp-1';
  const entryDate = new Date('2026-08-15T10:00:00Z');
  const lines = [{ accountId: 'acct-1', debit: '100', credit: '0' }];

  beforeEach(() => {
    tx = {
      accountBalance: {
        upsert: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const journalRepository = {} as JournalEntriesRepository;
    const validationService = {} as PostingValidationService;
    const prismaService = {} as PrismaService;
    const auditLog = {} as AuditLogService;
    const eventBus = {} as { publish: jest.Mock };

    service = new GlEngineService(
      journalRepository,
      validationService,
      prismaService,
      auditLog,
      eventBus as never,
    );
  });

  it('should upsert atomically (no findFirst/create race) for every line', async () => {
    await (
      service as unknown as {
        updateAccountBalances: (
          c: string,
          p: string,
          d: Date,
          l: typeof lines,
          t: typeof tx,
        ) => Promise<void>;
      }
    ).updateAccountBalances(companyId, financialPeriodId, entryDate, lines, tx);

    expect(tx.accountBalance.upsert).toHaveBeenCalledTimes(1);
    expect(tx.accountBalance.findFirst).not.toHaveBeenCalled();
    expect(tx.accountBalance.create).not.toHaveBeenCalled();
    expect(tx.accountBalance.updateMany).not.toHaveBeenCalled();
  });

  it('should initialize the balance snapshot in the create branch', async () => {
    await (
      service as unknown as {
        updateAccountBalances: (
          c: string,
          p: string,
          d: Date,
          l: typeof lines,
          t: typeof tx,
        ) => Promise<void>;
      }
    ).updateAccountBalances(companyId, financialPeriodId, entryDate, lines, tx);

    const call = tx.accountBalance.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      companyId_accountId_financialPeriodId: {
        companyId,
        accountId: 'acct-1',
        financialPeriodId,
      },
    });
    expect(call.create).toEqual(
      expect.objectContaining({
        companyId,
        accountId: 'acct-1',
        financialPeriodId,
        year: 2026,
        month: 8,
      }),
    );
    expect(call.create.periodDebit.toString()).toBe('100');
    expect(call.create.periodCredit.toString()).toBe('0');
    expect(call.create.closingDebit.toString()).toBe('100');
    expect(call.create.closingCredit.toString()).toBe('0');
  });

  it('should atomically increment running totals in the update branch', async () => {
    const creditLine = [{ accountId: 'acct-2', debit: '0', credit: '50' }];
    await (
      service as unknown as {
        updateAccountBalances: (
          c: string,
          p: string,
          d: Date,
          l: typeof creditLine,
          t: typeof tx,
        ) => Promise<void>;
      }
    ).updateAccountBalances(
      companyId,
      financialPeriodId,
      entryDate,
      creditLine,
      tx,
    );

    const call = tx.accountBalance.upsert.mock.calls[0][0];
    expect(call.update).toEqual({
      periodDebit: { increment: new Prisma.Decimal('0') },
      periodCredit: { increment: new Prisma.Decimal('50') },
      closingDebit: { increment: new Prisma.Decimal('0') },
      closingCredit: { increment: new Prisma.Decimal('50') },
      rowVersion: { increment: 1 },
    });
  });

  it('should handle multiple lines in one posting (one upsert each)', async () => {
    const multiLines = [
      { accountId: 'a1', debit: '100', credit: '0' },
      { accountId: 'a2', debit: '0', credit: '100' },
    ];
    await (
      service as unknown as {
        updateAccountBalances: (
          c: string,
          p: string,
          d: Date,
          l: typeof multiLines,
          t: typeof tx,
        ) => Promise<void>;
      }
    ).updateAccountBalances(
      companyId,
      financialPeriodId,
      entryDate,
      multiLines,
      tx,
    );

    expect(tx.accountBalance.upsert).toHaveBeenCalledTimes(2);
  });
});

/**
 * L1-a regression — AccountBalance calendar identity must be UTC.
 *
 * `updateAccountBalances` previously derived the denormalised year/month with
 * server-local getFullYear()/getMonth(), which disagrees with the UTC period
 * boundaries for boundary-instant postings and (on a non-UTC host) labels the
 * snapshot with a different accounting month than the period it belongs to.
 *
 * The mid-month fixture used by the M1 suite above cannot detect this, so these
 * tests deliberately use boundary instants and a forced non-UTC process TZ.
 */
describe('GlEngineService — L1-a UTC AccountBalance identity', () => {
  let service: GlEngineService;
  let tx: { accountBalance: { upsert: jest.Mock } };

  const companyId = 'comp-1';
  const financialPeriodId = 'fp-2026-09';
  const lines = [{ accountId: 'acct-1', debit: '100', credit: '0' }];

  beforeEach(() => {
    tx = { accountBalance: { upsert: jest.fn().mockResolvedValue({}) } };

    service = new GlEngineService(
      {} as JournalEntriesRepository,
      {} as PostingValidationService,
      {} as PrismaService,
      {} as AuditLogService,
      {} as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Simulate a host whose local calendar disagrees with UTC for a given instant.
   * process.env.TZ is not usable here — Jest/V8 does not re-read it at runtime
   * (verified), and CI runs at UTC where this defect is invisible. Only the
   * local getters are stubbed, so the UTC getters stay truthful — which is
   * exactly the distinction under test.
   */
  const simulateLocalZone = (localYear: number, localMonth: number) => {
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(localYear);
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(localMonth - 1);
  };

  const invoke = (entryDate: Date) =>
    (
      service as unknown as {
        updateAccountBalances: (
          c: string,
          p: string,
          d: Date,
          l: typeof lines,
          t: typeof tx,
        ) => Promise<void>;
      }
    ).updateAccountBalances(
      companyId,
      financialPeriodId,
      entryDate,
      lines,
      tx,
    );

  it('uses the UTC month for an east-of-UTC boundary instant', async () => {
    // 2026-10-01T00:30+05:00 === 2026-09-30T19:30Z.
    const entryDate = new Date('2026-10-01T00:30:00+05:00');
    expect(entryDate.getUTCFullYear()).toBe(2026);
    expect(entryDate.getUTCMonth() + 1).toBe(9);

    // Simulate a UTC+5 host (Asia/Almaty): local October, UTC September.
    simulateLocalZone(2026, 10);
    // Sanity: local and UTC disagree, so this fixture can detect the defect.
    expect(entryDate.getFullYear()).toBe(2026);
    expect(entryDate.getMonth() + 1).toBe(10);

    await invoke(entryDate);

    const call = tx.accountBalance.upsert.mock.calls[0][0];
    expect(call.create.year).toBe(2026);
    expect(call.create.month).toBe(9);
  });

  it('uses the UTC year for a west-of-UTC boundary instant that crosses the year', async () => {
    // 2025-12-31T20:00-05:00 === 2026-01-01T01:00Z.
    const entryDate = new Date('2025-12-31T20:00:00-05:00');
    expect(entryDate.getUTCFullYear()).toBe(2026);
    expect(entryDate.getUTCMonth() + 1).toBe(1);

    // Simulate a UTC-5 host (America/New_York): local 2025/12, UTC 2026/01.
    simulateLocalZone(2025, 12);
    expect(entryDate.getFullYear()).toBe(2025);
    expect(entryDate.getMonth() + 1).toBe(12);

    await invoke(entryDate);

    const call = tx.accountBalance.upsert.mock.calls[0][0];
    expect(call.create.year).toBe(2026);
    expect(call.create.month).toBe(1);
  });

  it('keeps the mid-month identity unchanged (no reporting semantic shift)', async () => {
    // Even under a simulated non-UTC host zone, a mid-month instant keeps its
    // UTC identity, so existing reporting semantics do not shift.
    simulateLocalZone(2026, 8);
    const entryDate = new Date('2026-08-15T10:00:00Z');

    await invoke(entryDate);

    const call = tx.accountBalance.upsert.mock.calls[0][0];
    expect(call.create.year).toBe(2026);
    expect(call.create.month).toBe(8);
  });
});

/**
 * G15-03-02 regression — concurrent GL reverse CAS protection.
 *
 * Previously `reverse()` did find → if POSTED → plain update: two concurrent
 * reverses both observed POSTED and both created a reversal journal (double
 * financial effect). The fix is a conditional CAS update
 * (id + companyId + status=POSTED → REVERSED) as the single linearization
 * point: exactly one concurrent reverse wins, the loser gets count = 0 and
 * must create nothing.
 */
describe('GlEngineService.reverse — CAS protection (G15-03-02)', () => {
  let service: GlEngineService;
  let tx: any;
  let journalRepository: {
    findById: jest.Mock;
    getNextEntryNumberInTransaction: jest.Mock;
    createInTransaction: jest.Mock;
  };
  let validationService: { validate: jest.Mock };
  let prismaService: { $transaction: jest.Mock };
  let auditLog: { log: jest.Mock };
  let eventBus: { publish: jest.Mock };

  const companyId = 'comp-1';
  const userId = 'user-1';

  const postedEntry = {
    id: 'je-1',
    companyId,
    financialPeriodId: 'fp-1',
    entryNumber: 7,
    status: JournalEntryStatus.POSTED,
    lines: [
      { accountId: 'a1', debit: '100', credit: '0', description: 'Cash' },
      { accountId: 'a2', debit: '0', credit: '100', description: 'Revenue' },
    ],
  };

  beforeEach(() => {
    tx = {
      journalEntry: {
        updateMany: jest.fn(),
        update: jest.fn().mockResolvedValue({
          entryNumber: 8,
          status: JournalEntryStatus.POSTED,
          totalDebit: { toString: () => '100' },
          totalCredit: { toString: () => '100' },
        }),
      },
      accountBalance: { upsert: jest.fn().mockResolvedValue({}) },
    };

    journalRepository = {
      findById: jest.fn(),
      getNextEntryNumberInTransaction: jest.fn().mockResolvedValue(8),
      createInTransaction: jest.fn().mockResolvedValue({
        id: 'je-rev-1',
        entryDate: new Date('2026-08-15T10:00:00Z'),
        lines: [],
      }),
    };
    validationService = {
      validate: jest.fn().mockResolvedValue({
        totalDebit: { toString: () => '100' },
        totalCredit: { toString: () => '100' },
      }),
    };
    prismaService = {
      $transaction: jest.fn((cb: any) => cb(tx)),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    service = new GlEngineService(
      journalRepository as unknown as JournalEntriesRepository,
      validationService as unknown as PostingValidationService,
      prismaService as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      eventBus as never,
    );
  });

  it('sequential reverse: POSTED → REVERSED with exactly one reversal journal', async () => {
    journalRepository.findById.mockResolvedValue(postedEntry);
    tx.journalEntry.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.reverse('je-1', companyId, userId, 'test');

    expect(result).toEqual({
      originalEntryId: 'je-1',
      reversalEntryId: 'je-rev-1',
      isReversal: true,
    });
    // CAS is the source of truth: id + companyId + status=POSTED.
    expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'je-1',
        companyId,
        status: JournalEntryStatus.POSTED,
      },
      data: {
        status: JournalEntryStatus.REVERSED,
        rowVersion: { increment: 1 },
      },
    });
    expect(
      journalRepository.createInTransaction,
    ).toHaveBeenCalledTimes(1);
    // Exact negation of the original lines.
    const created = journalRepository.createInTransaction.mock.calls[0][1];
    expect(created.lines).toEqual([
      expect.objectContaining({ accountId: 'a1', debit: '0', credit: '100' }),
      expect.objectContaining({ accountId: 'a2', debit: '100', credit: '0' }),
    ]);
    expect(created.referenceType).toBe('REVERSAL');
    expect(created.referenceId).toBe('je-1');
  });

  it('already reversed: rejects with ConflictException and creates no reversal', async () => {
    journalRepository.findById.mockResolvedValue({
      ...postedEntry,
      status: JournalEntryStatus.REVERSED,
    });
    tx.journalEntry.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.reverse('je-1', companyId, userId),
    ).rejects.toThrow(ConflictException);

    expect(
      journalRepository.createInTransaction,
    ).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('concurrent reverse: exactly one wins, one reversal journal, loser gets ConflictException', async () => {
    journalRepository.findById.mockResolvedValue(postedEntry);
    tx.journalEntry.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await service.reverse('je-1', companyId, userId);
    expect(first.reversalEntryId).toBe('je-rev-1');

    await expect(
      service.reverse('je-1', companyId, userId),
    ).rejects.toThrow(ConflictException);

    expect(
      journalRepository.createInTransaction,
    ).toHaveBeenCalledTimes(1);
  });

  it('failed reversal posting: CAS won first, no audit, no partial side effects', async () => {
    journalRepository.findById.mockResolvedValue(postedEntry);
    tx.journalEntry.updateMany.mockResolvedValue({ count: 1 });
    validationService.validate.mockRejectedValueOnce(
      new Error('Financial period is not open'),
    );

    await expect(
      service.reverse('je-1', companyId, userId),
    ).rejects.toThrow('Financial period is not open');

    // CAS ran before any side effect; the failure aborts before journal
    // creation and audit (rollback itself is the shared transaction).
    expect(
      tx.journalEntry.updateMany.mock.invocationCallOrder[0]!,
    ).toBeLessThan(validationService.validate.mock.invocationCallOrder[0]!);
    expect(
      journalRepository.createInTransaction,
    ).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('tenant isolation: foreign-company journal is not found, CAS never runs', async () => {
    journalRepository.findById.mockResolvedValue(null);

    await expect(
      service.reverse('je-1', 'comp-other', userId),
    ).rejects.toThrow(NotFoundException);

    expect(tx.journalEntry.updateMany).not.toHaveBeenCalled();
    expect(
      journalRepository.createInTransaction,
    ).not.toHaveBeenCalled();
  });
});
