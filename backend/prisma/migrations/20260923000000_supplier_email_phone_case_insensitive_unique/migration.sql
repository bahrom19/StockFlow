-- G14-01-01: Supplier email/phone case-insensitive functional partial unique indexes
-- 
-- The G12-R5 migration (20260919120000) created partial unique indexes on
-- (companyId, email) and (companyId, phone) with WHERE deletedAt IS NULL.
-- However, these are CASE-SENSITIVE standard btree indexes.
-- 
-- The application uses mode: 'insensitive' (case-insensitive) for duplicate checks,
-- creating a TOCTOU vulnerability: concurrent requests can create suppliers
-- with emails differing only in case (e.g., "Email@test.com" vs "email@test.com").
-- 
-- This migration replaces the case-sensitive indexes with functional indexes
-- on LOWER(email) and LOWER(phone) to enforce true case-insensitive uniqueness
-- at the database level, matching application semantics exactly.
--
-- Also consolidates the two BIN indexes (supplier_company_bin_unique from G1
-- and Supplier_companyId_bin_active_unique from G12-R5) into one.

-- Step 1: Drop existing case-sensitive partial unique indexes
DROP INDEX IF EXISTS "Supplier_companyId_email_active_unique";
DROP INDEX IF EXISTS "Supplier_companyId_phone_active_unique";
DROP INDEX IF EXISTS "Supplier_companyId_bin_active_unique";

-- Step 2: Drop the older G1 BIN index (replaced by G12-R5 version, now being replaced again)
DROP INDEX IF EXISTS "supplier_company_bin_unique";

-- Step 3: Create case-insensitive functional partial unique indexes
-- Email: matches mode: 'insensitive' application semantics
CREATE UNIQUE INDEX "supplier_company_email_active_unique"
ON "Supplier" ("companyId", LOWER("email"))
WHERE "deletedAt" IS NULL AND "email" IS NOT NULL;

-- Phone: matches mode: 'insensitive' application semantics
CREATE UNIQUE INDEX "supplier_company_phone_active_unique"
ON "Supplier" ("companyId", LOWER("phone"))
WHERE "deletedAt" IS NULL AND "phone" IS NOT NULL;

-- BIN: consolidated index (matches G12-R5 predicate: only deletedAt IS NULL)
CREATE UNIQUE INDEX "supplier_company_bin_active_unique"
ON "Supplier" ("companyId", "bin")
WHERE "deletedAt" IS NULL AND "bin" IS NOT NULL AND "bin" <> '';