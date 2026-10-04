import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * G16-N-4 P0-A — migration safety invariants.
 *
 * Two migrations ship with this workstream and neither can be exercised
 * without a database, so their safety properties are pinned statically
 * against the LIVE schema. The properties asserted here are exactly the ones
 * that make the migrations safe to run against an existing production
 * database:
 *
 *   1. `20261004090100_platform_bootstrap_free_plan` must create the plan
 *      `downgradeToFree` requires, must be idempotent, and must never delete
 *      anything.
 *   2. `20261004090000_audit_log_company_id_nullable` must be metadata-only:
 *      relaxing NOT NULL cannot invalidate an existing tenant audit row.
 *
 * The assertions are deliberately cross-checked against `schema.prisma`, so a
 * future schema change that invalidates the migration assumptions fails here
 * rather than in production.
 */
const BACKEND_ROOT = join(__dirname, '..', '..', '..', '..');
const MIGRATIONS_DIR = join(BACKEND_ROOT, 'prisma', 'migrations');
const SCHEMA = readFileSync(
  join(BACKEND_ROOT, 'prisma', 'schema.prisma'),
  'utf8',
);

const BOOTSTRAP_MIGRATION = '20261004090100_platform_bootstrap_free_plan';
const NULLABLE_MIGRATION = '20261004090000_audit_log_company_id_nullable';

const bootstrapSql = existsSync(join(MIGRATIONS_DIR, BOOTSTRAP_MIGRATION))
  ? readFileSync(
      join(MIGRATIONS_DIR, BOOTSTRAP_MIGRATION, 'migration.sql'),
      'utf8',
    )
  : '';

const nullableSql = existsSync(join(MIGRATIONS_DIR, NULLABLE_MIGRATION))
  ? readFileSync(
      join(MIGRATIONS_DIR, NULLABLE_MIGRATION, 'migration.sql'),
      'utf8',
    )
  : '';

/** Drop `--` line comments so prose about DELETE/DROP cannot fail an assertion. */
const stripComments = (sql: string): string =>
  sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

