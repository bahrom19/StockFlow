# Billing Phase 1 (F2 + F3) — Permanent Closeout Record

**Workstream:** Billing R1/R2 — Phase 1 (F2 + F3)
**Status:** IMPLEMENTED, AUDITED, COMMITTED, PUSHED
**Deploy:** NOT PERFORMED / NOT AUTHORIZED
**Record type:** Documentation-only closeout; facts below are transcribed from the
implementation and audit records of this workstream, not re-verified at write time.

## A. Final commit

- Repository: `https://github.com/bahrom19/StockFlow`
- Branch: `main`
- Commit: `0f32a0279961691ab28194c9a8021eb3a58105f9`
- Parent: `7183ea3862b1ec7e1d5972a4b434bc20f999bdad`
- Message: `fix(billing): enforce trial expiry policy`
- Push: successful fast-forward to `origin/main` (push exit code 0; pre-push check
  confirmed `origin/main` was exactly at the parent, so no force was required)
- Post-commit audit: PASS
- Post-push verification: PASS — remote SHA matches the authorized commit
- Commit contents: 4 files changed, 413 insertions(+), 10 deletions(−)

## B. Implemented scope

The commit contains exactly these four files:

1. `backend/src/modules/billing/scheduler/billing-cron.service.ts`
2. `backend/src/modules/billing/repositories/company-subscription.repository.ts`
3. `backend/src/modules/billing/scheduler/__tests__/billing-cron.service.spec.ts`
4. `backend/src/modules/billing/__tests__/company-subscription.repository.spec.ts`

Behavioral changes:

- **F2 — strict downgrade-only trial expiry:** `processExpiredTrials` no longer
  transitions any subscription to `ACTIVE`. The former `providerCustomerId`
  activation branch was removed: `providerCustomerId` alone (assigned during
  checkout creation, before any charge succeeds) does not activate a
  subscription. Every expired trial goes through `downgradeToFree`.
- **F3 — P-C 30-day cutoff for legacy trials:** TRIAL rows with
  `trialEndsAt = NULL` now expire at `createdAt + 30 × 24 hours`. The grace
  interval is the half-open range `[createdAt, createdAt + 30d)`; a record at
  the exact cutoff is considered expired (`now >= createdAt + 30d`).
  Rows with a real `trialEndsAt` keep the pre-existing `trialEndsAt <= now`
  semantics; the `status = 'TRIAL'` and `deletedAt = NULL` filters are
  preserved; `now` is captured once per query.
- **Existing transaction/CAS protection was preserved** according to the
  independent audit: `downgradeToFree` keeps its `$transaction`, in-transaction
  fresh read, TRIAL-only stale-state guard, and `rowVersion` CAS, so a
  concurrent evidence-bearing activation is not overwritten and repeated cron
  runs have no repeated side effects.

## C. Validation evidence

Recorded as reported by the implementation and audit agents — **tests were not
rerun after the commit or push**:

- Billing Jest suite (`npx jest src/modules/billing`, from `backend/`):
  9/9 suites, 183/183 tests passed, exit code 0 (run after the final edits,
  before the commit).
- Prettier check on the four files: passed (exit 0).
- Independent implementation audit: **PASS WITH FINDINGS**.
- Pre-commit audit: **READY FOR EXPLICIT COMMIT GO**.
- Post-commit audit: **PASS** (exact four files, correct parent/message, empty
  index, evidence and worktree preserved).
- Post-push remote SHA verification: **PASS**.

## D. Outstanding findings and boundaries

- **F-1:** intermittent Jest worker-exit warning ("worker failed to exit
  gracefully"); cause unresolved. Open diagnostic item — **not** a Phase 1
  implementation blocker. `--detectOpenHandles` was never run.
- **F-2 (accepted risk):** with strict downgrade-only expiry, a company whose
  payment evidence is still in flight but whose row is still `TRIAL` at the
  expiry tick is downgraded to FREE; recovery relies on the evidence-bearing
  activation paths (webhooks, manual authorization). Accepted as part of the
  owner's F2 decision.
- **F1** (CheckoutSession persistence / Prisma schema / checkout endpoint) is
  **outside** Phase 1.
- **F4** (paid-feature entitlement enforcement) is **outside** Phase 1.
- **No deployment** was performed or authorized.
- **No claim** of production verification, live Stripe verification, or
  production database testing.
- The pre-existing **uncommitted Billing R1/R2 changes** (webhook engine,
  subscription service, commercial specs, evidence file `billing-r1-r2.diff`)
  and all unrelated worktree changes were **deliberately excluded** from the
  Phase 1 commit and must be preserved.

## E. Future-session rule

> Billing Phase 1 (F2 + F3) is closed. Do not reimplement, re-audit, amend, or
> recommit this scope by default. Treat commit
> `0f32a0279961691ab28194c9a8021eb3a58105f9` as the authoritative completion
> point. Reopen Phase 1 only if new evidence demonstrates a defect or the owner
> explicitly requests a change. Continue remaining Billing R1/R2 work as a
> separate scope with its own audit and authorization gates.
