-- G15-07-C1: Provision the Retained Earnings system account (3200).
--
-- Why:
--   FiscalYearCloseService resolves a per-company retained earnings account by
--   code '3200' (or the FiscalYear.retainedEarningsAccountId override) and
--   posts the year-end closing journal into it. That account is seeded ONLY
--   when a company is registered (AuthService.seedChartOfAccounts) and there
--   was no backfill for companies created before the code existed. Every
--   company registered before this change therefore has no 3200 row, so
--   closing a fiscal year fails with "No retained earnings account found".
--
-- What this migration does (company-scoped, set-based, additive):
--   * Step 0 — pre-flight guard (Case 6, FAIL CLOSED): if any company has a
--     soft-deleted CUSTOM (isSystem = false) row on code 3200, abort with the
--     offending company ids. Such a row blocks provisioning (the unique
--     (companyId, code) constraint rejects an insert) and cannot be repaired
--     automatically without destroying a user's account. It must be resolved
--     manually first.
--   * Step 1 — restore soft-deleted SYSTEM 3200 rows (Case 3):
--     deletedAt = NULL, isActive = true. Without this a soft-deleted system
--     account is an operational dead end (invisible to the API while the
--     unique (companyId, code) constraint blocks recreating it).
--   * Step 2 — insert 3200 for every company with NO row for that code
--     (Case 1), using exactly the current seeder shape
--     (AuthService.seedChartOfAccounts).
--
-- Policy (G15-07-C1 decision):
--   * Live canonical system 3200 (Case 2) is a no-op.
--   * Inactive live 3200 (Case 4) is deliberately NOT auto-activated: an
--     admin can re-activate it through PATCH /finance/chart-of-accounts/:id.
--   * Live custom/non-system 3200 (Case 5) is NEVER modified or converted.
--   * Duplicate rows (Case 7) are impossible under the current unique
--     (companyId, code) constraint, so no duplicate-repair logic is added.
--   * Additive only: no DROP, no ALTER, no DELETE, no schema change.
--
-- Safety:
--   * Tenant-scoped: the INSERT is generated from "Company" itself and every
--     row carries its own companyId; no cross-tenant write is possible.
--   * Idempotent: the restore UPDATE is a no-op once restored, and the INSERT
--     uses WHERE NOT EXISTS against ANY row for that (companyId, code), so a
--     second run inserts nothing and the unique constraint can never be
--     violated.
--   * Fail-closed pre-flight guard: this is the first DO/RAISE block in the
--     repository's migrations; it aborts the migration transaction before any
--     write when a custom 3200 would block provisioning.

-- ── Step 0: pre-flight guard — soft-deleted CUSTOM 3200 (Case 6) ────────
DO $$
DECLARE
    offending_companies text;
BEGIN
    SELECT string_agg(DISTINCT ca."companyId"::text, ', ' ORDER BY ca."companyId"::text)
    INTO offending_companies
    FROM "ChartOfAccount" ca
    WHERE
        ca."code" = '3200'
        AND ca."isSystem" = false
        AND ca."deletedAt" IS NOT NULL;

    IF offending_companies IS NOT NULL THEN
        RAISE EXCEPTION
            'G15-07-C1: cannot provision retained earnings (3200). Soft-deleted custom (non-system) account(s) occupy code 3200 for company id(s): %. Resolve the conflicting account(s) manually, then re-run the migration.',
            offending_companies;
    END IF;
END
$$;

-- ── Step 1: restore soft-deleted SYSTEM 3200 (Case 3) ───────────────────
UPDATE "ChartOfAccount"
SET
    "deletedAt" = NULL,
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE
    "code" = '3200'
    AND "isSystem" = true
    AND "deletedAt" IS NOT NULL;

-- ── Step 2: create 3200 for companies that have no row at all (Case 1) ──
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
        (
            '3200',
            'Retained Earnings',
            'Accumulated profit and loss transferred at fiscal year close',
            'EQUITY'::"AccountType",
            'CREDIT'::"NormalBalance",
            12
        )
) AS seed("code", "name", "description", "accountType", "normalBalance", "sortOrder")
WHERE
    NOT EXISTS (
        SELECT 1
        FROM "ChartOfAccount" ca
        WHERE
            ca."companyId" = c."id"
            AND ca."code" = seed."code"
    );
