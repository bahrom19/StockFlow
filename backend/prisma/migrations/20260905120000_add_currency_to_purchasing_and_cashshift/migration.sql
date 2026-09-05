-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'KZT';

-- AlterTable
ALTER TABLE "PurchaseReturn" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'KZT';

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'KZT';

-- AlterTable
ALTER TABLE "CashShift" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'KZT';
