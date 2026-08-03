-- CreateTable
-- Atomic per-company document numbering. Replaces the racy `count + 1` and
-- `Date.now()` generators: `nextNumber()` consumes a value via a single
-- INSERT ... ON CONFLICT DO UPDATE, so two parallel requests always receive
-- distinct numbers (no P2002/400 from same-millisecond collisions).
CREATE TABLE "DocumentSequence" (
    "companyId" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("companyId","type")
);

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: seed per-company counters from existing documents so post-deploy
-- numbering continues without collisions (e.g. a company with 5 sales must
-- continue at 0006, not restart at 0001 → duplicate saleNumber → P2002).
-- Re-runnable: ON CONFLICT DO NOTHING.
INSERT INTO "DocumentSequence" ("companyId", "type", "lastNumber", "updatedAt")
SELECT "companyId", 'SALE', COUNT(*), NOW()
FROM "Sale" GROUP BY "companyId"
ON CONFLICT ("companyId", "type") DO NOTHING;

INSERT INTO "DocumentSequence" ("companyId", "type", "lastNumber", "updatedAt")
SELECT "companyId", 'PURCHASE_ORDER', COUNT(*), NOW()
FROM "PurchaseOrder" GROUP BY "companyId"
ON CONFLICT ("companyId", "type") DO NOTHING;

-- Journal entry numbers are unique per (company, financialPeriod). Seed each
-- period from the max entryNumber so postings continue without collisions.
INSERT INTO "DocumentSequence" ("companyId", "type", "lastNumber", "updatedAt")
SELECT "companyId", 'JE:' || "financialPeriodId", MAX("entryNumber"), NOW()
FROM "JournalEntry"
GROUP BY "companyId", "financialPeriodId"
ON CONFLICT ("companyId", "type") DO NOTHING;
