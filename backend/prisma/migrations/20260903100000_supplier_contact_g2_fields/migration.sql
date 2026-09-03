-- G2: Supplier Contact fields
-- Add isPrimary, notes, rowVersion to match CustomerContact pattern.

ALTER TABLE "SupplierContact" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SupplierContact" ADD COLUMN "notes" TEXT;
ALTER TABLE "SupplierContact" ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 0;
