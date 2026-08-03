/**
 * Backfill: create the first OPEN FinancialPeriod (current month) for every
 * company that does not yet have one.
 *
 * Idempotent:
 *  - companies with an OPEN (or any) period for the current year/month are skipped;
 *  - re-running never creates duplicates (year/month unique per company);
 *  - existing data is never modified.
 *
 * Usage:
 *   cd backend && npm run backfill:financial-periods
 */
import { FinancialPeriodStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const name = `${year}-${String(month).padStart(2, '0')}`;

  const companies = await prisma.company.findMany({ select: { id: true } });
  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    const existing = await prisma.financialPeriod.findFirst({
      where: { companyId: company.id, year, month },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.financialPeriod.create({
      data: {
        companyId: company.id,
        name,
        year,
        month,
        startDate,
        endDate,
        status: FinancialPeriodStatus.OPEN,
        openedBy: null,
        notes: 'Backfilled: missing initial financial period',
      },
    });
    created += 1;
  }

  console.log(
    `Backfill complete: ${created} period(s) created, ${skipped} company(ies) already had a period (of ${companies.length} total).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
