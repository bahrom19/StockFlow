-- G16-N-4 P0-A: bootstrap the required global SubscriptionPlan with code "free".
--
-- Why:
--   SubscriptionPlan is a GLOBAL catalog: it has no companyId and is shared by
--   every tenant. Two flows hard-depend on the row with code = 'free':
--     * CompanySubscriptionService.downgradeToFree() (line ~376) does
--       `planRepository.findByCode('free')` and throws "Free plan not found"
--       otherwise. It is invoked by BillingCronService for every expired TRIAL
--       subscription.
--     * CompanySubscriptionController.changePlan(planCode) resolves a plan code
--       from the published catalog.
--
--   There is NO prisma seed in this repository (package.json declares no
--   prisma.seed) and SubscriptionPlanRepository.upsertByCode() has no
--   production caller, so before this migration a fresh database had an EMPTY
--   plan catalog and 'free' existed only if a tenant administrator happened to
--   create it through POST /billing/plans — the very endpoint this workstream
--   just closed to tenants.
--
--   G16-N-4 P0-A makes plan writes platform-only, so the catalog can no longer
--   be bootstrapped by a tenant. This migration restores that capability at the
--   database level, which is also what breaks the circular dependency:
--     platform operator required -> platform permission required
--     -> permission created by platform operator -> operator cannot authenticate
--   Platform authority is an environment allowlist, not a Permission row, and
--   this bootstrap needs neither an operator nor a permission nor a running
--   application. It is therefore safe on a fresh database and cannot be
--   influenced by any tenant.
--
-- What this migration does (additive, idempotent):
--   * Step 0 — restore a soft-deleted 'free' row (deletedAt = NULL only).
--   * Step 1 — INSERT the 'free' row ON CONFLICT ("code") DO NOTHING.
--
-- Values: taken verbatim from the current model defaults
-- (SubscriptionPlan in schema.prisma / CREATE TABLE in
-- 20260729014253_add_billing_tables). Prices stay at the schema default 0 and
-- currency at the schema default 'USD' — no business pricing is invented, and
-- every quota (trialDays 0, maxUsers 1, maxWarehouses 1, maxProducts 50) is
-- the model's own default, not a chosen value.
--
-- Safety:
--   * Idempotent: ON CONFLICT DO NOTHING on the "SubscriptionPlan_code_key"
--     unique index, so a second run inserts nothing and can never create a
--     duplicate or raise a unique violation. Matches the project convention of
--     20260925155000_g15_07_c3a_cash_gl_accounts_backfill.
--   * Migration-controlled: runs once per database inside the Prisma migration
--     transaction. No application startup dependency, therefore no
--     multi-replica boot race (unlike extending the OnModuleInit seed).
--   * Step 0 is required, not cosmetic: the pre-fix vulnerable DELETE endpoint
--     could soft-delete the 'free' row. SubscriptionPlanRepository.findByCode
--     filters `deletedAt: null`, so without the restore the INSERT would be a
--     permanent no-op against the unique code index and downgradeToFree would
--     stay broken. Same dead-end the G15-07-C3-A backfill had to handle.
--   * Non-destructive to live data: Step 0 only clears deletedAt. It never
--     touches priceMonthly/priceYearly/currency/quota columns and never
--     changes isActive, so a deliberately deactivated or re-priced 'free' row
--     keeps those operator decisions. The INSERT cannot fire in that case at
--     all, because the code already exists.

-- ── Step 0: restore a soft-deleted canonical 'free' row ──────────────────
-- Only deletedAt is cleared. Pricing, currency, quotas and isActive are left
-- exactly as an operator configured them.
UPDATE "SubscriptionPlan"
SET "deletedAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'free'
  AND "deletedAt" IS NOT NULL;

-- ── Step 1: insert the 'free' plan where no row exists for that code ─────
INSERT INTO "SubscriptionPlan" (
    "id",
    "code",
    "name",
    "description",
    "priceMonthly",
    "priceYearly",
    "currency",
    "trialDays",
    "maxUsers",
    "maxWarehouses",
    "maxProducts",
    "featureFlags",
    "isActive",
    "sortOrder",
    "rowVersion",
    "createdAt",
    "updatedAt"
)
VALUES (
    gen_random_uuid(),
    'free',
    'Free',
    'Default free plan required by trial downgrade and plan changes (G16-N-4 P0-A bootstrap)',
    0,
    0,
    'USD'::"Currency",
    0,
    1,
    1,
    50,
    '{}'::JSONB,
    true,
    0,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
