import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * G16-L-2C-4-R1 — targeted regression pin for the READ-ONLY JobRun CLI.
 *
 * The CLI is a plain .mjs script (no DB in unit tests), so these tests pin the
 * contract at source level, mirroring the project convention used by
 * billing-cron.service.spec.ts ("stable jobName mapping"):
 *   1. READ-ONLY guarantee — only $queryRawUnsafe, no mutation APIs;
 *   2. no un-cast COUNT(*) / no ::bigint — the exact cause of the G16-L-2C-4
 *      P2 defect (PostgreSQL int8 -> JS BigInt -> JSON.stringify throws
 *      "Do not know how to serialize a BigInt" in --json mode);
 *   3. stale detection config covers exactly the 10 approved jobs;
 *   4. G16-L-2C-OPS-2-R1 regression — the human-mode printReport path is
 *      EXECUTED (spawning the real CLI against the dev DB) so a destructure
 *      drift between main() and printReport() can never silently pass again.
 */
describe('inspect-job-runs CLI (read-only JobRun inspector)', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', '..', 'scripts', 'inspect-job-runs.mjs'),
    'utf8',
  );

  it('is strictly read-only: $queryRawUnsafe only, no mutation APIs', () => {
    expect(source).not.toMatch(/prisma\.\$executeRaw/);
    expect(source).not.toMatch(
      /\.create\(|\.update\(|\.upsert\(|\.delete\(|\.deleteMany\(|\.updateMany\(/,
    );
    expect(source.match(/\$queryRawUnsafe/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('serializes safely: every COUNT(*) is ::int and no ::bigint casts remain (P2 regression)', () => {
    // G16-L-2C-4 P2: un-cast COUNT(*) and ::bigint return JS BigInt from
    // $queryRawUnsafe; JSON.stringify(report) then throws
    // "Do not know how to serialize a BigInt" in --json mode.
    expect(source).not.toMatch(/COUNT\(\*\)(?!::int)/);
    expect(source).not.toMatch(/::bigint/);

    // The former failure mechanism itself, pinned so the class of bug is
    // understood if it ever reappears:
    expect(() => JSON.stringify({ skipped7d: 1n })).toThrow();
    expect(() => JSON.stringify({ skipped7d: 1 })).not.toThrow();
  });

  it('stale detection config covers exactly the 10 approved jobs', () => {
    const jobNames = [
      ...source.matchAll(/jobName: '([a-z.-]+)'/g),
    ].map((m) => m[1]);

    expect(jobNames.sort()).toEqual(
      [
        'billing.cleanup',
        'billing.expire-suspended',
        'billing.expired-trials',
        'billing.recurring-invoices',
        'billing.reset-usage',
        'billing.resume-paid',
        'billing.retry-payments',
        'billing.suspend-overdue',
        'maintenance.cleanup-idempotency',
        'notifications.scan-overdue',
      ].sort(),
    );
    // staleAfter = max(2 x interval, 2 x TTL) — formula pinned in SQL.
    expect(source).toContain('GREATEST');
    expect(source).toContain("* 2");
  });

  it('printReport destructures the actual report keys (OPS-2 P2 regression pin)', () => {
    // G16-L-2C-OPS-2 P2: printReport destructured { latest, consec, stale,
    // durations } but main() passes a report object keyed latest,
    // consecutiveFailures, staleRunning, durationPercentiles — consec/stale/
    // durations were always undefined and human mode crashed with
    // "TypeError: Cannot read properties of undefined (reading 'length')".
    const destructure =
      source.match(/function printReport\(\{([\s\S]*?)\}\)/)?.[1] ?? '';
    expect(destructure).toContain('latest');
    expect(destructure).toContain('consecutiveFailures');
    expect(destructure).toContain('staleRunning');
    expect(destructure).toContain('durationPercentiles');
  });

  describe('execution-based smoke (spawns the real CLI against the dev DB)', () => {
    const backendRoot = join(__dirname, '..', '..', '..', '..');
    const cliPath = join(backendRoot, 'scripts', 'inspect-job-runs.mjs');

    it(
      'human mode exits 0 with every report section rendered (no TypeError/FATAL)',
      () => {
        const res = spawnSync(process.execPath, [cliPath], {
          cwd: backendRoot,
          encoding: 'utf8',
          timeout: 60_000,
        });
        expect(res.error).toBeUndefined();
        expect(res.status).toBe(0);
        expect(`${res.stderr}${res.stdout}`).not.toMatch(/TypeError|FATAL/);
        expect(res.stdout).toContain('===== JobRun inspection (read-only) =====');
        expect(res.stdout).toContain('--- Latest run per job ---');
        expect(res.stdout).toContain('--- Consecutive failures ---');
        expect(res.stdout).toContain('--- Stale RUNNING');
        expect(res.stdout).toContain('--- Duration percentiles');
      },
    );

    it(
      '--json mode exits 0 with a parseable report of array sections',
      () => {
        const res = spawnSync(process.execPath, [cliPath, '--json'], {
          cwd: backendRoot,
          encoding: 'utf8',
          timeout: 60_000,
        });
        expect(res.error).toBeUndefined();
        expect(res.status).toBe(0);
        const report = JSON.parse(res.stdout) as Record<string, unknown>;
        expect(Array.isArray(report.latest)).toBe(true);
        expect(Array.isArray(report.consecutiveFailures)).toBe(true);
        expect(Array.isArray(report.staleRunning)).toBe(true);
        expect(Array.isArray(report.durationPercentiles)).toBe(true);
      },
    );
  });
});
