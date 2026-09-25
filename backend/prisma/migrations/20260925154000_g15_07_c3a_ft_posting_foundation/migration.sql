-- G15-07-C3-A: FinancialTransaction → canonical GL foundation (schema).
--
-- Adds the posting linkage and lifecycle columns consumed by
-- FinancialTransactionsService.post()/reverse():
--   * "postingStatus" (DRAFT → POSTED → REVERSED) is the freeze gate and the
--     CAS linearization point for concurrent post/reverse attempts.
--   * "journalEntryId" points at the single JournalEntry created by
--     GlEngineService.post(). NULL for operational-only (DRAFT) rows.
--   * "destinationBankAccountId" is the second bank leg for BANK_TRANSFER.
--     Source leg remains "bankAccountId". NULL for every other type.
--   * "idempotencyKey" stores the request key for traceability. Uniqueness is
--     owned by the IdempotencyRecord (companyId, idempotencyKey) table, which
--     already exists — no new unique constraint is added here.
--
-- Safety:
--   * Additive only: one new enum, four nullable-or-defaulted columns, three
--     indexes, two SET NULL foreign keys. No DROP, no data rewrite.
--   * Existing rows keep postingStatus = 'DRAFT' via the column default, so
--     every historical FinancialTransaction stays operational-only until an
--     explicit post transitions it.

-- CreateEnum
CREATE TYPE "FinancialTransactionPostingStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- AlterTable
ALTER TABLE "FinancialTransaction" ADD COLUMN "destinationBankAccountId" UUID,
ADD COLUMN "postingStatus" "FinancialTransactionPostingStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "journalEntryId" UUID,
ADD COLUMN "idempotencyKey" VARCHAR(100);

-- CreateIndex
CREATE INDEX "FinancialTransaction_destinationBankAccountId_idx" ON "FinancialTransaction"("destinationBankAccountId");
CREATE INDEX "FinancialTransaction_postingStatus_idx" ON "FinancialTransaction"("postingStatus");
CREATE INDEX "FinancialTransaction_journalEntryId_idx" ON "FinancialTransaction"("journalEntryId");
CREATE INDEX "FinancialTransaction_companyId_postingStatus_idx" ON "FinancialTransaction"("companyId", "postingStatus");

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_destinationBankAccountId_fkey" FOREIGN KEY ("destinationBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
