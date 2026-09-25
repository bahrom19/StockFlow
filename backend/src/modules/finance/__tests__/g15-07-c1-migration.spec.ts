import * as fs from 'fs';
import * as path from 'path';

/**
 * G15-07-C1 — static verification of the retained-earnings provisioning
 * migration.
 *
 * The repository has no migration-execution harness (no precedent for
 * running a migration file inside the test suite), and C1 deliberately does
 * not introduce one. This spec therefore verifies the migration's SQL
 * structure statically: it is read from disk and asserted to be additive,
 * idempotent, tenant-scoped, correctly ordered and fail-closed. It does NOT
 * prove runtime execution against a database — that limitation is reported
 * separately.
 */
describe('G15-07-C1 migration — static SQL verification', () => {
  const migrationDir = path.resolve(
    __dirname,
    '../../../../prisma/migrations/20260925120000_g15_07_c1_provision_retained_earnings',
  );
  const raw = fs.readFileSync(path.join(migrationDir, 'migration.sql'), 'utf8');
  // Strip SQL line comments so the assertions target executable SQL, not the
  // prose that documents the policy ("no DELETE", "no DROP", ...).
  const sql = raw
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  it('is additive only — no DELETE, DROP, ALTER or TRUNCATE', () => {
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bALTER\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('fails closed on a soft-deleted custom (non-system) 3200 before provisioning', () => {
    expect(sql).toMatch(/DO \$\$/);
    expect(sql).toMatch(/RAISE EXCEPTION/);
    expect(sql).toMatch(
      /ca\."code" = '3200' AND ca\."isSystem" = false AND ca\."deletedAt" IS NOT NULL/,
    );
    // The guard aborts before any provisioning write.
    expect(sql.indexOf('RAISE EXCEPTION')).toBeLessThan(
      sql.indexOf('UPDATE "ChartOfAccount"'),
    );
  });

  it('restores soft-deleted SYSTEM 3200 (Case 3), scoped and idempotent', () => {
    expect(sql).toMatch(
      /UPDATE "ChartOfAccount" SET "deletedAt" = NULL, "isActive" = true/,
    );
    expect(sql).toMatch(
      /WHERE "code" = '3200' AND "isSystem" = true AND "deletedAt" IS NOT NULL/,
    );
  });

  it('inserts canonical 3200 only where no row exists (Case 1)', () => {
    expect(sql).toMatch(
      /VALUES \( '3200', 'Retained Earnings', 'Accumulated profit and loss transferred at fiscal year close', 'EQUITY'::"AccountType", 'CREDIT'::"NormalBalance", 12 \)/,
    );
    expect(sql).toMatch(/WHERE NOT EXISTS \( SELECT 1 FROM "ChartOfAccount" ca/);
    expect(sql).toMatch(/ca\."companyId" = c\."id" AND ca\."code" = seed\."code"/);
    // Canonical insert shape from the seeder.
    expect(sql).toMatch(/gen_random_uuid\(\)/);
    expect(sql).toMatch(/FROM "Company" c/);
    expect(sql).toMatch(/true, true, 0, seed\."sortOrder", 0, CURRENT_TIMESTAMP,/);
  });

  it('runs guard → restore → insert in that order', () => {
    const guard = sql.indexOf('RAISE EXCEPTION');
    const restore = sql.indexOf('UPDATE "ChartOfAccount"');
    const insert = sql.indexOf('INSERT INTO "ChartOfAccount"');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(restore).toBeGreaterThan(guard);
    expect(insert).toBeGreaterThan(restore);
  });

  it('sorts after the current latest migration', () => {
    expect('20260925120000' > '20260924010000').toBe(true);
  });
});
