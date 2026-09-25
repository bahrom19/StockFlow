-- G15-07-C3-A: Provision the cash-GL system accounts (6100/4200/6200/4210).
--
-- Why:
--   FinancialTransactionsService.post() resolves server-side counterpart
--   accounts for FEE (Dr 6100 Fee Expense) and INTEREST (Cr 4200 Interest
--   Income), and the Cash Shift → GL workstream (C3-B) requires the shortage /
--   overage pair (6200/4210). Those accounts are seeded ONLY when a company
--   is registered (AuthService.seedChartOfAccounts) and there was no backfill
--   for companies created before the codes existed. Every company registered
--   before this change therefore misses them, so posting fails closed with
--   "Chart of Accounts not configured".
--
-- What this migration does (company-scoped, set-based, additive):
--   * Step 0 — pre-flight guard (FAIL CLOSED): if any company has a row on
--     one of the four codes that is NOT a canonical system row (non-system,
--     or system with a different accountType/normalBalance), abort with the
--     offending company ids. Such a row blocks provisioning (the unique
--     (companyId, code) constraint rejects an insert) and cannot be repaired
--     automatically without destroying tenant data. It must be resolved
--     manually first.
--   * Step 1 — restore soft-deleted canonical SYSTEM rows (deletedAt = NULL,
--     isActive = true). Without this a soft-deleted system account is an
--     operational dead end (invisible to the API while the unique
--     (companyId, code) constraint blocks recreating it).
--   * Step 2 — insert the four accounts for every company with NO row for
--     that code, using exactly the current seeder shape
--     (AuthService.seedChartOfAccounts, sortOrder 13–16).
--
-- Policy (G15-07-C3-A decision):
--   * Live canonical system rows are a no-op (never modified or converted).
--   * Inactive live system rows are deliberately NOT auto-activated: an admin
--     can re-activate them through PATCH /finance/chart-of-accounts/:id.
--   * Additive only: no DROP, no DELETE of live data, no schema change.
--
-- Safety:
--   * Tenant-scoped: INSERT rows are generated from "Company" itself and every
--     row carries its own companyId; no cross-tenant write is possible.
--   * Idempotent: the restore UPDATE is a no-op once restored, and the INSERT
--     uses WHERE NOT EXISTS against ANY row for that (companyId, code), so a
--     second run inserts nothing and the unique constraint can never be
--     violated.
--   * Fail-closed pre-flight guard: aborts the migration transaction before
--     any write when a conflicting row would block provisioning.

-- ── Step 0: pre-flight guard — conflicting rows on the four codes ─────────
DO $$
DECLARE
    offending_companies text;
BEGIN
    SELECT string_agg(DISTINCT ca."companyId"::text, ', ' ORDER BY ca."companyId"::text)
    INTO offending_companies
    FROM "ChartOfAccount" ca
    JOIN (
        VALUES
            ('6100', 'EXPENSE'::"AccountType", 'DEBIT'::"NormalBalance"),
            ('4200', 'REVENUE'::"AccountType", 'CREDIT'::"NormalBalance"),
            ('6200', 'EXPENSE'::"AccountType", 'DEBIT'::"NormalBalance"),
            ('4210', 'REVENUE'::"AccountType", 'CREDIT'::"NormalBalance")
    ) AS seed("code", "accountType", "normalBalance")
        ON seed."code" = ca."code"
    WHERE
        ca."isSystem" = false
        OR ca."accountType" <> seed."accountType"
        OR ca."normalBalance" <> seed."normalBalance";

    IF offending_companies IS NOT NULL THEN
        RAISE EXCEPTION
            'G15-07-C3-A backfill blocked: ChartOfAccount code(s) 6100/4200/6200/4210 already exist with non-canonical semantics for companyIds: %. Resolve manually before re-running.',
            offending_companies;
    END IF;
END $$;

-- ── Step 1: restore soft-deleted canonical SYSTEM rows ────────────────────
UPDATE "ChartOfAccount"
SET "deletedAt" = NULL, "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE
    "code" IN ('6100', '4200', '6200', '4210')
    AND "isSystem" = true
    AND "deletedAt" IS NOT NULL;

-- ── Step 2: insert the four accounts where no row exists ──────────────────
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
            '6100',
            'Fee Expense',
            'Bank and cash transaction fees (G15-07-C3-A)',
            'EXPENSE'::"AccountType",
            'DEBIT'::"NormalBalance",
            13
        ),
        (
            '4200',
            'Interest Income',
            'Interest earned on cash and bank balances (G15-07-C3-A)',
            'REVENUE'::"AccountType",
            'CREDIT'::"NormalBalance",
            14
        ),
        (
            '6200',
            'Cash Shortage',
            'Cash drawer shortages on shift close (G15-07-C3-A)',
            'EXPENSE'::"AccountType",
            'DEBIT'::"NormalBalance",
            15
        ),
        (
            '4210',
            'Cash Overage Gain',
            'Cash drawer overages on shift close (G15-07-C3-A)',
            'REVENUE'::"AccountType",
            'CREDIT'::"NormalBalance",
            16
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
