-- G11-E: Sales refund lifecycle foundation (Phase E1 — schema only).
--
-- Creates:
--   * enum "RefundStatus" (COMPLETED / CANCELLED)
--   * table "SalesRefund"       — persisted refund fact, company-scoped
--   * table "SalesRefundItem"   — canonical per-item refunded quantities
--   * SaleItem."fifoCost"       — persisted historical FIFO cost per sold item
--
-- Refund number uniqueness is TENANT-SCOPED, matching the G8 convention
-- (DocumentSequenceService numbers documents per (companyId, type); a global
-- unique constraint would allow deterministic cross-tenant collisions, e.g.
-- two companies both issuing "RFD-000001"). See migration
-- 20260912100000_g8_tenant_scoped_document_numbers.
--
-- No rows in SalesRefund / SalesRefundItem are created here (historical
-- refund reconstruction is explicitly forbidden by the G11-E design).
-- SaleItem."fifoCost" is backfilled deterministically at the bottom of this
-- file; the backfill is idempotent and never mixes FIFO and legacy bases
-- within one (sale, product) group.

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "fifoCost" DECIMAL(18,4);

-- CreateTable
CREATE TABLE "SalesRefund" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "refundNumber" VARCHAR(100) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'COMPLETED',
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'KZT',
    "reason" TEXT,
    "reference" VARCHAR(255),
    "createdBy" UUID NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SalesRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRefundItem" (
    "id" UUID NOT NULL,
    "salesRefundId" UUID NOT NULL,
    "saleItemId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "fifoCost" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesRefundItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesRefund_companyId_idx" ON "SalesRefund"("companyId");

-- CreateIndex
CREATE INDEX "SalesRefund_saleId_idx" ON "SalesRefund"("saleId");

-- CreateIndex
CREATE INDEX "SalesRefund_warehouseId_idx" ON "SalesRefund"("warehouseId");

-- CreateIndex
CREATE INDEX "SalesRefund_refundNumber_idx" ON "SalesRefund"("refundNumber");

-- CreateIndex
CREATE INDEX "SalesRefund_status_idx" ON "SalesRefund"("status");

-- CreateIndex
CREATE INDEX "SalesRefund_createdAt_idx" ON "SalesRefund"("createdAt");

-- CreateIndex
CREATE INDEX "SalesRefund_companyId_deletedAt_idx" ON "SalesRefund"("companyId", "deletedAt");

-- CreateIndex
CREATE INDEX "SalesRefund_companyId_status_idx" ON "SalesRefund"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesRefund_companyId_refundNumber_key" ON "SalesRefund"("companyId", "refundNumber");

-- CreateIndex
CREATE INDEX "SalesRefundItem_salesRefundId_idx" ON "SalesRefundItem"("salesRefundId");

-- CreateIndex
CREATE INDEX "SalesRefundItem_saleItemId_idx" ON "SalesRefundItem"("saleItemId");

-- CreateIndex
CREATE INDEX "SalesRefundItem_productId_idx" ON "SalesRefundItem"("productId");

-- CreateIndex
CREATE INDEX "SalesRefundItem_createdAt_idx" ON "SalesRefundItem"("createdAt");

-- AddForeignKey
ALTER TABLE "SalesRefund" ADD CONSTRAINT "SalesRefund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRefund" ADD CONSTRAINT "SalesRefund_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRefund" ADD CONSTRAINT "SalesRefund_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRefundItem" ADD CONSTRAINT "SalesRefundItem_salesRefundId_fkey" FOREIGN KEY ("salesRefundId") REFERENCES "SalesRefund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRefundItem" ADD CONSTRAINT "SalesRefundItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- G11-E: Deterministic historical SaleItem."fifoCost" backfill.
--
-- Why:
--   SalesRefundItem."fifoCost" (the persisted per-refunded-unit historical
--   FIFO cost, written by later phases) must equal the SaleItem's historical
--   FIFO cost. New sales will persist fifoCost at completion time (E3+);
--   historical SaleItems are backfilled here.
--
-- Algorithm (approved G11-E design):
--   Per (sale, product) group:
--     G = SUM(totalCost) of the sale's OUT CostLayers for that product
--         (direction='OUT', referenceType='SALE', referenceId=sale.id,
--         companyId matched).
--     If usable coverage exists (G is present AND totalQty > 0):
--         each SaleItem gets G × qty_i / totalQty rounded to 4 decimals,
--         and the LAST item of the group (highest SaleItem.id — stable)
--         absorbs the rounding remainder, so the group reconciles EXACTLY
--         to G:  Σ fifoCost = G.
--     If usable coverage is unavailable (no matching OUT layers, or
--     degenerate totalQty = 0):
--         fifoCost = SaleItem."costPrice" × SaleItem."quantity".
--   The FIFO/legacy decision is per (sale, product) group — the two bases
--   are never mixed within a group.
--
--   No historical SalesRefund records are invented or reconstructed.
--
-- Idempotency:
--   The computed value is a deterministic function of persisted data;
--   rows are only written where the stored value differs (IS DISTINCT FROM),
--   so re-running the migration backfill is a no-op.
-- ─────────────────────────────────────────────────────────────────────────

WITH "saleProductOut" AS (
  SELECT
    cl."referenceId"    AS "saleRef",
    cl."productId",
    SUM(cl."totalCost") AS "outTotalCost"
  FROM "CostLayer" cl
  JOIN "Sale" s
    ON s."id"::text   = cl."referenceId"
   AND s."companyId"  = cl."companyId"
  WHERE cl."direction" = 'OUT'
    AND cl."referenceType" = 'SALE'
  GROUP BY cl."referenceId", cl."productId"
),
"base" AS (
  SELECT
    si."id"        AS "saleItemId",
    si."saleId",
    si."productId",
    si."quantity"  AS "qty",
    si."costPrice" AS "costPrice",
    spo."outTotalCost",
    SUM(si."quantity") OVER (
      PARTITION BY si."saleId", si."productId"
    ) AS "totalQty",
    ROW_NUMBER() OVER (
      PARTITION BY si."saleId", si."productId"
      ORDER BY si."id" DESC
    ) AS "rnDesc"
  FROM "SaleItem" si
  LEFT JOIN "saleProductOut" spo
    ON spo."saleRef"    = si."saleId"::text
   AND spo."productId"  = si."productId"
),
"rounded" AS (
  SELECT
    b.*,
    CASE
      WHEN b."outTotalCost" IS NOT NULL AND b."totalQty" > 0
        THEN ROUND(b."outTotalCost" * b."qty" / b."totalQty", 4)
      ELSE NULL
    END AS "roundedAlloc"
  FROM "base" b
),
"final" AS (
  SELECT
    r."saleItemId",
    CASE
      WHEN r."roundedAlloc" IS NOT NULL THEN
        CASE
          -- Last item of the group absorbs the rounding remainder so the
          -- group reconciles exactly to the original OUT totalCost.
          WHEN r."rnDesc" = 1 THEN
            r."outTotalCost"
              - (SUM(r."roundedAlloc") OVER (
                   PARTITION BY r."saleId", r."productId"
                 ) - r."roundedAlloc")
          ELSE r."roundedAlloc"
        END
      ELSE r."costPrice" * r."qty"
    END AS "fifoCost"
  FROM "rounded" r
)
UPDATE "SaleItem" si
SET "fifoCost" = f."fifoCost"
FROM "final" f
WHERE si."id" = f."saleItemId"
  AND si."fifoCost" IS DISTINCT FROM f."fifoCost";
