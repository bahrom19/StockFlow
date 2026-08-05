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
});
