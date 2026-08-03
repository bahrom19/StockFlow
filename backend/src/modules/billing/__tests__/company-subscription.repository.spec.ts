import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Regression tests for the Blocker B1 pattern in
 * CompanySubscriptionRepository.updateByCompany: relation writes (e.g.
 * `plan: { connect }` from CompanySubscriptionService.changePlan) must NOT be
 * passed into `companySubscription.updateMany`, which only accepts scalar
 * fields (CompanySubscriptionUpdateManyMutationInput).
 */
describe('CompanySubscriptionRepository — updateByCompany with relation writes + optimistic locking (B1 regression)', () => {
  let repo: CompanySubscriptionRepository;
  let mockPrisma: Record<string, any>;

  const baseSub = {
    id: 'sub-1',
    companyId: 'comp-1',
    planId: 'plan-1',
    status: 'TRIAL',
    isActive: true,
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    plan: { id: 'plan-1', code: 'FREE' },
  };

  beforeEach(async () => {
    mockPrisma = {
      companySubscription: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanySubscriptionRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<CompanySubscriptionRepository>(
      CompanySubscriptionRepository,
    );
  });

  it('should NOT pass relation writes (plan connect) to updateMany — B1 fix', async () => {
    mockPrisma.companySubscription.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.companySubscription.findUnique.mockResolvedValue(baseSub as any);

    const data: Prisma.CompanySubscriptionUpdateInput = {
      status: 'ACTIVE',
      plan: { connect: { id: 'plan-2' } },
    };

    const result = await repo.updateByCompany('comp-1', data, 0);

    expect(mockPrisma.companySubscription.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'comp-1', rowVersion: 0 },
      data: { status: 'ACTIVE', rowVersion: { increment: 1 } },
    });
    // plan connect goes through a follow-up update
    expect(mockPrisma.companySubscription.update).toHaveBeenCalledWith({
      where: { companyId: 'comp-1' },
      data: { plan: { connect: { id: 'plan-2' } } },
    });
    expect(result.companyId).toBe('comp-1');
  });

  it('should apply scalar-only updates via updateMany without a follow-up update', async () => {
    mockPrisma.companySubscription.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.companySubscription.findUnique.mockResolvedValue(baseSub as any);

    await repo.updateByCompany('comp-1', { status: 'ACTIVE' }, 0);

    expect(mockPrisma.companySubscription.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'comp-1', rowVersion: 0 },
      data: { status: 'ACTIVE', rowVersion: { increment: 1 } },
    });
    expect(mockPrisma.companySubscription.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when rowVersion is stale', async () => {
    mockPrisma.companySubscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.companySubscription.findUnique.mockResolvedValue({
      ...baseSub,
      rowVersion: 5,
    });

    await expect(
      repo.updateByCompany('comp-1', { status: 'ACTIVE' }, 0),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when subscription does not exist', async () => {
    mockPrisma.companySubscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.companySubscription.findUnique.mockResolvedValue(null);

    await expect(
      repo.updateByCompany('comp-1', { status: 'ACTIVE' }, 0),
    ).rejects.toThrow(NotFoundException);
  });

  it('should support legacy path (no rowVersion) with relation writes', async () => {
    mockPrisma.companySubscription.findUnique.mockResolvedValue(baseSub as any);
    mockPrisma.companySubscription.update.mockResolvedValue({
      ...baseSub,
      status: 'ACTIVE',
    } as any);

    const result = await repo.updateByCompany(
      'comp-1',
      { status: 'ACTIVE', plan: { connect: { id: 'plan-2' } } },
      undefined,
    );

    expect(mockPrisma.companySubscription.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.companySubscription.update).toHaveBeenCalled();
    expect(result.companyId).toBe('comp-1');
  });
});
