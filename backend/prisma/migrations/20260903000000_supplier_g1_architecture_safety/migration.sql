-- G1: Supplier Architecture Safety
-- 
-- 1. Change FK constraints from CASCADE to RESTRICT for historical documents
--    (PurchaseOrder, PurchaseReturn, PurchaseInvoice, SupplierQuotation)
--    This prevents accidental hard-delete of Supplier from destroying purchase history.
--    Contacts and Addresses keep CASCADE (own data, safe to cascade).
--
-- 2. Add partial unique index for BIN within company (active suppliers only).

-- Step 1: Drop existing CASCADE FKs and recreate as RESTRICT

-- PurchaseOrder.supplierId → Supplier
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_supplierId_fkey";
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" 
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT;

-- PurchaseReturn.supplierId → Supplier
ALTER TABLE "PurchaseReturn" DROP CONSTRAINT "PurchaseReturn_supplierId_fkey";
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_supplierId_fkey" 
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT;

-- PurchaseInvoice.supplierId → Supplier
ALTER TABLE "PurchaseInvoice" DROP CONSTRAINT "PurchaseInvoice_supplierId_fkey";
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_supplierId_fkey" 
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT;

-- SupplierQuotation.supplierId → Supplier
ALTER TABLE "SupplierQuotation" DROP CONSTRAINT "SupplierQuotation_supplierId_fkey";
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_supplierId_fkey" 
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT;

-- Step 2: BIN uniqueness — partial unique index for active suppliers
CREATE UNIQUE INDEX "supplier_company_bin_unique"
ON "Supplier"("companyId", "bin")
WHERE "deletedAt" IS NULL AND "bin" IS NOT NULL AND "bin" != '';
