import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ChartOfAccount } from '@prisma/client';
import { ChartOfAccountsRepository } from '../repositories/chart-of-accounts.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Regression tests for the Blocker B1 pattern in ChartOfAccountsRepository.update:
 * relation writes (e.g. `parent: { connect }` / `{ disconnect: true }` from
 * ChartOfAccountsService) must NOT be passed into `chartOfAccount.updateMany`,
 * which only accepts scalar fields (ChartOfAccountUpdateManyMutationInput).
 */
describe('ChartOfAccountsRepository — update with relation writes + optimistic locking (B1 regression)', () => {
  let repo: ChartOfAccountsRepository;
  let mockPrisma: Record<string, any>;

  const baseAccount = {
    id: 'acc-1',
    companyId: 'comp-1',
    code: '1010',
    name: 'Cash',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    isActive: true,
    isSystem: false,
    isCashOrBank: false,
    parentId: null,
    level: 0,
    sortOrder: 0,
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    mockPrisma = {
      chartOfAccount: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChartOfAccountsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<ChartOfAccountsRepository>(ChartOfAccountsRepository);
  });

  it('should NOT pass relation writes (parent connect) to updateMany — B1 fix', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(
      baseAccount as ChartOfAccount,
    );

    const data: Prisma.ChartOfAccountUpdateInput = {
      name: 'Cash Desk',
      parent: { connect: { id: 'parent-1' } },
    };

    const result = await repo.update('acc-1', data, 'comp-1', 0);

    expect(mockPrisma.chartOfAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'acc-1',
        companyId: 'comp-1',
        rowVersion: 0,
        deletedAt: null,
      },
      data: { name: 'Cash Desk', rowVersion: { increment: 1 } },
    });
    // parent connect goes through a follow-up update
    expect(mockPrisma.chartOfAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { parent: { connect: { id: 'parent-1' } } },
    });
    expect(result.id).toBe('acc-1');
  });

  it('should NOT pass relation writes (parent disconnect) to updateMany — B1 fix', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(
      baseAccount as ChartOfAccount,
    );

    await repo.update('acc-1', { parent: { disconnect: true } }, 'comp-1', 0);

    expect(mockPrisma.chartOfAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'acc-1',
        companyId: 'comp-1',
        rowVersion: 0,
        deletedAt: null,
      },
      data: { rowVersion: { increment: 1 } },
    });
    expect(mockPrisma.chartOfAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { parent: { disconnect: true } },
    });
  });

  it('should apply scalar-only updates via updateMany without a follow-up update', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(
      baseAccount as ChartOfAccount,
    );

    await repo.update('acc-1', { name: 'X' }, 'comp-1', 0);

    expect(mockPrisma.chartOfAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'acc-1',
        companyId: 'comp-1',
        rowVersion: 0,
        deletedAt: null,
      },
      data: { name: 'X', rowVersion: { increment: 1 } },
    });
    expect(mockPrisma.chartOfAccount.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when rowVersion is stale', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue({
      ...baseAccount,
      rowVersion: 5,
    });

    await expect(
      repo.update('acc-1', { name: 'X' }, 'comp-1', 0),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when account does not exist', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

    await expect(
      repo.update('acc-1', { name: 'X' }, 'comp-1', 0),
    ).rejects.toThrow(NotFoundException);
  });

  // G16-B-02 PH1 (B02-06) — the relation follow-up write must be
  // company-scoped: re-assert ownership in the same transaction before the
  // Prisma update (which requires a unique where), and scope the re-read.
  it('should re-assert company ownership before the relation follow-up write', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(
      baseAccount as ChartOfAccount,
    );

    await repo.update(
      'acc-1',
      { parent: { connect: { id: 'parent-1' } } },
      'comp-1',
      0,
    );

    expect(mockPrisma.chartOfAccount.findFirst).toHaveBeenCalledWith({
      where: { id: 'acc-1', companyId: 'comp-1' },
      select: { id: true },
    });
    expect(mockPrisma.chartOfAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { parent: { connect: { id: 'parent-1' } } },
    });
  });

  it('should abort the relation write when ownership re-assertion fails', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 1 });
    // CAS won, but the row is no longer visible under this company.
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

    await expect(
      repo.update(
        'acc-1',
        { parent: { connect: { id: 'parent-1' } } },
        'comp-1',
        0,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrisma.chartOfAccount.update).not.toHaveBeenCalled();
  });

  it('should scope the post-update re-read to the company', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(
      baseAccount as ChartOfAccount,
    );

    await repo.update('acc-1', { name: 'X' }, 'comp-1', 0);

    const reRead = mockPrisma.chartOfAccount.findFirst.mock.calls.find(
      (call: any[]) =>
        call[0]?.where?.id === 'acc-1' &&
        !('rowVersion' in (call[0]?.where ?? {})) &&
        call[0]?.select === undefined,
    );
    expect(reRead[0]).toEqual({ where: { id: 'acc-1', companyId: 'comp-1' } });
  });
});

