/**
 * G16-N-7 — Fiscal-year close correctness (integration, REAL PostgreSQL).
 *
 * Everything under test is REAL: the Prisma client, `FiscalYearCloseService`,
 * `GlEngineService`, `PostingValidationService`, `JournalEntriesRepository`,
 * `FinancialPeriodsRepository` and `AuditLogService`. Only the EventBus is
 * stubbed (it is a pure side-effect fan-out and is already wrapped in the
 * engine's try/catch).
 *
 * Why a real database is required here: the three defects were
 *  D1 — `accountBalance` read with no `financialPeriodId` scope;
 *  D2 — `abs()` destroying the debit/credit direction;
 *  D3 — retained earnings summed over ALL rows while the closing lines read
 *       ONE row via `balances.find(...)`.
 * None of them is observable against a hand-written mock that returns one row
 * per account. This fixture therefore seeds MULTIPLE periods per account plus
 * a large prior-year period — exactly the shape the old unit mocks could not
 * express.
 *
 * The fixture is deliberately reversal-free: REVERSED handling in the GL-backed
 * statements is a separate, still-open finding and is out of G16-N-7 scope.
 *
 * Conventions follow `audit-log-transaction.integration.spec.ts`:
 *  - `integration-env` is imported FIRST so `DATABASE_URL` is snapshotted
 *    before `@prisma/client` loads `.env`;
 *  - `@prisma/client` is imported LAZILY inside `beforeAll`;
 *  - the whole suite skips when no database is configured.
 */
import {
  hasIntegrationDatabase,
  integrationDatabaseUrl,
} from '../../../infrastructure/idempotency/__tests__/integration-env';

import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { EventBus } from '../../../common/events/event-bus.interface';
import { Decimal } from '@prisma/client/runtime/library';
import { FiscalYearCloseService } from '../services/fiscal-year-close.service';
import { GlEngineService } from '../services/gl-engine.service';
import { PostingValidationService } from '../services/posting-validation.service';
import { JournalEntriesRepository } from '../repositories/journal-entries.repository';
import { FinancialPeriodsRepository } from '../repositories/financial-periods.repository';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';
import { AuditLogService } from '../../shared/services/audit-log.service';

const databaseUrl = integrationDatabaseUrl;
const describeDb = hasIntegrationDatabase ? describe : describe.skip;

const RUN = `g16n7-${process.pid}-${Date.now()}`;
const ACTOR_SUFFIX = '@g16-n-7.invalid';
const YEAR = 2026;

/** Prior-year figures that must NEVER influence the 2026 close. */
const PRIOR = { revCredit: 999999, expDebit: 888888 };

/** True FY2026 profit under the signed rule: (16000-0) + (500-12000) = 4500. */
const EXPECTED_PROFIT = new Decimal('4500');

interface Tenant {
  companyId: string;
  actorId: string;
  fiscalYearId: string;
  priorPeriodId: string;
  fyPeriodIds: string[];
  accountId: { rev: string; exp: string; re: string };
}

