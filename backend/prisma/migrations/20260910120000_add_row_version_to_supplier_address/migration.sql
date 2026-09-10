-- AlterTable: Add rowVersion column to SupplierAddress
ALTER TABLE "SupplierAddress" ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 0;
