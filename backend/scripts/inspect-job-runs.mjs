#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * G16-L-2C-3 — JobRun inspection CLI (READ-ONLY).
 *
 * Usage:
 *   node scripts/inspect-job-runs.mjs            # full report
 *   node scripts/inspect-job-runs.mjs --json     # machine-readable report
 *
 * Guarantees:
 *   - ONLY $queryRawUnsafe is used. There is NO $executeRaw, create, update,
 *     delete or upsert anywhere in this file — the tool cannot mutate data.
 *   - STALE definition: status = 'RUNNING' AND startedAt < now - staleAfter,
 *     where staleAfter = max(2 × cron interval, 2 × lock TTL) per job.
 *   - Stale RUNNING rows are REPORTED, never modified. Nothing in this script
 *     translates a stale RUNNING into FAILED or any other status.
 */

import { createRequire } from 'module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');

const JSON_MODE = process.argv.includes('--json');

// Per-job operational parameters for the stale threshold. Mirrors the cron
// services (LOCK_TTL_BY_JOB in billing-cron.service.ts, LOCK_TTL_SEC in
// maintenance-cron.service.ts / overdue-notification-cron.service.ts).
// intervalSec = schedule period; ttlSec = distributed lock TTL.
const JOBS = [
  { jobName: 'billing.expired-trials',          intervalSec: 60,    ttlSec: 55 },
  { jobName: 'billing.recurring-invoices',      intervalSec: 86400, ttlSec: 1800 },
  { jobName: 'billing.retry-payments',          intervalSec: 300,   ttlSec: 300 },
  { jobName: 'billing.suspend-overdue',         intervalSec: 1800,  ttlSec: 900 },
  { jobName: 'billing.expire-suspended',        intervalSec: 86400, ttlSec: 1800 },
  { jobName: 'billing.reset-usage',             intervalSec: 2592000, ttlSec: 300 },
  { jobName: 'billing.resume-paid',             intervalSec: 300,   ttlSec: 240 },
  { jobName: 'billing.cleanup',                 intervalSec: 86400, ttlSec: 1800 },
  { jobName: 'maintenance.cleanup-idempotency', intervalSec: 86400, ttlSec: 7200 },
  { jobName: 'notifications.scan-overdue',      intervalSec: 86400, ttlSec: 1800 },
];

/** staleAfter = max(2 × cron interval, 2 × lock TTL), per approved design. */
function staleAfterSeconds(job) {
  return Math.max(2 * job.intervalSec, 2 * job.ttlSec);
}

const prisma = new PrismaClient();

/** Latest run per job, with SKIPPED stats and consecutive-failure chains. */
async function latestRuns() {
  // One row per job: its most recent run of ANY status, plus skip/failure
  // counters over the trailing 7 days (rolling window for operator triage).
  return prisma.$queryRawUnsafe(`
    WITH latest AS (
      SELECT DISTINCT ON ("jobName")
             "jobName", "status", "skipReason", "startedAt",
             "finishedAt", "durationMs", "errorMessage"
      FROM "JobRun"
      ORDER BY "jobName", "startedAt" DESC
    )
    SELECT
      latest."jobName",
      latest."status"        AS "latestStatus",
      latest."skipReason"    AS "latestSkipReason",
      latest."startedAt"     AS "latestStartedAt",
      latest."finishedAt"    AS "latestFinishedAt",
      latest."durationMs"    AS "latestDurationMs",
      latest."errorMessage"  AS "latestErrorMessage",
      COALESCE(s7."skipped7d", 0)         AS "skipped7d",
      COALESCE(f7."failed7d", 0)          AS "failed7d",
      COALESCE(r."totalRuns7d", 0)        AS "totalRuns7d"
    FROM latest
    LEFT JOIN (
      SELECT "jobName", COUNT(*)::int AS "skipped7d"
      FROM "JobRun"
      WHERE "status" = 'SKIPPED' AND "startedAt" > NOW() - INTERVAL '7 days'
      GROUP BY "jobName"
    ) s7 ON s7."jobName" = latest."jobName"
    LEFT JOIN (
      SELECT "jobName", COUNT(*)::int AS "failed7d"
      FROM "JobRun"
      WHERE "status" = 'FAILED' AND "startedAt" > NOW() - INTERVAL '7 days'
      GROUP BY "jobName"
    ) f7 ON f7."jobName" = latest."jobName"
    LEFT JOIN (
      SELECT "jobName", COUNT(*)::int AS "totalRuns7d"
      FROM "JobRun"
      WHERE "startedAt" > NOW() - INTERVAL '7 days'
      GROUP BY "jobName"
    ) r ON r."jobName" = latest."jobName"
    ORDER BY latest."jobName"
  `);
}

/** Consecutive failures per job: how many FAILED runs in a row before the last non-FAILED one. */
async function consecutiveFailures() {
  return prisma.$queryRawUnsafe(`
    WITH ranked AS (
      SELECT "jobName", "status",
             ROW_NUMBER() OVER (PARTITION BY "jobName" ORDER BY "startedAt" DESC) AS rn
      FROM "JobRun"
      WHERE "status" IN ('RUNNING', 'SUCCEEDED', 'FAILED')
    ),
    last_ok AS (
      SELECT "jobName", MIN(rn) AS "okRn"
      FROM ranked
      WHERE "status" IN ('RUNNING', 'SUCCEEDED')
      GROUP BY "jobName"
    )
    SELECT ranked."jobName", COUNT(*)::int AS "consecutiveFailures"
    FROM ranked
    LEFT JOIN last_ok ON last_ok."jobName" = ranked."jobName"
    WHERE ranked."status" = 'FAILED'
      AND (last_ok."okRn" IS NULL OR ranked.rn < last_ok."okRn")
    GROUP BY ranked."jobName"
    ORDER BY ranked."jobName"
  `);
}