describeDb(
  'FiscalYearCloseService closeFiscalYear (integration — real PostgreSQL)',
  () => {
    let prisma: PrismaClient;
    let service: FiscalYearCloseService;
    let committed: Tenant;
    let rollback: Tenant;

    const tenantIds: string[] = [];
    const actorIds: string[] = [];

    const build = (glEngine: GlEngineService) =>
      new FiscalYearCloseService(
        prisma as unknown as PrismaService,
        glEngine,
        new AuditLogService(prisma as unknown as PrismaService),
        new FinancialPeriodsRepository(prisma as unknown as PrismaService),
      );

    const seedChart = (
      companyId: string,
      code: string,
      type: string,
      normal: string,
    ) =>
      prisma.chartOfAccount.create({
        data: {
          companyId,
          code,
          name: `${RUN}-${code}`,
          accountType: type as never,
          normalBalance: normal as never,
          isActive: true,
        },
        select: { id: true },
      });

    const seedPeriod = (companyId: string, year: number, month: number) =>
      prisma.financialPeriod.create({
        data: {
          companyId,
          name: `${RUN}-${year}-${month}`,
          year,
          month,
          startDate: new Date(Date.UTC(year, month - 1, 1)),
          endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
          status: 'OPEN',
        },
        select: { id: true },
      });

    const balance = (
      companyId: string,
      id: string,
      periodId: string,
      year: number,
      month: number,
      debit: string,
      credit: string,
    ) =>
      prisma.accountBalance.create({
        data: {
          companyId,
          accountId: id,
          financialPeriodId: periodId,
          year,
          month,
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(0),
          periodDebit: new Decimal(debit),
          periodCredit: new Decimal(credit),
          closingDebit: new Decimal(debit),
          closingCredit: new Decimal(credit),
        },
      });

    const createTenant = async (tag: string): Promise<Tenant> => {
      const company = await prisma.company.create({
        data: { name: `${RUN}-${tag}-tenant` },
        select: { id: true },
      });
      const companyId = company.id;
      tenantIds.push(companyId);

      const user = await prisma.user.create({
        data: {
          email: `${RUN}-${tag}${ACTOR_SUFFIX}`,
          passwordHash: 'g16-n-7-not-a-real-hash',
        },
        select: { id: true },
      });
      const actorId = user.id;
      actorIds.push(actorId);
      await prisma.companyMember.create({
        data: { companyId, userId: actorId },
      });

      const rev = (await seedChart(companyId, '4000', 'REVENUE', 'CREDIT')).id;
      const exp = (await seedChart(companyId, '5000', 'EXPENSE', 'DEBIT')).id;
      const re = (await seedChart(companyId, '3200', 'EQUITY', 'CREDIT')).id;

      const fy = await prisma.fiscalYear.create({
        data: {
          companyId,
          year: YEAR,
          name: `${RUN}-${tag}-${YEAR}`,
          startDate: new Date(Date.UTC(YEAR, 0, 1)),
          endDate: new Date(Date.UTC(YEAR, 11, 31, 23, 59, 59, 999)),
        },
        select: { id: true },
      });

      // Prior-year period + balances that the period scope MUST exclude.
      const priorPeriodId = (await seedPeriod(companyId, YEAR - 1, 12)).id;
      await balance(
        companyId,
        rev,
        priorPeriodId,
        YEAR - 1,
        12,
        '0',
        String(PRIOR.revCredit),
      );
      await balance(
        companyId,
        exp,
        priorPeriodId,
        YEAR - 1,
        12,
        String(PRIOR.expDebit),
        '0',
      );

      // Three FY2026 periods — the multi-period shape that broke D1 and D3.
      const monthSplits = [
        { revC: 10000, expD: 6000, expC: 0 },
        { revC: 5000, expD: 4000, expC: 0 },
        { revC: 1000, expD: 2000, expC: 500 },
      ];
      const fyPeriodIds: string[] = [];
      for (const [i, s] of monthSplits.entries()) {
        const month = i + 1;
        const periodId = (await seedPeriod(companyId, YEAR, month)).id;
        fyPeriodIds.push(periodId);
        await balance(
          companyId,
          rev,
          periodId,
          YEAR,
          month,
          '0',
          String(s.revC),
        );
        await balance(
          companyId,
          exp,
          periodId,
          YEAR,
          month,
          String(s.expD),
          String(s.expC),
        );
      }

      return {
        companyId,
        actorId,
        fiscalYearId: fy.id,
        priorPeriodId,
        fyPeriodIds,
        accountId: { rev, exp, re },
      };
    };

    const closingEntry = (companyId: string) =>
      prisma.journalEntry.findFirst({
        where: { companyId, referenceType: 'FISCAL_YEAR_CLOSE' },
        include: { lines: true },
      });

    const closeAudit = (t: Tenant) =>
      prisma.auditLog.findFirst({
        where: {
          companyId: t.companyId,
          entity: 'FiscalYear',
          entityId: t.fiscalYearId,
          action: 'CLOSE',
        },
      });

    beforeAll(async () => {
      const { PrismaClient: Ctor } = await import('@prisma/client');
      prisma = new Ctor({ datasources: { db: { url: databaseUrl } } });
      await prisma.$connect();

      const prismaService = prisma as unknown as PrismaService;
      const auditLog = new AuditLogService(prismaService);
      const validation = new PostingValidationService();
      const docSeq = new DocumentSequenceService(prismaService);
      const journalRepo = new JournalEntriesRepository(prismaService, docSeq);
      const eventBus = {
        publish: async () => undefined,
      } as unknown as EventBus;
      const glEngine = new GlEngineService(
        journalRepo,
        validation,
        prismaService,
        auditLog,
        eventBus,
      );
      service = build(glEngine);

      committed = await createTenant('commit');
      rollback = await createTenant('rollback');
    });

    afterAll(async () => {
      if (!prisma) return;
      // JournalEntry -> JournalLine must be removed first: JournalLine.accountId
      // has no ON DELETE CASCADE, so it would otherwise block the Company delete.
      await prisma.journalEntry.deleteMany({
        where: { companyId: { in: tenantIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { companyId: { in: tenantIds } },
      });
      await prisma.company.deleteMany({ where: { name: { startsWith: RUN } } });
      await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
      await prisma.$disconnect();
    });

    it('closes a multi-period fiscal year: balanced journal, correct retained earnings, prior year excluded', async () => {
      const t = committed;
      const result = await service.closeFiscalYear(
        t.companyId,
        YEAR,
        t.actorId,
      );

      // 1. close succeeds
      expect(result.fiscalYearId).toBe(t.fiscalYearId);
      expect(result.retainedEarningsEntryId).toBeTruthy();

      // 2. the closing journal exists and is POSTED
      const entry = await closingEntry(t.companyId);
      expect(entry).not.toBeNull();
      expect(entry!.referenceId).toBe(t.fiscalYearId);
      expect(entry!.status).toBe('POSTED');

      // 9. exactly the expected lines: revenue, expense, retained earnings
      expect(entry!.lines).toHaveLength(3);

      // 3. balanced
      const dr = entry!.lines.reduce(
        (a, l) => a.add(new Decimal(l.debit.toString())),
        new Decimal(0),
      );
      const cr = entry!.lines.reduce(
        (a, l) => a.add(new Decimal(l.credit.toString())),
        new Decimal(0),
      );
      expect(dr.equals(cr)).toBe(true);

      // 4. retained earnings equals the independently calculated signed profit
      //    (compared numerically: the Decimal(18,4) round-trip drops trailing
      //     zeros in toString(), which is a display detail, not a value change)
      const asNum = (v: unknown) => new Decimal(v as string);
      const reLine = entry!.lines.find((l) => l.accountId === t.accountId.re)!;
      expect(asNum(reLine.credit).equals(EXPECTED_PROFIT)).toBe(true);

      // the zeroing lines used the FY totals, not any single period's row
      const revLine = entry!.lines.find(
        (l) => l.accountId === t.accountId.rev,
      )!;
      const expLine = entry!.lines.find(
        (l) => l.accountId === t.accountId.exp,
      )!;
      expect(asNum(revLine.debit).equals(new Decimal('16000'))).toBe(true);
      expect(asNum(expLine.credit).equals(new Decimal('11500'))).toBe(true);

      // 5. every FY period is CLOSED (including the posting period)
      const periods = await prisma.financialPeriod.findMany({
        where: { id: { in: t.fyPeriodIds } },
        select: { id: true, status: true },
      });
      expect(periods).toHaveLength(3);
      expect(periods.every((p) => p.status === 'CLOSED')).toBe(true);
      expect(result.closedPeriodIds.sort()).toEqual([...t.fyPeriodIds].sort());

      // 6. the fiscal year is closed and remembers its retained-earnings account
      const fy = await prisma.fiscalYear.findUniqueOrThrow({
        where: { id: t.fiscalYearId },
      });
      expect(fy.isClosed).toBe(true);
      expect(fy.retainedEarningsAccountId).toBe(t.accountId.re);

      // 7. the audit row exists inside the same committed transaction
      expect(await closeAudit(t)).not.toBeNull();

      // 8. the prior-year period and its balances are untouched
      const prior = await prisma.financialPeriod.findUniqueOrThrow({
        where: { id: t.priorPeriodId },
      });
      expect(prior.status).toBe('OPEN');
      const priorBalances = await prisma.accountBalance.findMany({
        where: { financialPeriodId: t.priorPeriodId },
      });
      expect(priorBalances).toHaveLength(2);
      const priorRev = priorBalances.find(
        (b) => b.accountId === t.accountId.rev,
      )!;
      expect(priorRev.closingCredit.toString()).toBe(String(PRIOR.revCredit));
      expect(priorRev.year).toBe(YEAR - 1);
    });

    it('rolls back every business write when the closing journal fails', async () => {
      const t = rollback;

      // Same REAL service graph, with only the GL engine forced to fail.
      const failingGl = {
        post: async () => {
          throw new Error('simulated posting failure');
        },
      } as unknown as GlEngineService;

      await expect(
        build(failingGl).closeFiscalYear(t.companyId, YEAR, t.actorId),
      ).rejects.toThrow(/simulated posting failure/);

      const fy = await prisma.fiscalYear.findUniqueOrThrow({
        where: { id: t.fiscalYearId },
      });
      expect(fy.isClosed).toBe(false);

      const periods = await prisma.financialPeriod.findMany({
        where: { id: { in: t.fyPeriodIds } },
        select: { status: true },
      });
      expect(periods).toHaveLength(3);
      expect(periods.every((p) => p.status === 'OPEN')).toBe(true);

      expect(await closingEntry(t.companyId)).toBeNull();
      expect(await closeAudit(t)).toBeNull();
    });
  },
);
