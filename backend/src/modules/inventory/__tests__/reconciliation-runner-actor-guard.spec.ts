import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RECONCILIATION_ACTOR_ENV_VAR } from '../services/reconciliation-actor.resolver';

/**
 * G16-J-R1 — runner audit-actor guard (P0 remediation): wiring + read-only smoke.
 *
 * IMPORTANT: this suite NEVER executes the runner with `--apply` (forbidden).
 * The apply path is proven safe by:
 *   (a) the resolver unit tests (MISSING / INVALID / NOT_FOUND / INACTIVE), and
 *   (b) static assertions that the runner resolves the actor BEFORE discovery
 *       and hands the RESOLVED id — never a literal — to the service.
 * Only the READ-ONLY dry-run mode is ever spawned here.
 */
const BACKEND_ROOT = path.resolve(__dirname, '../../../..');
const SCRIPT = path.join(BACKEND_ROOT, 'scripts', 'reconcile-cost-layers.mjs');
const DIST_RESOLVER = path.join(
  BACKEND_ROOT,
  'dist/modules/inventory/services/reconciliation-actor.resolver.js',
);

const canRun = fs.existsSync(SCRIPT) && fs.existsSync(DIST_RESOLVER);
const describeRunner = canRun ? describe : describe.skip;

describeRunner('reconcile-cost-layers actor guard — G16-J-R1', () => {
  const source = fs.readFileSync(SCRIPT, 'utf8');

  it('resolves the audit actor via the shared resolver + env var name', () => {
    expect(source).toContain('resolveReconciliationActor');
    expect(source).toContain('RECONCILIATION_ACTOR_ENV_VAR');
    expect(source).toContain('reconciliation-actor.resolver.js');
    expect(source).toContain('ReconciliationActorResolutionError');
  });

  it('no longer contains the invalid literal actor', () => {
    expect(source).not.toContain("'reconciliation-runner'");
    expect(source).not.toMatch(/const\s+ACTOR\s*=/);
  });

  it('resolves/validates the actor BEFORE discovery and passes the resolved id to the service', () => {
    const resolveIdx = source.indexOf(
      'await resolveReconciliationActor(prisma)',
    );
    const discoverIdx = source.indexOf('await discoverPairs()');
    const passIdx = source.indexOf(
      'service.reconcilePair(pair.companyId, pair.productId, actorUserId)',
    );

    expect(resolveIdx).toBeGreaterThan(-1);
    expect(discoverIdx).toBeGreaterThan(-1);
    expect(passIdx).toBeGreaterThan(-1);
    // Fail-fast ordering: actor resolution precedes any discovery/processing.
    expect(resolveIdx).toBeLessThan(discoverIdx);
    // The service never receives a literal actor.
    expect(source).not.toMatch(/reconcilePair\([^)]*ACTOR/);
  });

  it('aborts with a non-zero exit before discovery when the actor is unusable (simulated guard)', () => {
    // The runner guards apply mode; here we assert the guard's fail-fast shape
    // without ever invoking `--apply`: the resolution call sits inside the
    // APPLY branch and short-circuits with process.exit(1) before discoverPairs.
    const applyBranch = source.slice(
      source.indexOf('if (APPLY) {'),
      source.indexOf('const pairs = await discoverPairs()'),
    );
    expect(applyBranch).toContain('await resolveReconciliationActor(prisma)');
    expect(applyBranch).toContain('process.exit(1)');
    expect(applyBranch).toContain('prisma.$disconnect()');
    // No pair is processed from within the failing branch.
    expect(applyBranch).not.toContain('reconcilePair');
  });

  it('dry-run (read-only) never requires an actor: the guard does not fire', () => {
    const r = spawnSync(process.execPath, [SCRIPT], {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        // Actor intentionally empty AND the DB unreachable — dry-run must not
        // touch the actor guard at all (and must never write anything).
        [RECONCILIATION_ACTOR_ENV_VAR]: '',
        DATABASE_URL:
          'postgresql://nobody:nobody@127.0.0.1:1/none?connect_timeout=1&pool_timeout=1',
      },
      encoding: 'utf8',
      timeout: 60_000,
    });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;

    expect(out).not.toContain(RECONCILIATION_ACTOR_ENV_VAR);
    expect(out).not.toMatch(/cannot resolve reconciliation audit actor/);
  });
});
