-- G11-F2 — Customer Credit Ledger (additive-only).
-- Insert-only ledger facts for spendable customer credit (STORE_CREDIT /
-- GIFT_CARD). GL account 1200 semantics are NOT changed by this migration;
-- the ledger is subledger detail, the GL remains the control account.

-- CreateEnum
CREATE TYPE "CustomerCreditTransactionDirection" AS ENUM ('ISSUED', 'SPENT', 'ADJUSTED');

-- CreateTable
CREATE TABLE "CustomerCreditTransaction" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "direction" "CustomerCreditTransactionDirection" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "referenceType" VARCHAR(50) NOT NULL,
    "referenceId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "reason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateFK
ALTER TABLE "CustomerCreditTransaction" ADD CONSTRAINT "CustomerCreditTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateFK
ALTER TABLE "CustomerCreditTransaction" ADD CONSTRAINT "CustomerCreditTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CustomerCreditTransaction_companyId_idx" ON "CustomerCreditTransaction"("companyId");

-- CreateIndex
CREATE INDEX "CustomerCreditTransaction_customerId_idx" ON "CustomerCreditTransaction"("customerId");

-- CreateIndex
CREATE INDEX "CustomerCreditTransaction_companyId_deletedAt_idx" ON "CustomerCreditTransaction"("companyId", "deletedAt");

-- CreateIndex
CREATE INDEX "CustomerCreditTransaction_customerId_currency_idx" ON "CustomerCreditTransaction"("customerId", "currency");

-- CreateUniqueIndex — narrow idempotency guard for ledger facts (G11-F2 §N):
-- one ISSUED per refund allocation, one aggregated SPENT per sale, one row per
-- manual adjustment (self-referencing id).
CREATE UNIQUE INDEX "CustomerCreditTransaction_companyId_customerId_direction_referenceType_referenceId_currency_key" ON "CustomerCreditTransaction"("companyId", "customerId", "direction", "referenceType", "referenceId", "currency");
