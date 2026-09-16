-- G11-A: Backfill of the mandatory purchasing system accounts.
--
-- Why:
--   PurchasingFinanceService resolves a per-operation set of system accounts
--   (1300 Inventory, 2100 Accounts Payable, 2110 GRNI, 5200 Purchase
--   Discounts & Write-Offs). Those accounts are seeded ONLY when a company is
--   registered (AuthService.seedChartOfAccounts) and there is no backfill for
--   companies created before a code was added to the seeder. In particular
--   2110 (GRNI) was introduced with G10-A (d184288), so a company registered
--   before that deploy has no 2110 row — which, before G11-A, made every goods
--   receipt and every invoice approval silently post no journal at all
--   (stock/AP moved, GL did not).
--
-- What this migration does:
--   1. Case F — restores soft-deleted SYSTEM accounts (isSystem = true) for the
--      four codes: deletedAt = NULL, isActive = true, updatedAt = now. Without
--      this a soft-deleted system account is an operational dead end: the API
--      filters deletedAt IS NULL (the row is invisible to GET/PATCH, so it can
--      never be reactivated) while @@unique([companyId, code]) prevents
--      recreating the same code. Only isSystem = true rows are touched.
--   2. Case A — creates the account for every company that has NO row at all
--      for that code, using exactly the current seeder shape
--      (AuthService.seedChartOfAccounts): accountType / normalBalance /
--      isActive = true / isSystem = true / level = 0 / sortOrder /
--      description.
--
-- Policy (G11-A decision D1):
--   * Existing live accounts are NEVER modified — not activated, not
--     deactivated, not renamed, not re-typed.
--   * Custom accounts (isSystem = false) that already occupy one of these
--     codes are NEVER modified and NEVER deleted; only system rows are
--     restored.
--   * Inactive live accounts are deliberately NOT auto-activated: the
--     operation now fails fast with an actionable error, and an admin can
--     re-activate the account through PATCH /finance/chart-of-accounts/:id.
--   * No historical journals are created or reconstructed — this migration
--     delivers future correctness only.
--
-- Safety:
--   * Tenant-scoped: every statement is driven by per-company rows and no
--     cross-tenant write is possible (each row carries its own companyId;
--     the INSERT is generated from "Company" itself).
--   * Idempotent and set-based (no loop, no runtime script): the UPDATE is a
--     no-op once restored, and the INSERT uses WHERE NOT EXISTS against ANY
--     row for that (companyId, code) — so the composite unique constraint
--     @@unique([companyId, code]) can never be violated and a second run
--     inserts nothing.
--   * Additive only: no DROP, no ALTER, no DELETE, no schema change.

-- ── Step 1: restore soft-deleted SYSTEM accounts (Case F) ────────────────
UPDATE "ChartOfAccount"
SET
    "deletedAt" = NULL,
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE
    "code" IN ('1300', '2100', '2110', '5200')
    AND "isSystem" = true
    AND "deletedAt" IS NOT NULL;

-- ── Step 2: create the account where no row exists at all (Case A) ───────
INSERT INTO "ChartOfAccount" (
    "id",
    "companyId",
    "code",
    "name",
    "description",
    "accountType",
    "normalBalance",
    "isActive",
    "isSystem",
    "level",
    "sortOrder",
    "rowVersion",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    c."id",
    seed."code",
    seed."name",
    seed."description",
    seed."accountType",
    seed."normalBalance",
    true,
    true,
    0,
    seed."sortOrder",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (
    VALUES
        ('1300', 'Inventory', 'Inventory on hand', 'ASSET'::"AccountType", 'DEBIT'::"NormalBalance", 4),
        ('2100', 'Accounts Payable', 'Payables to suppliers', 'LIABILITY'::"AccountType", 'CREDIT'::"NormalBalance", 5),
        ('2110', 'Goods Received Not Invoiced', 'Accrual for goods received but not yet invoiced (G10-A)', 'LIABILITY'::"AccountType", 'CREDIT'::"NormalBalance", 6),
        ('5200', 'Purchase Discounts and Write-Offs', 'Purchase discounts, inventory write-offs and adjustments', 'EXPENSE'::"AccountType", 'DEBIT'::"NormalBalance", 10)
) AS seed("code", "name", "description", "accountType", "normalBalance", "sortOrder")
WHERE
    NOT EXISTS (
        SELECT 1
        FROM "ChartOfAccount" ca
        WHERE
            ca."companyId" = c."id"
            AND ca."code" = seed."code"
    );
