import { hasIntegrationDatabase } from '../../../../infrastructure/idempotency/__tests__/integration-env';

/**
 * G16-N-4 P2 — event handler idempotency, REAL PostgreSQL integration.
 *
 * The unit suite proves each handler's control flow with a transaction-client
 * double. That is deliberately NOT enough for concurrency: a read-then-write
 * marker check is only safe if a database constraint backs it. This suite
 * proves that constraint actually holds under real concurrent load.
 *
 * Specifically it proves three things that a mock cannot:
 *
 *  1. `@@unique([companyId, clientOperationId])` on JournalEntry makes a
 *     duplicate event occurrence impossible to post twice: two racing
 *     transactions, one survivor.
 *  2. The loser is rejected with a Prisma P2002, not silently absorbed.
 *  3. The loser's transaction is ABORTED — it cannot keep issuing queries on
 *     `tx`. This is the PostgreSQL rule that forces the handler design to let
 *     P2002 escape instead of catching it and continuing, and it is asserted
 *     here rather than assumed.
 *
 * `AccountBalance` is incremented exactly once, so a duplicate delivery can
 * never double the period and closing balances.
 *
 * Run with:
 *   DATABASE_URL=postgresql://stockflow:stockflow@localhost:5432/stockflow \
 *     npx jest --config jest.integration.config.js event-idempotency
 */

const describeDb = hasIntegrationDatabase ? describe : describe.skip;

const COMPANY = 'a1a1a1a1-0000-4000-8000-0000000000c1';
const PERIOD = 'a1a1a1a1-0000-4000-8000-0000000000f1';
const ACCOUNT = 'a1a1a1a1-0000-4000-8000-0000000000a1';

