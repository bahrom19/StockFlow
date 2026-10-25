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

/**
 * F3 P-C cutoff: findExpiredTrials must select
 *   (a) TRIAL rows with trialEndsAt <= now (existing semantics), and
 *   (b) legacy TRIAL rows with trialEndsAt = NULL only once now >= createdAt
 *       + 30×24h — grace interval is the half-open range
 *       [createdAt, createdAt + 30d), so equality at the boundary is expired.
 *
 * Prisma is mocked, so the real behavior under test is the `where` the
 * repository emits. `evalWhere` below interprets that where against row
 * fixtures with SQL three-valued semantics (NULL comparisons are false),
 * which lets the boundary tests assert actual selection rather than just
 * object shape.
 */
describe('CompanySubscriptionRepository — findExpiredTrials F3 30-day cutoff', () => {
  let repo: CompanySubscriptionRepository;
  let mockPrisma: Record<string, any>;

  const NOW = new Date('2026-10-25T12:00:00.000Z');
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CUTOFF_MS = 30 * DAY_MS;

  beforeEach(async () => {
    mockPrisma = {
      companySubscription: { findMany: jest.fn().mockResolvedValue([]) },
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

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Run findExpiredTrials on a frozen clock and return the emitted where. */
  async function captureWhere(): Promise<any> {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    try {
      await repo.findExpiredTrials();
    } finally {
      jest.useRealTimers();
    }
    return mockPrisma.companySubscription.findMany.mock.calls[0][0].where;
  }

  /** Evaluate a Prisma-style where against a row (SQL NULL semantics). */
  function evalWhere(where: any, row: any): boolean {
    return Object.entries(where).every(([key, cond]: [string, any]) => {
      if (key === 'OR') return cond.some((c: any) => evalWhere(c, row));
      if (key === 'AND') return cond.every((c: any) => evalWhere(c, row));
      const value = row[key];
      if (cond === null) return value === null || value === undefined;
      if (typeof cond === 'object' && !(cond instanceof Date)) {
        // A NULL operand never satisfies a comparison in SQL.
        if (value === null || value === undefined) return false;
        return Object.entries(cond).every(([op, operand]: [string, any]) => {
          if (op === 'lte') return value <= operand;
          if (op === 'lt') return value < operand;
          if (op === 'gte') return value >= operand;
          if (op === 'gt') return value > operand;
          if (op === 'equals') return value === operand;
          throw new Error(`evalWhere: unsupported operator ${op}`);
        });
      }
      return value === cond;
    });
  }

  const trialRow = (overrides: Record<string, any> = {}) => ({
    id: 'sub-x',
    companyId: 'comp-x',
    status: 'TRIAL',
    deletedAt: null,
    trialEndsAt: null,
    createdAt: NOW,
    plan: { id: 'plan-1', code: 'trial' },
    ...overrides,
  });

  it('emits the F3 where shape: status/deletedAt plus the null-branch guarded by a createdAt cutoff', async () => {
    const where = await captureWhere();

    expect(where.status).toBe('TRIAL');
    expect(where.deletedAt).toBeNull();
    expect(where.OR).toHaveLength(2);
    // Branch 1: existing expiry semantics — trialEndsAt <= now.
    expect(where.OR[0]).toEqual({ trialEndsAt: { lte: NOW } });
    // Branch 2: NULL trialEndsAt AND createdAt <= now - 30d (the AND is what
    // makes the grace window finite; a bare { trialEndsAt: null } would match
    // every legacy row regardless of age).
    expect(where.OR[1]).toEqual({
      AND: [
        { trialEndsAt: null },
        { createdAt: { lte: new Date(NOW.getTime() - CUTOFF_MS) } },
      ],
    });
    expect((where.OR[1] as any).AND[1].createdAt.lte.getTime()).toBe(
      NOW.getTime() - CUTOFF_MS,
    );
  });

  it('NULL trialEndsAt INSIDE the grace window is NOT selected as expired', async () => {
    const where = await captureWhere();
    const insideGrace = [
      trialRow({ createdAt: NOW }), // just created
      trialRow({ createdAt: new Date(NOW.getTime() - 29 * DAY_MS) }),
      trialRow({ createdAt: new Date(NOW.getTime() - CUTOFF_MS + 1) }), // 1ms before cutoff
    ];
    for (const row of insideGrace) {
      expect(evalWhere(where, row)).toBe(false);
    }
  });

  it('NULL trialEndsAt AFTER the 30-day cutoff IS selected as expired', async () => {
    const where = await captureWhere();
    const pastCutoff = [
      trialRow({ createdAt: new Date(NOW.getTime() - CUTOFF_MS - 1) }),
      trialRow({ createdAt: new Date(NOW.getTime() - 31 * DAY_MS) }),
      trialRow({ createdAt: new Date(NOW.getTime() - 365 * DAY_MS) }),
    ];
    for (const row of pastCutoff) {
      expect(evalWhere(where, row)).toBe(true);
    }
  });

  it('exact 30-day boundary (now == createdAt + 30d) counts as EXPIRED', async () => {
    const where = await captureWhere();
    const boundary = trialRow({
      createdAt: new Date(NOW.getTime() - CUTOFF_MS),
    });
    expect(evalWhere(where, boundary)).toBe(true);
  });

  it('rows with a real trialEndsAt keep the existing expiry semantics (unchanged)', async () => {
    const where = await captureWhere();
    // Expired: trialEndsAt <= now (including exact equality) → selected.
    expect(
      evalWhere(where, trialRow({ trialEndsAt: NOW, createdAt: null })),
    ).toBe(true);
    expect(
      evalWhere(
        where,
        trialRow({
          trialEndsAt: new Date(NOW.getTime() - 1),
          createdAt: null,
        }),
      ),
    ).toBe(true);
    // Not yet expired → not selected, even though createdAt is ancient
    // (the createdAt fallback applies ONLY when trialEndsAt is NULL).
    expect(
      evalWhere(
        where,
        trialRow({
          trialEndsAt: new Date(NOW.getTime() + 1),
          createdAt: new Date(NOW.getTime() - 365 * DAY_MS),
        }),
      ),
    ).toBe(false);
  });

  it('non-TRIAL and soft-deleted rows are never selected', async () => {
    const where = await captureWhere();
    expect(
      evalWhere(
        where,
        trialRow({
          status: 'ACTIVE',
          createdAt: new Date(NOW.getTime() - 365 * DAY_MS),
        }),
      ),
    ).toBe(false);
    expect(
      evalWhere(
        where,
        trialRow({
          deletedAt: NOW,
          trialEndsAt: new Date(NOW.getTime() - DAY_MS),
        }),
      ),
    ).toBe(false);
  });
});
