import * as fs from 'fs';
import * as path from 'path';

/**
 * G15-07-C3-A — static verification of the FinancialTransaction → GL
 * foundation migrations.
 *
 * The repository has no migration-execution harness (no precedent for
 * running a migration file inside the test suite), and C3-A deliberately
 * does not introduce one. These specs therefore verify the migrations' SQL
 * structure statically: read from disk and asserted to be additive,
 * idempotent, tenant-scoped and fail-closed. They do NOT prove runtime
 * execution against a database — that limitation is reported separately.
 */
const strip = (raw: string) =>
  raw
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('G15-07-C3-A schema migration — static SQL verification', () => {
  const raw = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../../prisma/migrations/20260925154000_g15_07_c3a_ft_posting_foundation/migration.sql',
    ),
    'utf8',
  );
  const sql = strip(raw);

  it('creates the posting-status enum with exactly DRAFT/POSTED/REVERSED', () => {
    expect(sql).toMatch(
      /CREATE TYPE "FinancialTransactionPostingStatus" AS ENUM \('DRAFT', 'POSTED', 'REVERSED'\)/,
    );
  });

  it('adds exactly the four approved columns, postingStatus default DRAFT', () => {
    expect(sql).toMatch(/ADD COLUMN "destinationBankAccountId" UUID/);
    expect(sql).toMatch(
      /ADD COLUMN "postingStatus" "FinancialTransactionPostingStatus" NOT NULL DEFAULT 'DRAFT'/,
    );
    expect(sql).toMatch(/ADD COLUMN "journalEntryId" UUID/);
    expect(sql).toMatch(/ADD COLUMN "idempotencyKey" VARCHAR\(100\)/);
    // No counterpart/source/financialPeriodId columns, no other ALTER.
    expect(sql).not.toMatch(/counterpartAccountId/);
    expect(sql).not.toMatch(/sourceAccountId/i);
  });

  it('adds indexes without unique constraints on the new columns', () => {
    expect(sql).toMatch(/CREATE INDEX "FinancialTransaction_postingStatus_idx"/);
    expect(sql).toMatch(/CREATE INDEX "FinancialTransaction_journalEntryId_idx"/);
    expect(sql).toMatch(
      /CREATE INDEX "FinancialTransaction_destinationBankAccountId_idx"/,
    );
    expect(sql).toMatch(
      /CREATE INDEX "FinancialTransaction_companyId_postingStatus_idx"/,
    );
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX/);
  });

  it('links destination bank and journal entry with SET NULL semantics', () => {
    expect(sql).toMatch(
      /FOREIGN KEY \("destinationBankAccountId"\) REFERENCES "BankAccount"\("id"\) ON DELETE SET NULL/,
    );
    expect(sql).toMatch(
      /FOREIGN KEY \("journalEntryId"\) REFERENCES "JournalEntry"\("id"\) ON DELETE SET NULL/,
    );
  });

  it('is additive only — no DELETE, DROP, TRUNCATE, no data rewrite', () => {
    // Strip referential actions ("ON DELETE SET NULL") so the assertion
    // targets statements, not FK clauses.
    const statements = sql.replace(/ON DELETE (SET NULL|CASCADE|RESTRICT)/gi, '');
    expect(statements).not.toMatch(/\bDELETE\b/i);
    expect(statements).not.toMatch(/\bDROP\b/i);
    expect(statements).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('sorts after the C1 provisioning migration', () => {
    expect('20260925154000' > '20260925120000').toBe(true);
  });
});

describe('G15-07-C3-A cash-GL backfill migration — static SQL verification', () => {
  const raw = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../../prisma/migrations/20260925155000_g15_07_c3a_cash_gl_accounts_backfill/migration.sql',
    ),
    'utf8',
  );
  const sql = strip(raw);

  it('is additive only — no DELETE, DROP, ALTER or TRUNCATE', () => {
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bALTER\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('fails closed on conflicting non-canonical rows before provisioning', () => {
    expect(sql).toMatch(/DO \$\$/);
    expect(sql).toMatch(/RAISE EXCEPTION/);
    expect(sql).toMatch(/'6100', 'EXPENSE'::"AccountType", 'DEBIT'::"NormalBalance"/);
    expect(sql).toMatch(/'4200', 'REVENUE'::"AccountType", 'CREDIT'::"NormalBalance"/);
    expect(sql).toMatch(/ca\."isSystem" = false/);
    // The guard aborts before any provisioning write.
    expect(sql.indexOf('RAISE EXCEPTION')).toBeLessThan(
      sql.indexOf('UPDATE "ChartOfAccount"'),
    );
  });

  it('restores soft-deleted canonical SYSTEM rows, scoped and idempotent', () => {
    expect(sql).toMatch(
      /UPDATE "ChartOfAccount" SET "deletedAt" = NULL, "isActive" = true/,
    );
    expect(sql).toMatch(/"code" IN \('6100', '4200', '6200', '4210'\)/);
    expect(sql).toMatch(/"isSystem" = true AND "deletedAt" IS NOT NULL/);
  });

  it('inserts the four accounts only where no row exists', () => {
    for (const code of ['6100', '4200', '6200', '4210']) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toMatch(/WHERE NOT EXISTS \( SELECT 1 FROM "ChartOfAccount" ca/);
    expect(sql).toMatch(/ca\."companyId" = c\."id" AND ca\."code" = seed\."code"/);
    expect(sql).toMatch(/gen_random_uuid\(\)/);
    expect(sql).toMatch(/FROM "Company" c/);
  });

  it('uses the seeder sort orders 13-16 without re-sorting existing rows', () => {
    expect(sql).toMatch(/, 13 \)/);
    expect(sql).toMatch(/, 14 \)/);
    expect(sql).toMatch(/, 15 \)/);
    expect(sql).toMatch(/, 16 \)/);
  });

  it('runs guard → restore → insert in that order', () => {
    const guard = sql.indexOf('RAISE EXCEPTION');
    const restore = sql.indexOf('UPDATE "ChartOfAccount"');
    const insert = sql.indexOf('INSERT INTO "ChartOfAccount"');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(restore).toBeGreaterThan(guard);
    expect(insert).toBeGreaterThan(restore);
  });

  it('sorts after the schema migration', () => {
    expect('20260925155000' > '20260925154000').toBe(true);
  });
});
