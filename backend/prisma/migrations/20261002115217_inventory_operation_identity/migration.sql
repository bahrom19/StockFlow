-- G16-N-3 P2-B-2: StockMovement durable business-operation identity.
--
-- Adds a nullable clientOperationId column plus a composite unique
-- (companyId, clientOperationId, type) so a retried inventory operation
-- (adjustStock, transferStock) collides deterministically instead of
-- executing a second time — permanently, independent of the 24h
-- IdempotencyRecord TTL.
--
-- Safety properties (no backfill, no data rewrite):
--   1. ADD COLUMN is nullable with no default: metadata-only, all existing
--      rows become NULL, and PostgreSQL treats NULLs as distinct so legacy
--      rows can never collide with each other or with marked operations.
--   2. The composite unique includes movement `type` so the two legs of one
--      transfer (TRANSFER_OUT + TRANSFER_IN) carrying the SAME operation id
--      coexist, while a second attempt of either leg collides.
--   3. Uniqueness is company-scoped: the same operation id in two different
--      companies never collides (tenant isolation preserved).
--
-- NOTE (ops runbook): both statements run inside the Prisma migration
-- transaction. For a very large production StockMovement table, build the
-- unique index via `CREATE UNIQUE INDEX CONCURRENTLY` from a psql session
-- BEFORE running this migration and drop the redundant plain index manually
-- — CONCURRENTLY cannot run inside a transaction block. (Same convention as
-- 20260927120000_g16c_sale_number_tenant_scoped.)

-- 1. Nullable operation-identity column; existing rows stay NULL.
ALTER TABLE "StockMovement" ADD COLUMN "clientOperationId" VARCHAR(255);

-- 2. Composite durable-identity unique (company-scoped, type-discriminated).
CREATE UNIQUE INDEX "StockMovement_companyId_clientOperationId_type_key" ON "StockMovement"("companyId", "clientOperationId", "type");
