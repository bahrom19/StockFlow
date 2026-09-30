#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * G16-L-2B-3 — READ-ONLY AccountBalance integrity monitor.
 *
 * Compares the CANONICAL source (JournalLine, via contributing JournalEntry)
 * against the DERIVED source (AccountBalance) per
 * (companyId, accountId, financialPeriodId).
 *
 * DETECTION ONLY. This script has NO write mode and no write path:
 *   * database access is exclusively via prisma.$queryRaw
 *   * $executeRaw / create / update / upsert / delete are never imported or used
 *   * no AuditLog, no EventBus, no NestJS bootstrap, no cron, no JobRun
 *   * no repair, no backfill, no exclusion list, no fixture special-casing
 *
 * CONTRIBUTION SEMANTICS (evidence-backed — G16-L-2B-2)
 *   Contributing JournalEntry.status IN ('POSTED', 'REVERSED')
 *
 *   NOT status = 'POSTED'. A REVERSED original retains its JournalLines AND its
 *   original AccountBalance contribution; the compensating entry is a separate
 *   POSTED JournalEntry carrying negated lines. The two net to zero, matching the
 *   net-zero balance effect. DRAFT entries hold lines but contribute nothing:
 *   journal-entries.service.ts creates DRAFT with lines, and balances are
 *   applied only on the later POST transition.
 *
 * CONSISTENCY
 *   The whole verification runs inside ONE read transaction at REPEATABLE READ,
 *   so all counts and deltas come from a single coherent snapshot.
 *
 * DECIMAL SAFETY
 *   Every monetary comparison and aggregation happens in PostgreSQL numeric.
 *   Values are serialised with toFixed(4) straight from Prisma Decimal and are
 *   NEVER routed through JavaScript Number.
 *
 * EXIT CODES
 *   0 = PASS             (zero findings across all six categories)
 *   1 = DRIFT            (one or more findings, incl. known historical fixtures)
 *   2 = EXECUTION ERROR  (DB/connection/runtime failure — NOT drift)
 */
import { createRequire } from 'module';

const require = createRequire(new URL('../package.json', import.meta.url));
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

/** Frozen, echoed into the report so every run is self-describing. */
const CONTRIBUTION_PREDICATE = "JournalEntry.status IN ('POSTED', 'REVERSED')";
const ISOLATION_LEVEL = 'REPEATABLE READ';

/**
 * Shared CTE prefix. `contributing` is the canonical side, `ab` the derived
 * side. They are UNIONed (not inner-joined) so a triple present on only one
 * side is still evaluated — that is what yields MISSING_AB / EXTRA_AB.
 *
 * The comparison key is ALWAYS the full three-column composite. `companyId` is a
 * join column rather than a filter, so a JournalLine of one tenant can never be
 * matched to an AccountBalance row of another: it surfaces as MISSING_AB under
 * the correct tenant instead of being silently absorbed.
 */
const CTE = `
  WITH contributing AS (
    SELECT je."companyId"         AS cid,
           l."accountId"          AS aid,
           je."financialPeriodId" AS pid,
           SUM(l.debit)           AS exp_debit,
           SUM(l.credit)          AS exp_credit,
           COUNT(*)               AS line_count,
           ARRAY_AGG(DISTINCT je.id::text) AS entry_ids
    FROM "JournalLine" l
    JOIN "JournalEntry" je ON je.id = l."journalEntryId"
    WHERE je.status IN ('POSTED', 'REVERSED')
    GROUP BY 1, 2, 3
  ),
  ab AS (
    SELECT "companyId" AS cid, "accountId" AS aid, "financialPeriodId" AS pid,
           "openingDebit"  AS op_debit,
           "openingCredit" AS op_credit,
           "periodDebit"   AS per_debit,
           "periodCredit"  AS per_credit,
           "closingDebit"  AS cl_debit,
           "closingCredit" AS cl_credit
    FROM "AccountBalance"
  ),
  unioned AS (
    SELECT
      COALESCE(c.cid, a.cid) AS cid,
      COALESCE(c.aid, a.aid) AS aid,
      COALESCE(c.pid, a.pid) AS pid,
      (c.cid IS NOT NULL) AS has_journal,
      (a.cid IS NOT NULL) AS has_balance,
      COALESCE(c.exp_debit,  0) AS exp_debit,
      COALESCE(c.exp_credit, 0) AS exp_credit,
      COALESCE(c.line_count, 0) AS line_count,
      c.entry_ids AS entry_ids,
      COALESCE(a.op_debit,   0) AS op_debit,
      COALESCE(a.op_credit,  0) AS op_credit,
      COALESCE(a.per_debit,  0) AS per_debit,
      COALESCE(a.per_credit, 0) AS per_credit,
      COALESCE(a.cl_debit,   0) AS cl_debit,
      COALESCE(a.cl_credit,  0) AS cl_credit
    FROM contributing c
    FULL OUTER JOIN ab a
      ON c.cid = a.cid AND c.aid = a.aid AND c.pid = a.pid
  )`;