const bootstrapStatements = stripComments(bootstrapSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const nullableStatements = stripComments(nullableSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

describe('platform bootstrap free-plan migration (G16-N-4 P0-A)', () => {
  it('T28a: the migration exists and targets the plan catalog', () => {
    expect(bootstrapSql).not.toBe('');
    expect(bootstrapSql).toContain('"SubscriptionPlan"');
  });

  it('T28b: SubscriptionPlan.code is still unique in the live schema', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model SubscriptionPlan {'));
    const body = model.slice(0, model.indexOf('\n}'));
    expect(body).toMatch(/code\s+String\s+@unique/);
  });

  it('T28c: it inserts the plan with code = free', () => {
    expect(bootstrapSql).toContain("'free'");
  });

  it('T28d: exactly one INSERT ... SELECT-free VALUES row is inserted', () => {
    const inserts = bootstrapSql.match(/INSERT INTO/gi) ?? [];
    expect(inserts).toHaveLength(1);
    expect(bootstrapSql).toContain('VALUES');
  });

  it('T29: the insert is idempotent via ON CONFLICT on the code index', () => {
    expect(bootstrapSql).toMatch(/ON CONFLICT\s*\("code"\)\s*DO NOTHING/i);
  });

  it('T29b: no business pricing is invented — schema defaults are used verbatim', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model SubscriptionPlan {'));
    const body = model.slice(0, model.indexOf('\n}'));

    // The values written by the migration must equal the model defaults.
    expect(body).toMatch(/priceMonthly\s+Decimal\s+@default\(0\)/);
    expect(body).toMatch(/priceYearly\s+Decimal\s+@default\(0\)/);
    expect(body).toMatch(/currency\s+Currency\s+@default\(USD\)/);
    expect(body).toMatch(/trialDays\s+Int\s+@default\(0\)/);
    expect(body).toMatch(/maxUsers\s+Int\s+@default\(1\)/);
    expect(body).toMatch(/maxWarehouses\s+Int\s+@default\(1\)/);
    expect(body).toMatch(/maxProducts\s+Int\s+@default\(50\)/);

    // And the migration must not write anything else into those columns.
    expect(bootstrapSql).toMatch(/0,\s*\n\s*0,\s*\n\s*'USD'::"Currency"/);
    expect(bootstrapSql).toMatch(/0,\s*\n\s*1,\s*\n\s*1,\s*\n\s*50,/);
  });

  it('T29c: it never deletes or drops anything', () => {
    const executable = stripComments(bootstrapSql);
    expect(executable).not.toMatch(/\bDELETE\b/i);
    expect(executable).not.toMatch(/\bTRUNCATE\b/i);
    expect(executable).not.toMatch(/\bDROP\b/i);
    expect(executable).not.toMatch(/\bALTER\b/i);
  });

  it('T29f: it issues exactly two statements: restore, then insert', () => {
    expect(bootstrapStatements).toHaveLength(2);
    expect(bootstrapStatements[0]).toMatch(/^UPDATE\s+"SubscriptionPlan"/i);
    expect(bootstrapStatements[1]).toMatch(
      /^INSERT INTO\s+"SubscriptionPlan"/i,
    );
  });

  it('T29d: it restores a soft-deleted free row so downgradeToFree can find it', () => {
    // SubscriptionPlanRepository.findByCode filters deletedAt: null, so a
    // soft-deleted 'free' row would make the INSERT a permanent no-op against
    // the unique code index.
    expect(bootstrapSql).toMatch(/UPDATE\s+"SubscriptionPlan"/i);
    expect(bootstrapSql).toMatch(/"deletedAt"\s+=\s+NULL/i);
    expect(bootstrapSql).toMatch(/WHERE\s+"code"\s*=\s*'free'/);
  });

  it('T29e: the restore never rewrites pricing or activation', () => {
    const update = bootstrapStatements[0];
    expect(update).not.toMatch(/"price/i);
    expect(update).not.toMatch(/"currency"/i);
    expect(update).not.toMatch(/"isActive"/i);
    expect(update).not.toMatch(/"trialDays"|"maxUsers"|"maxProducts"/i);
  });

  it('T-bootstrap: it needs no operator, permission or application startup', () => {
    const executable = stripComments(bootstrapSql);
    expect(executable).not.toMatch(/PLATFORM_OPERATOR/i);
    expect(executable).not.toMatch(/"Permission"/i);
    expect(executable).not.toMatch(/"RolePermission"/i);
  });
});

describe('AuditLog.companyId nullable migration (G16-N-4 P0-A)', () => {
  it('the migration exists', () => {
    expect(nullableSql).not.toBe('');
  });

  it('it only relaxes the NOT NULL constraint', () => {
    expect(nullableStatements).toHaveLength(1);
    expect(nullableStatements[0]).toMatch(
      /ALTER TABLE\s+"AuditLog"\s+ALTER COLUMN\s+"companyId"\s+DROP NOT NULL/i,
    );
  });

  it('it performs no data rewrite and no destructive change', () => {
    const executable = stripComments(nullableSql);
    expect(executable).not.toMatch(/\bUPDATE\b/i);
    expect(executable).not.toMatch(/\bDELETE\b/i);
    expect(executable).not.toMatch(/\bTRUNCATE\b/i);
    expect(executable).not.toMatch(/\bCREATE\b/i);
    // The single DROP allowed is the NOT NULL relaxation itself.
    expect(executable.match(/\bDROP\b/gi)).toHaveLength(1);
  });

  it('the live schema declares AuditLog.companyId nullable and keeps the Company relation', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model AuditLog {'));
    const body = model.slice(0, model.indexOf('\n}'));
    expect(body).toMatch(/companyId\s+String\?/);
    expect(body).toMatch(
      /company\s+Company\?\s+@relation\(fields: \[companyId\], references: \[id\], onDelete: Cascade\)/,
    );
  });

  it('tenant audit indexes are preserved', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model AuditLog {'));
    const body = model.slice(0, model.indexOf('\n}'));
    expect(body).toMatch(/@@index\(\[companyId\]\)/);
    expect(body).toMatch(/@@index\(\[companyId, createdAt\]\)/);
    expect(body).toMatch(/@@index\(\[entity, entityId\]\)/);
  });
});
