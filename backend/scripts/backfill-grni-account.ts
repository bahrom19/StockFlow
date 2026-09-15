/**
 * Backfill: create the GRNI (Goods Received Not Invoiced, code 2110) system
 * Chart of Accounts entry for every company that does not yet have it.
 *
 * G10-A prerequisite: the purchasing GL flow now credits GRNI 2110 on goods
 * receipts and debits it on purchase-invoice approval. Companies created
 * before G10-A lack the account, and the account resolution in
 * PurchasingFinanceService gracefully skips journal posting when an account
 * is missing — so this backfill MUST run before the G10-A code deploy:
 *
 *   backfill 2110 → verify all companies have 2110 → deploy code
 *
 * Idempotent:
 *  - companies already having a (non-deleted) account with code 2110 are skipped;
 *  - re-running never creates duplicates;
 *  - existing accounts are never modified.
 *
 * Usage:
 *   cd backend && npx ts-node scripts/backfill-grni-account.ts
 */
import { PrismaClient, AccountType, NormalBalance } from '@prisma/client';

const prisma = new PrismaClient();

const GRNI_CODE = '2110';
const GRNI_NAME = 'Goods Received Not Invoiced';
const GRNI_DESCRIPTION = 'Accrual for goods received but not yet invoiced (G10-A)';
const GRNI_SORT_ORDER = 6;

async function main(): Promise<void> {
  const companies = await prisma.company.findMany({ select: { id: true } });
  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    const existing = await prisma.chartOfAccount.findFirst({
      where: {
        companyId: company.id,
        code: GRNI_CODE,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.chartOfAccount.create({
      data: {
        companyId: company.id,
        code: GRNI_CODE,
        name: GRNI_NAME,
        description: GRNI_DESCRIPTION,
        accountType: AccountType.LIABILITY,
        normalBalance: NormalBalance.CREDIT,
        isActive: true,
        isSystem: true,
        level: 0,
        sortOrder: GRNI_SORT_ORDER,
      },
    });
    created += 1;
  }

  console.log(
    `Backfill complete: ${created} GRNI account(s) created, ${skipped} company(ies) already had ${GRNI_CODE} (of ${companies.length} total).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
