import { UserStatus } from '@prisma/client';
import {
  RECONCILIATION_ACTOR_ENV_VAR,
  ReconciliationActorResolutionError,
  resolveReconciliationActor,
  type ReconciliationActorReader,
} from '../services/reconciliation-actor.resolver';

/**
 * G16-J-R1 — reconciliation audit-actor resolution (P0 remediation).
 *
 * The runner's apply path previously passed the non-UUID literal
 * 'reconciliation-runner' as `AuditLog.userId` (a `uuid` column with an FK to
 * `User.id`), so every apply transaction failed and rolled back. These tests
 * pin the fail-closed contract of the resolver the runner now calls BEFORE any
 * discovery/write transaction:
 *
 *  T1 valid UUID + existing ACTIVE User  → that User.id
 *  T2 missing (or blank) environment var → MISSING (fails before apply)
 *  T3 malformed actor value              → INVALID (fails before apply)
 *  T4 valid UUID, no such User           → NOT_FOUND (fails before apply)
 *  T7 no actor bootstrap                 → resolver only ever READS
 */
describe('resolveReconciliationActor — G16-J-R1', () => {
  const ACTOR = '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607';

  let findFirst: jest.Mock;
  let userWrites: {
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  let prisma: ReconciliationActorReader;

  const envWith = (value: string | undefined): NodeJS.ProcessEnv =>
    value === undefined ? {} : { [RECONCILIATION_ACTOR_ENV_VAR]: value };

  beforeEach(() => {
    findFirst = jest.fn();
    userWrites = {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    };
    prisma = {
      user: { findFirst, ...userWrites },
    } as unknown as ReconciliationActorReader;
  });

  it('T1: valid UUID + existing ACTIVE User → resolves to that User.id', async () => {
    findFirst.mockResolvedValue({
      id: ACTOR,
      isActive: true,
      status: UserStatus.ACTIVE,
    });

    await expect(
      resolveReconciliationActor(prisma, envWith(ACTOR)),
    ).resolves.toBe(ACTOR);

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: ACTOR, deletedAt: null },
      select: { id: true, isActive: true, status: true },
    });
  });

  it('T1b: returns the DB-canonical id (env value is trimmed, never echoed verbatim)', async () => {
    const dbId = '11111111-2222-4333-8444-555555555555';
    findFirst.mockResolvedValue({
      id: dbId,
      isActive: true,
      status: UserStatus.ACTIVE,
    });

    await expect(
      resolveReconciliationActor(prisma, envWith(`  ${ACTOR.toUpperCase()}  `)),
    ).resolves.toBe(dbId);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ACTOR.toUpperCase(), deletedAt: null },
      }),
    );
  });

  it('T2: missing environment variable → MISSING, no User lookup', async () => {
    await expect(
      resolveReconciliationActor(prisma, envWith(undefined)),
    ).rejects.toMatchObject({
      name: 'ReconciliationActorResolutionError',
      code: 'MISSING',
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('T2b: blank / whitespace environment variable → MISSING', async () => {
    for (const blank of ['', '   ', '\t']) {
      await expect(
        resolveReconciliationActor(prisma, envWith(blank)),
      ).rejects.toMatchObject({ code: 'MISSING' });
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('T3: malformed actor value → INVALID, no User lookup', async () => {
    for (const bad of [
      'reconciliation-runner',
      'not-a-uuid',
      '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f60',
      '3f2a1b4c5d6e4f708a91b2c3d4e5f607',
      '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f60z',
      '${STOCKFLOW_RECONCILIATION_ACTOR_USER_ID}',
    ]) {
      await expect(
        resolveReconciliationActor(prisma, envWith(bad)),
      ).rejects.toMatchObject({ code: 'INVALID' });
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('T4: valid UUID but the User does not exist → NOT_FOUND', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      resolveReconciliationActor(prisma, envWith(ACTOR)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('soft-deleted User is excluded by the query (deletedAt: null) → NOT_FOUND', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      resolveReconciliationActor(prisma, envWith(ACTOR)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ACTOR, deletedAt: null } }),
    );
  });

  it('T4b: existing but INACTIVE User → INACTIVE (never used as an actor)', async () => {
    for (const inactive of [
      { isActive: false, status: UserStatus.ACTIVE },
      { isActive: true, status: UserStatus.BLOCKED },
      { isActive: true, status: UserStatus.DELETED },
      { isActive: true, status: UserStatus.INVITED },
    ]) {
      findFirst.mockResolvedValue({ id: ACTOR, ...inactive });
      await expect(
        resolveReconciliationActor(prisma, envWith(ACTOR)),
      ).rejects.toMatchObject({ code: 'INACTIVE' });
    }
  });

  it('T7: never bootstraps or mutates a User — read-only by construction', async () => {
    findFirst.mockResolvedValue({
      id: ACTOR,
      isActive: true,
      status: UserStatus.ACTIVE,
    });

    await resolveReconciliationActor(prisma, envWith(ACTOR));

    for (const write of Object.values(userWrites)) {
      expect(write).not.toHaveBeenCalled();
    }
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('failure surfaces as a typed error carrying the offending code', async () => {
    await expect(
      resolveReconciliationActor(prisma, envWith(undefined)),
    ).rejects.toBeInstanceOf(ReconciliationActorResolutionError);
  });
});