/** Stale RUNNING rows — REPORTED ONLY, never mutated by this tool. */
async function staleRunning() {
  const jobs = JSON.stringify(JOBS);
  return prisma.$queryRawUnsafe(
    `
    WITH params AS (
      SELECT (j->>'jobName')                      AS "jobName",
             GREATEST((j->>'intervalSec')::int * 2,
                      (j->>'ttlSec')::int * 2)    AS "staleAfterSec"
      FROM json_array_elements($1::json) AS j
    )
    SELECT
      p."jobName",
      COUNT(*)::int                                    AS "staleRuns",
      MIN(r."startedAt")                               AS "oldestStartedAt",
      MAX(r."startedAt")                               AS "newestStartedAt",
      p."staleAfterSec"                                AS "staleAfterSec",
      MAX(EXTRACT(EPOCH FROM (NOW() - r."startedAt")))::int AS "maxAgeSec"
    FROM params p
    JOIN "JobRun" r
      ON r."jobName" = p."jobName"
     AND r."status" = 'RUNNING'
     AND r."startedAt" < NOW() - (p."staleAfterSec" * INTERVAL '1 second')
    GROUP BY p."jobName", p."staleAfterSec"
    ORDER BY "oldestStartedAt" ASC
  `,
    jobs,
  );
}

/** Duration distribution per job over the trailing 7 days (runs that finished). */
async function durationStats() {
  return prisma.$queryRawUnsafe(`
    SELECT
      "jobName",
      COUNT(*)::int                                                        AS "runs",
      percentile_cont(0.5)  WITHIN GROUP (ORDER BY "durationMs")::int      AS "p50Ms",
      percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::int      AS "p95Ms",
      percentile_cont(0.99) WITHIN GROUP (ORDER BY "durationMs")::int      AS "p99Ms",
      MAX("durationMs")::int                                               AS "maxMs"
    FROM "JobRun"
    WHERE "durationMs" IS NOT NULL
      AND "startedAt" > NOW() - INTERVAL '7 days'
    GROUP BY "jobName"
    ORDER BY "jobName"
  `);
}

function fmtDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function printReport({ latest, consec, stale, durations }) {
  console.log('===== JobRun inspection (read-only) =====');
  console.log(`Generated: ${new Date().toISOString()}\n`);

  console.log('--- Latest run per job ---');
  for (const row of latest) {
    const when = row.latestStartedAt ? new Date(row.latestStartedAt).toISOString() : 'never';
    const dur = fmtDuration(row.latestDurationMs);
    const skip = row.latestSkipReason ? ` (skipReason: ${row.latestSkipReason})` : '';
    console.log(
      `${row.jobName.padEnd(32)} ${String(row.latestStatus).padEnd(10)} ${when}  dur=${dur}${skip}`,
    );
    if (row.latestStatus === 'FAILED' && row.latestErrorMessage) {
      console.log(`${''.padEnd(32)} └ ${row.latestErrorMessage}`);
    }
    console.log(
      `${''.padEnd(32)} └ 7d: runs=${row.totalRuns7d} failed=${row.failed7d} skipped=${row.skipped7d}`,
    );
  }

  console.log('\n--- Consecutive failures ---');
  if (consec.length === 0) {
    console.log('none');
  } else {
    for (const row of consec) {
      console.log(`${row.jobName.padEnd(32)} ${row.consecutiveFailures} consecutive FAILED run(s)`);
    }
  }

  console.log('\n--- Stale RUNNING (status=RUNNING, older than max(2×interval, 2×TTL)) ---');
  if (stale.length === 0) {
    console.log('none');
  } else {
    for (const row of stale) {
      console.log(
        `${row.jobName.padEnd(32)} ${row.staleRuns} stale run(s), oldest=${new Date(
          row.oldestStartedAt,
        ).toISOString()} maxAge=${fmtDuration(row.maxAgeSec)} staleAfter=${fmtDuration(
          Number(row.staleAfterSec) * 1000,
        )}`,
      );
    }
    console.log('NOTE: stale RUNNING rows are reported only — never modified by this tool.');
  }

  console.log('\n--- Duration percentiles (7d, finished runs) ---');
  if (durations.length === 0) {
    console.log('no finished runs');
  } else {
    for (const row of durations) {
      console.log(
        `${row.jobName.padEnd(32)} runs=${String(row.runs).padEnd(6)} p50=${fmtDuration(
          row.p50Ms,
        )} p95=${fmtDuration(row.p95Ms)} p99=${fmtDuration(row.p99Ms)} max=${fmtDuration(row.maxMs)}`,
      );
    }
  }
}

async function main() {
  const [latest, consec, stale, durations] = await Promise.all([
    latestRuns(),
    consecutiveFailures(),
    staleRunning(),
    durationStats(),
  ]);

  const report = { generatedAt: new Date().toISOString(), latest, consecutiveFailures: consec, staleRunning: stale, durationPercentiles: durations };
  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