/**
 * G16-FU-2 — `extraWhere` must never be able to weaken the authoritative
 * predicates of the optimistic-locked write.
 *
 * `extraWhere` exists so a business guard (today: `journalLines: { none: {} }`)
 * can participate in the SAME `updateMany` that performs the CAS, instead of a
 * separate SELECT-then-UPDATE that would leave a TOCTOU window.
 *
 * It is typed `Prisma.ChartOfAccountWhereInput`, which exposes `id`,
 * `companyId`, `rowVersion` and `deletedAt`. Spreading it *after* those keys
 * would let any caller silently replace the tenant scope, the CAS value, or the
 * not-deleted predicate — so it is spread FIRST and the authoritative keys are
 * applied LAST. These tests pin that ordering as a repository contract.
 */
describe('ChartOfAccountsRepository — extraWhere cannot override the authoritative predicate (G16-FU-2)', () => {
  let repo: ChartOfAccountsRepository;
  let mockPrisma: Record<string, any>;

  const account = {
    id: 'acc-1',
    companyId: 'comp-1',
    code: '1010',
    name: 'Cash',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    isActive: true,
    isSystem: false,
    isCashOrBank: false,
    parentId: null,
    level: 0,
    sortOrder: 0,
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    mockPrisma = {
      chartOfAccount: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChartOfAccountsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get<ChartOfAccountsRepository>(ChartOfAccountsRepository);
  });

  /** The `where` actually handed to Prisma by the last updateMany call. */
  const lastWhere = (): Record<string, unknown> =>
    mockPrisma.chartOfAccount.updateMany.mock.calls[0][0].where;

  const data: Prisma.ChartOfAccountUpdateInput = { name: 'Renamed' };

  beforeEach(() => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(
      account as ChartOfAccount,
    );
  });

  it('1. extraWhere.companyId cannot override the authoritative companyId', async () => {
    await repo.update('acc-1', data, 'comp-1', 0, undefined, {
      companyId: 'other-tenant',
    } as Prisma.ChartOfAccountWhereInput);

    expect(lastWhere().companyId).toBe('comp-1');
    expect(lastWhere().companyId).not.toBe('other-tenant');
  });

  it('2. extraWhere.rowVersion cannot override the authoritative rowVersion', async () => {
    await repo.update('acc-1', data, 'comp-1', 7, undefined, {
      rowVersion: 999,
    } as Prisma.ChartOfAccountWhereInput);

    expect(lastWhere().rowVersion).toBe(7);
    expect(lastWhere().rowVersion).not.toBe(999);
  });

  it('3. extraWhere.id cannot override the authoritative id', async () => {
    await repo.update('acc-1', data, 'comp-1', 0, undefined, {
      id: 'acc-someone-else',
    } as Prisma.ChartOfAccountWhereInput);

    expect(lastWhere().id).toBe('acc-1');
    expect(lastWhere().id).not.toBe('acc-someone-else');
  });

  it('4. extraWhere.deletedAt cannot override deletedAt: null', async () => {
    await repo.update('acc-1', data, 'comp-1', 0, undefined, {
      deletedAt: new Date('2020-01-01'),
    } as Prisma.ChartOfAccountWhereInput);

    expect(lastWhere().deletedAt).toBeNull();
  });

  it('5. journalLines: { none: {} } still reaches the updateMany predicate', async () => {
    await repo.update('acc-1', data, 'comp-1', 0, undefined, {
      journalLines: { none: {} },
    });

    const where = lastWhere();
    expect(where.journalLines).toEqual({ none: {} });
    // …and it did not disturb the authoritative keys
    expect(where.id).toBe('acc-1');
    expect(where.companyId).toBe('comp-1');
    expect(where.rowVersion).toBe(0);
    expect(where.deletedAt).toBeNull();
  });

  it('5b. a non-empty extraWhere is merged alongside, not replacing, the keys', async () => {
    await repo.update('acc-1', data, 'comp-1', 3, undefined, {
      journalLines: { none: {} },
      isActive: true,
    });

    expect(lastWhere()).toEqual({
      journalLines: { none: {} },
      isActive: true,
      id: 'acc-1',
      companyId: 'comp-1',
      rowVersion: 3,
      deletedAt: null,
    });
  });

  it('6. omitting extraWhere preserves the previous predicate exactly', async () => {
    await repo.update('acc-1', data, 'comp-1', 0);

    expect(mockPrisma.chartOfAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'acc-1',
        companyId: 'comp-1',
        rowVersion: 0,
        deletedAt: null,
      },
      data: { name: 'Renamed', rowVersion: { increment: 1 } },
    });
  });

  it('7. CAS conflict behaviour is unchanged by extraWhere', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(
      account as ChartOfAccount,
    );

    await expect(
      repo.update('acc-1', data, 'comp-1', 0, undefined, {
        journalLines: { none: {} },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('7b. a vanished row still raises NotFound, not Conflict', async () => {
    mockPrisma.chartOfAccount.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

    await expect(
      repo.update('acc-1', data, 'comp-1', 0, undefined, {
        journalLines: { none: {} },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('8. a single spread cannot defeat the ordering — all four keys hold at once', async () => {
    await repo.update('acc-1', data, 'comp-1', 5, undefined, {
      id: 'x',
      companyId: 'y',
      rowVersion: 0,
      deletedAt: new Date(),
      journalLines: { none: {} },
    } as Prisma.ChartOfAccountWhereInput);

    expect(lastWhere()).toEqual({
      journalLines: { none: {} },
      id: 'acc-1',
      companyId: 'comp-1',
      rowVersion: 5,
      deletedAt: null,
    });
  });
});
