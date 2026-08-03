import { GlEngineService } from '../gl-engine.service';
import { JournalEntriesRepository } from '../../repositories/journal-entries.repository';
import { PostingValidationService } from '../posting-validation.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../../common/events';
import { Prisma } from '@prisma/client';

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
    await (service as unknown as {
      updateAccountBalances: (
        c: string,
        p: string,
        d: Date,
        l: typeof lines,
        t: typeof tx,
      ) => Promise<void>;
    }).updateAccountBalances(companyId, financialPeriodId, entryDate, lines, tx);

    expect(tx.accountBalance.upsert).toHaveBeenCalledTimes(1);
    expect(tx.accountBalance.findFirst).not.toHaveBeenCalled();
    expect(tx.accountBalance.create).not.toHaveBeenCalled();
    expect(tx.accountBalance.updateMany).not.toHaveBeenCalled();
  });

  it('should initialize the balance snapshot in the create branch', async () => {
    await (service as unknown as {
      updateAccountBalances: (
        c: string,
        p: string,
        d: Date,
        l: typeof lines,
        t: typeof tx,
      ) => Promise<void>;
    }).updateAccountBalances(companyId, financialPeriodId, entryDate, lines, tx);

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
    await (service as unknown as {
      updateAccountBalances: (
        c: string,
        p: string,
        d: Date,
        l: typeof creditLine,
        t: typeof tx,
      ) => Promise<void>;
    }).updateAccountBalances(companyId, financialPeriodId, entryDate, creditLine, tx);

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
    await (service as unknown as {
      updateAccountBalances: (
        c: string,
        p: string,
        d: Date,
        l: typeof multiLines,
        t: typeof tx,
      ) => Promise<void>;
    }).updateAccountBalances(companyId, financialPeriodId, entryDate, multiLines, tx);

    expect(tx.accountBalance.upsert).toHaveBeenCalledTimes(2);
  });
});
