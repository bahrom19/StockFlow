import { ConflictException } from '@nestjs/common';
import { LoyaltyRepository } from '../repositories/loyalty.repository';

/**
 * G12-R2 — repository-level CAS contract tests for LoyaltyRepository.update.
 *
 * Exercises the REAL repository class with a mocked PrismaService and asserts
 * the exact optimistic-locking predicate and version bump reaching Prisma —
 * the same mock-fidelity discipline as crm-tenant-scoping.repository.spec.ts.
 *
 * Note: this proves the CAS *contract* (conditional WHERE + version increment +
 * count===0 → ConflictException). It is not a real-PostgreSQL parallel-
 * transaction race test — the project has no DB concurrency harness (known
 * limitation from the G11-F2 audit); the DB-level behavior of
 * `UPDATE ... WHERE id = ... AND rowVersion = ...` under READ COMMITTED is
 * guaranteed by PostgreSQL row-locking semantics, not re-proven here.
 */
describe('G12-R2 — LoyaltyRepository CAS contract', () => {
  const id = 'loy-1';

  function makePrisma(count: number) {
    return {
      loyaltyAccount: {
        updateMany: jest.fn().mockResolvedValue({ count }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id,
          points: 150,
          lifetimePoints: 200,
          rowVersion: 8,
        }),
      },
    };
  }

  it('CAS success: updateMany WHERE id + rowVersion, increments version, re-reads row', async () => {
    const prisma = makePrisma(1);
    const repo = new LoyaltyRepository(prisma as any);

    const result = await repo.update({
      id,
      data: { points: 150, lifetimePoints: 200 },
      rowVersion: 7,
    });

    // Exact CAS predicate: id + rowVersion as read by the caller.
    expect(prisma.loyaltyAccount.updateMany).toHaveBeenCalledWith({
      where: { id, rowVersion: 7 },
      data: {
        points: 150,
        lifetimePoints: 200,
        rowVersion: { increment: 1 },
      },
    });
    expect(result.rowVersion).toBe(8);
    expect(prisma.loyaltyAccount.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id },
    });
  });

  it('CAS conflict (count === 0) → ConflictException (HTTP 409), no re-read', async () => {
    const prisma = makePrisma(0);
    const repo = new LoyaltyRepository(prisma as any);

    await expect(
      repo.update({ id, data: { points: 150 }, rowVersion: 7 }),
    ).rejects.toThrow(ConflictException);
    await expect(
      repo.update({ id, data: { points: 150 }, rowVersion: 7 }),
    ).rejects.toThrow(/modified by another user/);

    // Nothing else may touch the row after a failed CAS.
    expect(prisma.loyaltyAccount.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('stale rowVersion never matches: predicate binds the read version, not a fresh one', async () => {
    const prisma = makePrisma(1);
    const repo = new LoyaltyRepository(prisma as any);

    await repo.update({ id, data: { points: 1 }, rowVersion: 42 });

    expect(prisma.loyaltyAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id, rowVersion: 42 },
      }),
    );
  });

  it('merges caller data with version increment without dropping lastActivity', async () => {
    const prisma = makePrisma(1);
    const repo = new LoyaltyRepository(prisma as any);
    const lastActivity = new Date('2026-09-18T00:00:00Z');

    await repo.update({
      id,
      data: { points: 40, lastActivity },
      rowVersion: 7,
    });

    expect(prisma.loyaltyAccount.updateMany).toHaveBeenCalledWith({
      where: { id, rowVersion: 7 },
      data: {
        points: 40,
        lastActivity,
        rowVersion: { increment: 1 },
      },
    });
  });
});
