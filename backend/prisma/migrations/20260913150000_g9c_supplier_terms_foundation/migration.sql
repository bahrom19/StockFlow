-- G9-C: Supplier terms & credit foundation.
-- Adds two nullable, data-only columns to Supplier:
--   defaultDueDays — default payment term (days) applied ONLY when creating
--     new PurchaseInvoice rows without an explicit dueDate.
--   creditLimit    — maximum outstanding AP exposure (no enforcement in G9-C).
-- Backward compatible: both columns are nullable, no default, no backfill;
-- existing Supplier rows are left untouched.
ALTER TABLE "Supplier" ADD COLUMN "defaultDueDays" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "creditLimit" DECIMAL(18,4);