/**
 * Per-triple evaluation. Categories are decided in SQL so every comparison is an
 * exact numeric comparison, never a JavaScript float comparison.
 *
 * A triple may legitimately yield several findings at once; they are emitted
 * independently and never collapsed into one generic mismatch.
 */
const EVAL = `
  SELECT u.*,
         (u.per_debit  - u.exp_debit)  AS debit_delta,
         (u.per_credit - u.exp_credit) AS credit_delta,
         -- A. canonical contribution with no derived row
         (u.has_journal AND NOT u.has_balance) AS is_missing_ab,
         -- B. derived row with no canonical contribution
         (NOT u.has_journal AND u.has_balance) AS is_extra_ab,
         -- C/D. period totals must equal canonical sums (both sides present)
         (u.has_balance AND u.has_journal AND u.per_debit  <> u.exp_debit)  AS is_period_debit_mismatch,
         (u.has_balance AND u.has_journal AND u.per_credit <> u.exp_credit) AS is_period_credit_mismatch,
         -- E. documented semantics: opening is always 0 and never changes
         (u.has_balance AND (u.op_debit <> 0 OR u.op_credit <> 0)) AS is_opening_mismatch,
         -- F. structural identity — stays valid if real opening balances appear
         (u.has_balance AND (u.cl_debit <> u.op_debit + u.per_debit
                          OR u.cl_credit <> u.op_credit + u.per_credit)) AS is_closing_mismatch
  FROM unioned u`;

const COUNTS_SQL = `
  ${CTE}
  SELECT
    (SELECT count(*) FROM contributing) AS journal_line_triples,
    (SELECT count(*) FROM ab) AS account_balance_rows,
    (SELECT count(DISTINCT cid) FROM (
        SELECT cid FROM contributing UNION SELECT cid FROM ab
     ) t) AS company_count`;

/**
 * One row per triple plus window aggregates, so the findings and the totals are
 * guaranteed to describe the very same row set.
 *
 * totalDebitDelta / totalCreditDelta are unsigned magnitudes: SUM of ABS delta.
 * maxAbsoluteDelta is the largest single discrepancy across debit, credit, and
 * the internal opening/closing identity.
 */
const FINDINGS_SQL = `
  ${CTE},
  evaluated AS (${EVAL})
  SELECT e.*,
         co.name  AS company_name,
         coa.code AS account_code,
         SUM(ABS(e.debit_delta))  OVER () AS total_debit_delta,
         SUM(ABS(e.credit_delta)) OVER () AS total_credit_delta,
         MAX(GREATEST(
               ABS(e.debit_delta),
               ABS(e.credit_delta),
               CASE WHEN e.has_balance THEN ABS(e.cl_debit - (e.op_debit + e.per_debit))   ELSE 0 END,
               CASE WHEN e.has_balance THEN ABS(e.cl_credit - (e.op_credit + e.per_credit)) ELSE 0 END
             )) OVER () AS max_abs_delta
  FROM evaluated e
  LEFT JOIN "Company" co        ON co.id  = e.cid
  LEFT JOIN "ChartOfAccount" coa ON coa.id = e.aid
  ORDER BY e.cid, e.aid, e.pid`;

/** Decimal-safe scalar rendering: exact 4dp string, never a JS number. */
const money = (v) => (v === null || v === undefined ? '0.0000' : v.toFixed(4));

