#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * G16-I-3 — legacy Stock ↔ CostLayer reconciliation runner (approved G16-I-2 design).
 *
 * Modes:
 *   node scripts/reconcile-cost-layers.mjs             → DRY-RUN (default, read-only)
 *   node scripts/reconcile-cost-layers.mjs --dry-run   → DRY-RUN (read-only)
 *   node scripts/reconcile-cost-layers.mjs --apply     → WRITE MODE (one tx per pair)
 *
 * Discovers mismatch pairs READ-ONLY (Σ IN remainingQuantity !== Stock.quantity),
 * then processes them per pair (batch size 25). Dry-run never opens a write
 * transaction; apply mode never runs without the explicit --apply flag.
 *
 * G16-J-R1: --apply requires a valid audit actor. The runner resolves
 * STOCKFLOW_RECONCILIATION_ACTOR_USER_ID to a real, ACTIVE User.id BEFORE any
 * discovery/write; a missing, malformed, nonexistent or inactive actor aborts
 * the run with exit code 1 and no data change. Dry-run needs no actor.
 *
 * Exit codes: 0 = no failures; 1 = at least one pair FAILED (or actor
 * resolution failed before any write).
 */
import { createRequire } from 'module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { StockReconciliationService } = require('./dist/modules/inventory/services/stock-reconciliation.service.js');
const { AuditLogService } = require('./dist/modules/shared/services/audit-log.service.js');
const {
  resolveReconciliationActor,
  ReconciliationActorResolutionError,
  RECONCILIATION_ACTOR_ENV_VAR,
} = require('./dist/modules/inventory/services/reconciliation-actor.resolver.js');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const BATCH_SIZE = 25;

const prisma = new PrismaClient();
// The service only needs log() from AuditLogService; the runner's actor is
// resolved (G16-J-R1) from STOCKFLOW_RECONCILIATION_ACTOR_USER_ID — a real,
// ACTIVE User.id validated before any write transaction is opened.
const auditLogService = new AuditLogService(prisma);
const service = new StockReconciliationService(prisma, auditLogService);

const J = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));

/** READ-ONLY discovery of mismatch pairs (same classification as G16-I-1). */
async function discoverPairs() {
  return prisma.$queryRawUnsafe(`
    WITH st AS (
      SELECT s."companyId" AS cid, s."productId" AS pid, SUM(s.quantity) AS qty
      FROM "Stock" s WHERE s.quantity > 0 GROUP BY 1, 2
    ),
    p AS (
      SELECT DISTINCT ON ("id") "id" AS pid2, "companyId", "costPrice"
      FROM "Product" ORDER BY "id", "createdAt" DESC
    ),
    cp AS (
      SELECT "companyId" AS cid, "productId" AS pid,
             COALESCE(SUM(CASE WHEN "direction" = 'IN' THEN "remainingQuantity" ELSE 0 END), 0) AS in_rem
      FROM "CostLayer" GROUP BY 1, 2
    )
    SELECT st.cid::text AS "companyId", st.pid::text AS "productId", st.qty AS "stockQty",
           cp.in_rem AS "inRemaining", p."costPrice"::text AS "costPrice"
    FROM st
    JOIN p ON p.pid2 = st.pid AND p."companyId" = st.cid
    LEFT JOIN cp ON cp.cid = st.cid AND cp.pid = st.pid
    WHERE st.qty <> COALESCE(cp.in_rem, 0)
    ORDER BY (st.qty - COALESCE(cp.in_rem, 0)) DESC
  `);
}

async function main() {
  // G16-J-R1: resolve the audit actor BEFORE discovery so an unusable actor
  // fails fast with zero write transactions. Dry-run needs no actor.
  let actorUserId = null;
  if (APPLY) {
    try {
      actorUserId = await resolveReconciliationActor(prisma);
    } catch (e) {
      const detail =
        e instanceof ReconciliationActorResolutionError
          ? `[${e.code}] ${e.message}`
          : String(e.message).split('\n').slice(-2).join(' | ');
      console.error(`FATAL: cannot resolve reconciliation audit actor (${RECONCILIATION_ACTOR_ENV_VAR}): ${detail}`);
      console.error('Aborting before any discovery/write. No CostLayer and no AuditLog were written.');
      await prisma.$disconnect();
      process.exit(1);
    }
    console.log(`Audit actor (${RECONCILIATION_ACTOR_ENV_VAR}): ${actorUserId}`);
  }

  const pairs = await discoverPairs();
  console.log(`Discovered ${pairs.length} mismatch pair(s). Mode: ${APPLY ? 'APPLY (write)' : 'DRY-RUN (read-only)'}`);
  if (!APPLY) console.log('No changes will be made. Pass --apply to write.\n');

  const totals = { AUTO_RECONCILED: 0, MANUAL_REQUIRED: 0, SKIPPED: 0, FAILED: 0 };
  let failed = false;

  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    console.log(`— batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} pairs) —`);
    for (const pair of batch) {
      try {
        if (!APPLY) {
          const plan = await service.dryRunPair(pair.companyId, pair.productId);
          totals[plan.action === 'AUTO' ? 'AUTO_RECONCILED' : plan.action === 'MANUAL' ? 'MANUAL_REQUIRED' : 'SKIPPED'] += 1;
          console.log(J({
            companyId: pair.companyId,
            productId: pair.productId,
            class: plan.action,
            stockQty: plan.stockQty ?? pair.stockQty,
            inRemaining: plan.inRemaining ?? pair.inRemaining,
            delta: plan.delta ?? (pair.stockQty - pair.inRemaining),
            costPrice: pair.costPrice,
            proposedAction: plan.action,
            proposedUnitCost: plan.unitCost?.toString() ?? null,
            proposedTotalCost: plan.totalCost?.toString() ?? null,
            reason: plan.reason,
          }));
        } else {
          const result = await service.reconcilePair(pair.companyId, pair.productId, actorUserId);
          totals[result.status] += 1;
          if (result.status === 'FAILED') failed = true;
          console.log(J(result));
        }
      } catch (e) {
        totals.FAILED += 1;
        failed = true;
        console.log(J({ status: 'FAILED', companyId: pair.companyId, productId: pair.productId, reason: String(e.message).split('\n').slice(-2).join(' | ') }));
      }
    }
  }

  console.log('\n===== SUMMARY =====');
  console.log(J({ mode: APPLY ? 'APPLY' : 'DRY-RUN', pairs: pairs.length, ...totals }));
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exitCode = 1;
});
