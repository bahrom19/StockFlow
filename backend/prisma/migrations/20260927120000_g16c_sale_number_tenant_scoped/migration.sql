-- G16-C-04: Sale.saleNumber tenant-scoped uniqueness (G8 pattern).
--
-- Replaces the legacy GLOBAL unique index on saleNumber with a composite
-- (companyId, saleNumber) unique so two different companies can hold the same
-- document number, while duplicates WITHIN one company remain rejected.
--
-- Pre-flight data checks (executed against the production database before
-- this migration; results recorded in the G16-C IMPLEMENTATION REPORT):
--   1. cross-tenant duplicates  (same saleNumber, different companies): 0 rows
--      -> nothing to legalize, migration is additive;
--   2. intra-tenant duplicates  (same companyId + saleNumber):          0 rows
--      -> the composite unique cannot fail on existing data.
--
-- Order matches the approved design: create composite FIRST, then drop the
-- global unique, so uniqueness is never weaker than before at any instant.
-- Soft-deleted rows keep participating in uniqueness (full parity with the
-- old single-column unique — no partial WHERE clause).
--
-- NOTE (ops runbook): this statement runs inside the Prisma migration
-- transaction. For a very large production Sale table, apply the composite
-- index via `CREATE UNIQUE INDEX CONCURRENTLY` from a psql session BEFORE
-- running this migration and drop the redundant plain index manually —
-- CONCURRENTLY cannot run inside a transaction block.

-- 1. Tenant-scoped unique replaces the plain (companyId, saleNumber) index.
CREATE UNIQUE INDEX "Sale_companyId_saleNumber_key" ON "Sale"("companyId", "saleNumber");

-- 2. The plain composite index is now redundant (the unique index serves it).
DROP INDEX "Sale_companyId_saleNumber_idx";

-- 3. Remove the global unique: cross-company collisions are legal from now on.
DROP INDEX "Sale_saleNumber_key";
