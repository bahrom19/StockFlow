-- AlterTable: add optimistic-locking version column to CashShift
ALTER TABLE "CashShift" ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 0;

-- Dedupe: close all but the EARLIEST OPEN shift per (warehouse, cashier, company).
-- Required because the pre-fix code could create duplicate OPEN shifts; the
-- unique index below would otherwise fail on existing duplicates at deploy time.
UPDATE "CashShift" SET
  "status" = 'CLOSED',
  "closedAt" = COALESCE("closedAt", now()),
  "rowVersion" = "rowVersion" + 1
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "warehouseId", "cashierId", "companyId"
        ORDER BY "openedAt" ASC, "createdAt" ASC
      ) AS rn
    FROM "CashShift"
    WHERE "status" = 'OPEN'
  ) ranked
  WHERE ranked.rn > 1
);

-- Partial unique index (raw SQL — Prisma schema DSL cannot express partial indexes).
-- Guarantees at the DB level that at most ONE OPEN shift can exist per
-- (warehouseId, cashierId, companyId). A concurrent second openShift insert
-- fails with P2002, which the service maps to HTTP 409 Conflict instead of 500.
--
-- NOTE: because Prisma cannot represent partial indexes in schema.prisma, do
-- NOT run `prisma migrate dev` against a database that already has this index
-- applied (Prisma would flag it as drift and propose dropping it). Use
-- `prisma migrate deploy` / `prisma migrate status` instead (production flow).
CREATE UNIQUE INDEX "CashShift_open_shift_unique"
  ON "CashShift"("warehouseId", "cashierId", "companyId")
  WHERE "status" = 'OPEN';