const CATEGORY_FLAGS = [
  ['MISSING_AB', 'is_missing_ab', 'missingAccountBalance'],
  ['EXTRA_AB', 'is_extra_ab', 'extraAccountBalance'],
  ['PERIOD_DEBIT_MISMATCH', 'is_period_debit_mismatch', 'periodDebitMismatch'],
  ['PERIOD_CREDIT_MISMATCH', 'is_period_credit_mismatch', 'periodCreditMismatch'],
  ['OPENING_MISMATCH', 'is_opening_mismatch', 'openingMismatch'],
  ['CLOSING_MISMATCH', 'is_closing_mismatch', 'closingMismatch'],
];

async function main() {
  // ONE read transaction, REPEATABLE READ: counts and findings come from a
  // single coherent snapshot. $queryRawUnsafe is used because the composed CTE
  // text cannot be parameterised; it is still a SELECT-only statement.
  const result = await prisma.$transaction(
    async (tx) => {
      const counts = await tx.$queryRawUnsafe(COUNTS_SQL);
      const rows = await tx.$queryRawUnsafe(FINDINGS_SQL);
      return { counts: counts[0], rows };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  const { counts, rows } = result;

  const categories = Object.fromEntries(CATEGORY_FLAGS.map(([, , k]) => [k, 0]));
  const findings = [];

  for (const r of rows) {
    for (const [category, flag, counter] of CATEGORY_FLAGS) {
      if (!r[flag]) continue;
      categories[counter] += 1;
      findings.push({
        category,
        companyId: r.cid,
        companyName: r.company_name ?? null,
        accountId: r.aid,
        accountCode: r.account_code ?? null,
        financialPeriodId: r.pid,
        expectedDebit: money(r.exp_debit),
        expectedCredit: money(r.exp_credit),
        // A missing derived row compares against an exact zero baseline; no row
        // is manufactured for it.
        actualDebit: money(r.per_debit),
        actualCredit: money(r.per_credit),
        openingDebit: money(r.op_debit),
        openingCredit: money(r.op_credit),
        closingDebit: money(r.cl_debit),
        closingCredit: money(r.cl_credit),
        lineCount: Number(r.line_count ?? 0),
        journalEntryIds: Array.isArray(r.entry_ids) ? r.entry_ids : [],
      });
    }
  }

  const first = rows[0];
  const totalDebitDelta = money(first ? first.total_debit_delta : 0);
  const totalCreditDelta = money(first ? first.total_credit_delta : 0);
  const maxAbsoluteDelta = money(first ? first.max_abs_delta : 0);

  const report = {
    checkedAt: new Date().toISOString(),
    contributionPredicate: CONTRIBUTION_PREDICATE,
    isolationLevel: ISOLATION_LEVEL,
    mode: 'READ-ONLY',
    companyCount: Number(counts.company_count ?? 0),
    journalLineTriples: Number(counts.journal_line_triples ?? 0),
    accountBalanceRows: Number(counts.account_balance_rows ?? 0),
    categories,
    totalDebitDelta,
    totalCreditDelta,
    maxAbsoluteDelta,
    deltaSemantics: {
      totalDebitDelta:
        'SUM(ABS(actualDebit - expectedDebit)) across every compared triple',
      totalCreditDelta:
        'SUM(ABS(actualCredit - expectedCredit)) across every compared triple',
      maxAbsoluteDelta:
        'MAX of |debitDelta|, |creditDelta| and the internal opening/closing discrepancy',
      units: 'currency units, exact numeric(18,4), unsigned magnitudes',
    },
    findingCount: findings.length,
    findings,
    affectedCompanies: [...new Set(findings.map((f) => f.companyId))].sort(),
    status: findings.length === 0 ? 'PASS' : 'DRIFT',
  };

  console.log(JSON.stringify(report, null, 2));
  return report.status === 'PASS' ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    // Infrastructure/query failure is NOT drift: report it distinctly and exit 2
    // so a broken monitor is never mistaken for a clean or a dirty ledger.
    console.error(
      `[verify-account-balance] EXECUTION ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    process.exitCode = 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

