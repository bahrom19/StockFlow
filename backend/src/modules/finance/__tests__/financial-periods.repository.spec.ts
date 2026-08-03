import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, FinancialPeriod } from '@prisma/client';
import { FinancialPeriodsRepository } from '../repositories/financial-periods.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Regression tests for the Blocker B1 pattern in FinancialPeriodsRepository.update:
 * relation writes (e.g. `closedByUser: { connect }` from
 * FinancialPeriodsService) must NOT be passed into `financialPeriod.updateMany`,
 * which only accepts scalar fields (FinancialPeriodUpdateManyMutationInput).
 */
describe('FinancialPeriodsRepository — update with relation writes + optimistic locking (B1 regression)', () => {
  let repo: FinancialPeriodsRepository;
  let mockPrisma: Record<string, any>;

  const basePeriod = {
    id: 'fp-1',
    companyId: 'comp-1',
    name: 'August 2026',
    year: 2026,
    month: 8,
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-31'),
    status: 'OPEN',
    closedAt: null,
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = {
      financialPeriod: {
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
        FinancialPeriodsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<FinancialPeriodsRepository>(FinancialPeriodsRepository);
  });

  it('should NOT pass relation writes (closedByUser connect) to updateMany — B1 fix', async () => {
    mockPrisma.financialPeriod.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(
      basePeriod as FinancialPeriod,
    );

    const data: Prisma.FinancialPeriodUpdateInput = {
      status: 'CLOSED',
      closedAt: new Date(),
      closedByUser: { connect: { id: 'user-1' } },
    };

    const result = await repo.update('fp-1', data, 'comp-1', 0);

    expect(mockPrisma.financialPeriod.updateMany).toHaveBeenCalledWith({
      where: { id: 'fp-1', companyId: 'comp-1', rowVersion: 0 },
      data: { status: 'CLOSED', closedAt: expect.any(Date), rowVersion: { increment: 1 } },
    });
    // closedByUser connect goes through a follow-up update
    expect(mockPrisma.financialPeriod.update).toHaveBeenCalledWith({
      where: { id: 'fp-1' },
      data: { closedByUser: { connect: { id: 'user-1' } } },
    });
    expect(result.id).toBe('fp-1');
  });

  it('should apply scalar-only updates via updateMany without a follow-up update', async () => {
    mockPrisma.financialPeriod.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(
      basePeriod as FinancialPeriod,
    );

    await repo.update('fp-1', { name: 'X' }, 'comp-1', 0);

    expect(mockPrisma.financialPeriod.updateMany).toHaveBeenCalledWith({
      where: { id: 'fp-1', companyId: 'comp-1', rowVersion: 0 },
      data: { name: 'X', rowVersion: { increment: 1 } },
    });
    expect(mockPrisma.financialPeriod.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when rowVersion is stale', async () => {
    mockPrisma.financialPeriod.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.financialPeriod.findFirst.mockResolvedValue({
      ...basePeriod,
      rowVersion: 5,
    });

    await expect(
      repo.update('fp-1', { status: 'CLOSED' }, 'comp-1', 0),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when period does not exist', async () => {
    mockPrisma.financialPeriod.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.financialPeriod.findFirst.mockResolvedValue(null);

    await expect(
      repo.update('fp-1', { status: 'CLOSED' }, 'comp-1', 0),
    ).rejects.toThrow(NotFoundException);
  });
});