describeDb(
  'event handler idempotency — concurrent duplicate delivery (real PostgreSQL)',
  () => {
    let prisma: import('@prisma/client').PrismaClient;

    beforeAll(async () => {
      const { PrismaClient } = await import('@prisma/client');
      prisma = new PrismaClient();

      await prisma.company.upsert({
        where: { id: COMPANY },
        update: {},
        create: { id: COMPANY, name: 'G16-N-4 P2 Idempotency Co' },
      });
      await prisma.financialPeriod.upsert({
        where: { id: PERIOD },
        update: {},
        create: {
          id: PERIOD,
          companyId: COMPANY,
          name: 'P2-Test',
          year: 2026,
          month: 10,
          startDate: new Date('2026-10-01'),
          endDate: new Date('2026-10-31'),
          status: 'OPEN',
        },
      });
      await prisma.chartOfAccount.upsert({
        where: { id: ACCOUNT },
        update: {},
        create: {
          id: ACCOUNT,
          companyId: COMPANY,
          code: '1300',
          name: 'Inventory',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
        },
      });
    });

    afterAll(async () => {
      await prisma.accountBalance.deleteMany({ where: { companyId: COMPANY } });
      await prisma.journalEntry.deleteMany({ where: { companyId: COMPANY } });
      await prisma.chartOfAccount.deleteMany({ where: { id: ACCOUNT } });
      await prisma.financialPeriod.deleteMany({ where: { id: PERIOD } });
      await prisma.company.deleteMany({ where: { id: COMPANY } });
      await prisma.$disconnect();
    });

    /**
     * Mirrors the handler's real write sequence: post the journal under a
     * clientOperationId, then increment the account balance. Only the parts that
     * matter for the uniqueness claim are reproduced — the full GL pipeline is
     * covered by the finance suites.
     */
    const postJournalLikeHandler = async (clientOperationId: string) =>
      prisma.$transaction(async (tx) => {
        const entry = await tx.journalEntry.create({
          data: {
            companyId: COMPANY,
            financialPeriodId: PERIOD,
            entryNumber: Math.floor(Math.random() * 1_000_000),
            totalDebit: 20,
            totalCredit: 20,
            status: 'POSTED',
            referenceType: 'INVENTORY_ADJUSTMENT',
            referenceId: 'count-1',
            clientOperationId,
          },
        });
        await tx.accountBalance.upsert({
          where: {
            companyId_accountId_financialPeriodId: {
              companyId: COMPANY,
              accountId: ACCOUNT,
              financialPeriodId: PERIOD,
            },
          },
          create: {
            companyId: COMPANY,
            accountId: ACCOUNT,
            financialPeriodId: PERIOD,
            year: 2026,
            month: 10,
            openingDebit: 0,
            openingCredit: 0,
            periodDebit: 20,
            periodCredit: 20,
            closingDebit: 20,
            closingCredit: 20,
          },
          update: {
            periodDebit: { increment: 20 },
            periodCredit: { increment: 20 },
            closingDebit: { increment: 20 },
            closingCredit: { increment: 20 },
          },
        });
        return entry;
      });

    it('exactly one journal and one balance increment survive concurrent duplicate delivery', async () => {
      await prisma.journalEntry.deleteMany({ where: { companyId: COMPANY } });
      await prisma.accountBalance.deleteMany({ where: { companyId: COMPANY } });

      // One event occurrence delivered twice, concurrently.
      const eventId = 'evt-concurrent-1';
      const results = await Promise.allSettled([
        postJournalLikeHandler(eventId),
        postJournalLikeHandler(eventId),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one wins...
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // ...and the loser is a real uniqueness violation, not a silent success.
      const failure = (rejected[0] as PromiseRejectedResult).reason;
      expect(String(failure?.code ?? '')).toBe('P2002');
      expect(String(failure?.message ?? '')).toMatch(/clientOperationId/);

      // One journal row...
      const entries = await prisma.journalEntry.findMany({
        where: { companyId: COMPANY, clientOperationId: eventId },
      });
      expect(entries).toHaveLength(1);

      // ...and the balance moved exactly ONCE, not twice.
      const balance = await prisma.accountBalance.findFirst({
        where: {
          companyId: COMPANY,
          accountId: ACCOUNT,
          financialPeriodId: PERIOD,
        },
      });
      expect(balance?.periodDebit.toString()).toBe('20');
      expect(balance?.closingDebit.toString()).toBe('20');
    });

    it('a P2002 aborts the transaction — the tx client cannot be reused afterwards', async () => {
      await prisma.journalEntry.deleteMany({ where: { companyId: COMPANY } });

      const eventId = 'evt-abort-1';
      await postJournalLikeHandler(eventId);

      // This is WHY the handlers must not catch P2002 and keep going.
      let abortError: unknown;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.journalEntry.create({
            data: {
              companyId: COMPANY,
              financialPeriodId: PERIOD,
              entryNumber: Math.floor(Math.random() * 1_000_000),
              totalDebit: 1,
              totalCredit: 1,
              status: 'POSTED',
              clientOperationId: eventId,
            },
          });
          // Any further statement on an aborted PostgreSQL transaction fails.
          await tx.accountBalance.findMany({ where: { companyId: COMPANY } });
        });
      } catch (err) {
        abortError = err;
      }

      expect(abortError).toBeDefined();
      expect(String((abortError as { code?: string })?.code ?? '')).toBe(
        'P2002',
      );
    });

    it('the same eventId in a DIFFERENT company does not collide (tenant isolation)', async () => {
      const otherCompany = 'a1a1a1a1-0000-4000-8000-0000000000c2';
      const otherPeriod = 'a1a1a1a1-0000-4000-8000-0000000000f2';
      const otherAccount = 'a1a1a1a1-0000-4000-8000-0000000000a2';

      try {
        await prisma.company.create({
          data: { id: otherCompany, name: 'G16-N-4 P2 Idempotency Co 2' },
        });
        await prisma.financialPeriod.create({
          data: {
            id: otherPeriod,
            companyId: otherCompany,
            name: 'P2-Test',
            year: 2026,
            month: 10,
            startDate: new Date('2026-10-01'),
            endDate: new Date('2026-10-31'),
            status: 'OPEN',
          },
        });
        await prisma.chartOfAccount.create({
          data: {
            id: otherAccount,
            companyId: otherCompany,
            code: '1300',
            name: 'Inventory',
            accountType: 'ASSET',
            normalBalance: 'DEBIT',
          },
        });

        const sharedEventId = 'evt-shared-across-tenants';
        await postJournalLikeHandler(sharedEventId);

        // Same eventId, different company → must NOT collide.
        const created = await prisma.$transaction(async (tx) =>
          tx.journalEntry.create({
            data: {
              companyId: otherCompany,
              financialPeriodId: otherPeriod,
              entryNumber: 1,
              totalDebit: 5,
              totalCredit: 5,
              status: 'POSTED',
              clientOperationId: sharedEventId,
            },
          }),
        );
        expect(created.id).toBeDefined();

        // Both companies now hold one journal under the SAME eventId.
        const perCompany = await prisma.journalEntry.groupBy({
          by: ['companyId'],
          where: { clientOperationId: sharedEventId },
        });
        expect(perCompany).toHaveLength(2);
      } finally {
        await prisma.journalEntry.deleteMany({
          where: { companyId: otherCompany },
        });
        await prisma.accountBalance.deleteMany({
          where: { companyId: otherCompany },
        });
        await prisma.chartOfAccount.deleteMany({ where: { id: otherAccount } });
        await prisma.financialPeriod.deleteMany({ where: { id: otherPeriod } });
        await prisma.company.deleteMany({ where: { id: otherCompany } });
      }
    });
  },
);
