import { PermissionsSeedService } from '../services/permissions-seed.service';

/**
 * G15-07-C0-b — canonical permission provisioning.
 *
 * `POST /finance/gl/fiscal-year/:year/close` requires `finance:close`, but that
 * code was missing from the canonical SEED_PERMISSIONS list. As a result no
 * Permission row was ever created, no Admin role could be granted it, and the
 * fail-closed RolesGuard denied every caller (Admin included).
 *
 * These tests cover the seed contract (T1/T2/T9-min) and the Admin backfill
 * (T3–T6) at the service level. `SEED_PERMISSIONS` is module-private, so the
 * canonical list is observed through the PermissionsRepository.upsertByCode
 * calls issued by `seed()`.
 */
describe('PermissionsSeedService — canonical seed & Admin provisioning (G15-07-C0-b)', () => {
  let service: PermissionsSeedService;
  let upsertByCode: jest.Mock;
  let permissionFindMany: jest.Mock;
  let roleFindMany: jest.Mock;
  let rolePermissionFindMany: jest.Mock;
  let rolePermissionCreateMany: jest.Mock;

  beforeEach(() => {
    upsertByCode = jest.fn().mockResolvedValue({});
    permissionFindMany = jest.fn().mockResolvedValue([]);
    roleFindMany = jest.fn().mockResolvedValue([]);
    rolePermissionFindMany = jest.fn().mockResolvedValue([]);
    rolePermissionCreateMany = jest.fn().mockResolvedValue({ count: 0 });

    service = new PermissionsSeedService(
      { upsertByCode } as any,
      {
        permission: { findMany: permissionFindMany },
        role: { findMany: roleFindMany },
        rolePermission: {
          findMany: rolePermissionFindMany,
          createMany: rolePermissionCreateMany,
        },
      } as any,
    );
  });

  /** Codes the canonical seed upserted, in order, for a single seed() run. */
  const seededCodes = (): string[] =>
    upsertByCode.mock.calls.map((call) => call[0] as string);

  /** The { code, name, description, module } payload upserted for a code. */
  const seededEntry = (code: string): any =>
    upsertByCode.mock.calls.find((call) => call[0] === code)?.[1];

  // ── T1 / T9-min: finance:close exists in the canonical seed ──────────────
  it('T1: seeds the canonical finance:close permission with the expected shape', async () => {
    await service.seed();

    expect(seededEntry('finance:close')).toEqual({
      code: 'finance:close',
      name: 'Close Fiscal Year',
      description:
        'Allows closing fiscal years with retained earnings transfer',
      module: 'finance',
    });
  });

  // ── T2: canonical list integrity / idempotency ──────────────────────────
  it('T2: canonical seed has no duplicate codes and keeps the existing permissions', async () => {
    await service.seed();

    const codes = seededCodes();

    // No duplicate code in the canonical list.
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('finance:close');

    // 53 pre-existing permissions + finance:close.
    expect(codes).toHaveLength(54);

    // Pre-existing entries are untouched (spot-check the finance block).
    expect(seededEntry('finance:period-close')).toEqual({
      code: 'finance:period-close',
      name: 'Close Financial Period',
      description: 'Allows closing financial periods',
      module: 'finance',
    });
    expect(seededEntry('finance:post')).toEqual({
      code: 'finance:post',
      name: 'Post Journal Entries',
      description: 'Allows posting journal entries to the general ledger',
      module: 'finance',
    });

    // Re-running the seed upserts the exact same canonical set (idempotent at
    // the service level; upsertByCode is keyed by the unique Permission.code).
    upsertByCode.mockClear();
    await service.seed();
    expect(seededCodes()).toEqual(codes);
  });

  // ── T3: Admin provisioning ──────────────────────────────────────────────
  it('T3: assigns finance:close to Admin roles during backfill', async () => {
    permissionFindMany.mockResolvedValue([{ id: 'p-close' }]);
    roleFindMany.mockResolvedValue([{ id: 'admin-1' }]);
    rolePermissionFindMany.mockResolvedValue([]);

    await service.seed();

    expect(rolePermissionCreateMany).toHaveBeenCalledWith({
      data: [{ roleId: 'admin-1', permissionId: 'p-close' }],
      skipDuplicates: true,
    });
  });

  // ── T4: existing Admin role backfill ────────────────────────────────────
  it('T4: backfills only the missing finance:close link on an existing Admin role', async () => {
    permissionFindMany.mockResolvedValue([
      { id: 'p-close' },
      { id: 'p-other' },
    ]);
    roleFindMany.mockResolvedValue([{ id: 'admin-1' }]);
    rolePermissionFindMany.mockResolvedValue([
      { roleId: 'admin-1', permissionId: 'p-other' },
    ]);

    await service.seed();

    expect(rolePermissionCreateMany).toHaveBeenCalledWith({
      data: [{ roleId: 'admin-1', permissionId: 'p-close' }],
      skipDuplicates: true,
    });
  });

  // ── T5: duplicate protection ────────────────────────────────────────────
  it('T5: does not create a duplicate RolePermission when the link already exists', async () => {
    permissionFindMany.mockResolvedValue([{ id: 'p-close' }]);
    roleFindMany.mockResolvedValue([{ id: 'admin-1' }]);
    rolePermissionFindMany.mockResolvedValue([
      { roleId: 'admin-1', permissionId: 'p-close' },
    ]);

    await service.seed();

    expect(rolePermissionCreateMany).not.toHaveBeenCalled();
  });

  // ── T6: Admin-only, non-Admin roles untouched ───────────────────────────
  it('T6: only Admin roles (not deleted) are provisioned', async () => {
    permissionFindMany.mockResolvedValue([{ id: 'p-close' }]);
    roleFindMany.mockResolvedValue([{ id: 'admin-1' }]);

    await service.seed();

    // The Admin lookup is scoped by name + soft-delete.
    expect(roleFindMany).toHaveBeenCalledWith({
      where: { name: 'Admin', deletedAt: null },
      select: { id: true },
    });
    // Only the Admin role id appears in the assignment payload.
    const created = rolePermissionCreateMany.mock.calls[0][0].data as Array<{
      roleId: string;
    }>;
    expect(created.every((row) => row.roleId === 'admin-1')).toBe(true);
  });

  // ── Guard: nothing happens when there are no permissions / Admin roles ───
  it('is a no-op for Admin provisioning when no permissions exist yet', async () => {
    permissionFindMany.mockResolvedValue([]);

    await service.seed();

    expect(roleFindMany).not.toHaveBeenCalled();
    expect(rolePermissionCreateMany).not.toHaveBeenCalled();
  });
});
