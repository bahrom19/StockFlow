-- G16-N-3 P2-B-3: JournalEntry durable business-operation identity.
--
-- Adds a nullable clientOperationId column plus a composite unique
-- (companyId, clientOperationId) so a retried keyed cash operation
-- (cash-in/cash-out) collides deterministically instead of executing a
-- second time — permanently, independent of the 24h IdempotencyRecord TTL.
--
-- Safety properties (no backfill, no data rewrite):
--   1. ADD COLUMN is nullable with no default: metadata-only, all existing
--      rows become NULL, and PostgreSQL treats NULLs as distinct so legacy
--      rows and all non-participating JournalEntry writers can never collide
--      with each other or with marked operations.
--   2. Uniqueness is company-scoped: the same operation id in two different
--      companies never collides (tenant isolation preserved).
--   3. Only keyed cash operations write this column (via glEngine.post);
--      every other JournalEntry writer leaves it NULL and is unaffected.
--
-- NOTE (ops runbook): both statements run inside the Prisma migration
-- transaction. For a very large production JournalEntry table, build the
-- unique index via `CREATE UNIQUE INDEX CONCURRENTLY` from a psql session
-- BEFORE running this migration and drop the redundant plain index manually
-- — CONCURRENTLY cannot run inside a transaction block. (Same convention as
-- 20260927120000_g16c_sale_number_tenant_scoped and
-- 20261002115217_inventory_operation_identity.)

-- 1. Nullable operation-identity column; existing rows stay NULL.
ALTER TABLE "JournalEntry" ADD COLUMN "clientOperationId" VARCHAR(255);

-- 2. Composite durable-identity unique (company-scoped).
CREATE UNIQUE INDEX "JournalEntry_companyId_clientOperationId_key" ON "JournalEntry"("companyId", "clientOperationId");
