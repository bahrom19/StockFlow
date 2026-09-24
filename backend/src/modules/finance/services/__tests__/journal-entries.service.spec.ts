import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JournalEntryStatus } from '@prisma/client';
import { JournalEntriesService } from '../journal-entries.service';
import { JournalEntriesRepository } from '../../repositories/journal-entries.repository';
import { FinancialPeriodsRepository } from '../../repositories/financial-periods.repository';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { GlEngineService } from '../gl-engine.service';

/**
 * G15-06a regression — manual journal posting must update AccountBalance.
 *
 * Previously `JournalEntriesService.post(id)` flipped DRAFT → POSTED without
 * touching AccountBalance snapshots, so the Trial Balance (snapshot-based)
 * silently missed manual journals while ledger detail showed them.
 * The fix reuses the canonical `GlEngineService.updateAccountBalances`
 * inside the same transaction, strictly after the CAS win.
 */
describe('JournalEntriesService.post — AccountBalance update (G15-06a)', () => {
  let service: JournalEntriesService;
  let tx: Record<string, unknown>;
  let repository: { findById: jest.Mock; update: jest.Mock };
  let periodsRepository: { findById: jest.Mock };
  let prismaService: { $transaction: jest.Mock };
  let auditLog: { log: jest.Mock };
  let glEngine: { updateAccountBalances: jest.Mock };

  const currentUser = { userId: 'user-1', companyId: 'comp-1' } as any;

  const line = (over: Record<string, unknown> = {}) => ({
    id: 'jl-1',
    journalEntryId: 'je-1',
    accountId: 'a-cash',
    debit: '100.0000',
    credit: '0.0000',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  const draftEntry = (over: Record<string, unknown> = {}) => ({
    id: 'je-1',
    companyId: 'comp-1',
    financialPeriodId: 'fp-1',
    entryNumber: 5,
    entryDate: new Date('2026-08-15T10:00:00Z'),
    description: 'Manual adjustment',
    status: JournalEntryStatus.DRAFT,
    totalDebit: '100.0000',
    totalCredit: '100.0000',
    referenceType: null,
    referenceId: null,
    postedBy: null,
    postedAt: null,
    createdBy: 'user-1',
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      line(),
      line({
        id: 'jl-2',
        accountId: 'a-rev',
        debit: '0.0000',
        credit: '100.0000',
      }),
    ],
    ...over,
  });

  const openPeriod = { id: 'fp-1', companyId: 'comp-1', status: 'OPEN' };

  const postedEntry = (over: Record<string, unknown> = {}) =>
    draftEntry({ ...over, status: JournalEntryStatus.POSTED });

  beforeEach(() => {
    tx = {};
    repository = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    periodsRepository = { findById: jest.fn() };
    prismaService = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    glEngine = { updateAccountBalances: jest.fn().mockResolvedValue(undefined) };

    service = new JournalEntriesService(
      repository as unknown as JournalEntriesRepository,
      periodsRepository as unknown as FinancialPeriodsRepository,
      prismaService as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      glEngine as unknown as GlEngineService,
    );

    repository.findById.mockResolvedValue(draftEntry());
    periodsRepository.findById.mockResolvedValue(openPeriod);
    repository.update.mockImplementation(async () => postedEntry());
  });

  // TEST 1 — basic manual post updates AccountBalance.
  it('should apply posted lines to AccountBalance on DRAFT → POSTED', async () => {
    const result = await service.post('je-1', currentUser);

    expect(result.status).toBe(JournalEntryStatus.POSTED);
    expect(glEngine.updateAccountBalances).toHaveBeenCalledTimes(1);
    expect(glEngine.updateAccountBalances).toHaveBeenCalledWith(
      'comp-1',
      'fp-1',
      expect.any(Date),
      expect.arrayContaining([
        expect.objectContaining({ accountId: 'a-cash' }),
        expect.objectContaining({ accountId: 'a-rev' }),
      ]),
      tx,
    );
  });

  // TEST 2 — debit/credit correctness.
  it('should pass exact debit/credit amounts per line', async () => {
    await service.post('je-1', currentUser);

    const lines = glEngine.updateAccountBalances.mock.calls[0][3] as Array<{
      accountId: string;
      debit: string;
      credit: string;
    }>;
    expect(lines).toEqual([
      { accountId: 'a-cash', debit: '100.0000', credit: '0.0000' },
      { accountId: 'a-rev', debit: '0.0000', credit: '100.0000' },
    ]);
  });

  // TEST 3 — multi-line / multi-account.
  it('should apply every line for multi-line journals', async () => {
    const multi = draftEntry({
      lines: [
        line({ id: 'jl-1', accountId: 'a1', debit: '50', credit: '0' }),
        line({ id: 'jl-2', accountId: 'a2', debit: '30', credit: '0' }),
        line({ id: 'jl-3', accountId: 'a3', debit: '0', credit: '80' }),
      ],
      totalDebit: '80',
      totalCredit: '80',
    });
    repository.findById.mockResolvedValue(multi);
    repository.update.mockImplementation(async () => ({
      ...multi,
      status: JournalEntryStatus.POSTED,
    }));

    await service.post('je-1', currentUser);

    const lines = glEngine.updateAccountBalances.mock.calls[0][3] as Array<{
      accountId: string;
    }>;
    expect(lines.map((l) => l.accountId)).toEqual(['a1', 'a2', 'a3']);
  });

  // TEST 4 — rejected POST mutates nothing.
  it('should not touch AccountBalance when posting a non-DRAFT entry', async () => {
    repository.findById.mockResolvedValue(postedEntry());

    await expect(service.post('je-1', currentUser)).rejects.toThrow(
      BadRequestException,
    );

    expect(glEngine.updateAccountBalances).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  // TEST 5 — tenant isolation.
  it('should reject a foreign-company journal with no balance mutation', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.post('je-1', currentUser)).rejects.toThrow(
      NotFoundException,
    );

    expect(repository.findById).toHaveBeenCalledWith(
      'je-1',
      'comp-1',
      expect.anything(),
    );
    expect(glEngine.updateAccountBalances).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  // TEST 6 — rollback: balance failure leaves journal DRAFT.
  it('should leave the journal DRAFT with no audit when balances fail', async () => {
    glEngine.updateAccountBalances.mockRejectedValueOnce(
      new Error('balance upsert failed'),
    );

    await expect(service.post('je-1', currentUser)).rejects.toThrow(
      'balance upsert failed',
    );

    // Balances run before audit inside the same transaction: audit never
    // reached, and the shared-tx rollback restores the DRAFT flip.
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  // TEST 7 — concurrent POST: CAS loser mutates nothing.
  it('should not update balances when the CAS loses (already posted)', async () => {
    repository.update.mockRejectedValueOnce(
      new ConflictException('Journal entry was modified by another user'),
    );

    await expect(service.post('je-1', currentUser)).rejects.toThrow(
      ConflictException,
    );

    expect(glEngine.updateAccountBalances).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });
});
