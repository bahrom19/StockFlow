-- G9-A: AP Payment Allocation Foundation
-- This migration:
-- 1. Makes SupplierPayment.purchaseInvoiceId nullable (for unallocated payments)
-- 2. Creates SupplierPaymentAllocation model (for allocation tracking)
-- 3. Backfills existing payments with invoice → exactly one allocation each

-- Step 1: Drop the existing NOT NULL constraint on purchaseInvoiceId
-- We need to drop the foreign key first, then alter the column, then re-add the FK
ALTER TABLE "SupplierPayment" DROP CONSTRAINT "SupplierPayment_purchaseInvoiceId_fkey";

-- Step 2: Make purchaseInvoiceId nullable
ALTER TABLE "SupplierPayment" ALTER COLUMN "purchaseInvoiceId" DROP NOT NULL;

-- Step 3: Re-add the foreign key (now nullable)
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_purchaseInvoiceId_fkey" 
  FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE Restrict ON UPDATE CASCADE;

-- Step 4: Create SupplierPaymentAllocation table
CREATE TABLE "SupplierPaymentAllocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "purchaseInvoiceId" UUID,
    "amount" DECIMAL(18,4) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- Step 5: Add foreign keys
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_companyId_fkey" 
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_supplierId_fkey" 
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE Restrict ON UPDATE CASCADE;

ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_paymentId_fkey" 
  FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE Restrict ON UPDATE CASCADE;

ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_purchaseInvoiceId_fkey" 
  FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE Restrict ON UPDATE CASCADE;

-- Step 6: Add indexes
CREATE INDEX "SupplierPaymentAllocation_companyId_idx" ON "SupplierPaymentAllocation"("companyId");
CREATE INDEX "SupplierPaymentAllocation_supplierId_idx" ON "SupplierPaymentAllocation"("supplierId");
CREATE INDEX "SupplierPaymentAllocation_paymentId_idx" ON "SupplierPaymentAllocation"("paymentId");
CREATE INDEX "SupplierPaymentAllocation_purchaseInvoiceId_idx" ON "SupplierPaymentAllocation"("purchaseInvoiceId");
CREATE INDEX "SupplierPaymentAllocation_companyId_deletedAt_idx" ON "SupplierPaymentAllocation"("companyId", "deletedAt");

-- Step 7: Legacy backfill
-- For every existing SupplierPayment that has a purchaseInvoiceId (NOT NULL),
-- create exactly one SupplierPaymentAllocation record.
-- This is idempotent: if allocations already exist, the INSERT will fail
-- due to duplicate key (we handle this with ON CONFLICT DO NOTHING).
-- Deterministic: uses the payment's amount, company, supplier, and invoice.
INSERT INTO "SupplierPaymentAllocation" (
    "id",
    "companyId",
    "supplierId",
    "paymentId",
    "purchaseInvoiceId",
    "amount",
    "rowVersion",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    sp."companyId",
    sp."supplierId",
    sp."id" AS "paymentId",
    sp."purchaseInvoiceId",
    sp."amount",
    0,
    sp."createdAt",
    sp."updatedAt"
FROM "SupplierPayment" sp
WHERE sp."purchaseInvoiceId" IS NOT NULL
  AND sp."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "SupplierPaymentAllocation" spa
    WHERE spa."paymentId" = sp."id"
      AND spa."deletedAt" IS NULL
  );
