-- G15-02-B: Add isCancelled flag to PurchaseReturn for void capability
-- This allows COMPLETED returns to be reversed while preserving status history.

-- AlterTable
ALTER TABLE "PurchaseReturn" ADD COLUMN "isCancelled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PurchaseReturn_companyId_status_isCancelled_idx" ON "PurchaseReturn"("companyId", "status", "isCancelled");
