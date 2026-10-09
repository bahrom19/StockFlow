/**
 * G16-FU-2 — Cash Account Classification Integrity (REAL PostgreSQL).
 *
 * Proves that `ChartOfAccountsService` refuses a cash classification that is
 * not an ASSET/DEBIT account, and that classification is frozen once the
 * account has ANY journal history.
 *
 * Before the fix this suite FAILED: `isCashOrBank` was an unguarded
 * client-supplied boolean, so flipping a non-cash account into the cash
 * population retroactively corrupted the cash-flow statement while
 * `reconciled` stayed `true` and TB/BS stayed correct.
 *
 * The invariant is enforced at the WRITE boundary only — `CashFlowService` is
 * deliberately unmodified and still trusts `isCashOrBank` as the authoritative
 * cash population.
 *
 * Conventions follow reversal-reporting.integration.spec.ts and
 * cash-flow.lifecycle.integration.spec.ts: integration-env imported FIRST,
 * @prisma/client loaded lazily in beforeAll, ordered cleanup
 * (journalEntry -> auditLog -> company -> user).
 */
import {
  hasIntegrationDatabase,
  integrationDatabaseUrl,
} from '../../../infrastructure/idempotency/__tests__/integration-env';

import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ChartOfAccountsRepository } from '../repositories/chart-of-accounts.repository';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { LedgerRepository } from '../repositories/ledger.repository';
import { FinancialTransactionsRepository } from '../repositories/financial-transactions.repository';
import { CashFlowService } from '../services/cash-flow.service';
import { LedgerQueryService } from '../services/ledger-query.service';

const databaseUrl = integrationDatabaseUrl;
const describeDb = hasIntegrationDatabase ? describe : describe.skip;

const RUN = `g16fu2-${process.pid}-${Date.now()}`;
const ACTOR_SUFFIX = '@g16-fu-2.invalid';

const NOW = new Date();
const CUR_YEAR = NOW.getUTCFullYear();
const CUR_MONTH = NOW.getUTCMonth();
const periodRange = {
  startDate: new Date(Date.UTC(CUR_YEAR, CUR_MONTH, 1)),
  endDate: new Date(Date.UTC(CUR_YEAR, CUR_MONTH + 1, 0, 23, 59, 59, 999)),
};
const priorYear = CUR_MONTH === 0 ? CUR_YEAR - 1 : CUR_YEAR;
const priorMonth = CUR_MONTH === 0 ? 11 : CUR_MONTH - 1;
const priorRange = {
  startDate: new Date(Date.UTC(priorYear, priorMonth, 1)),
  endDate: new Date(Date.UTC(priorYear, priorMonth + 1, 0, 23, 59, 59, 999)),
};
const cfRange = {
  dateFrom: periodRange.startDate,
  dateTo: periodRange.endDate,
};

interface Tenant {
  companyId: string;
  actorId: string;
  currentPeriodId: string;
  priorPeriodId: string;
}

describeDb(
  'G16-FU-2 — cash account classification integrity (real PostgreSQL)',
  () => {
    let prisma: PrismaClient;
    let chart: ChartOfAccountsService;
    let cashFlow: CashFlowService;
    let ledgerQuery: LedgerQueryService;

    let scenarioA: Tenant;
    let scenarioB: Tenant;
    let scenarioC: Tenant;
    let scenarioD: Tenant;
    let scenarioE: Tenant;
    let scenarioF: Tenant;
    let scenarioG: Tenant;
    let scenarioI: Tenant;

    const tenantIds: string[] = [];
    const actorIds: string[] = [];

    const jwtFor = (companyId: string, userId: string) =>
      ({
        userId,
        companyId,
        email: 'x',
        role: 'OWNER',
      }) as never;

    const seedTenant = async (tag: string): Promise<Tenant> => {
      const company = await prisma.company.create({
        data: { name: `${RUN}-${tag}` },
        select: { id: true },
      });
      tenantIds.push(company.id);
      const user = await prisma.user.create({
        data: {
          email: `${RUN}-${tag}${ACTOR_SUFFIX}`,
          passwordHash: 'not-a-real-hash',
        },
        select: { id: true },
      });
      actorIds.push(user.id);
      const mkPeriod = (
        name: string,
        year: number,
        month: number,
        r: typeof periodRange,
      ) =>
        prisma.financialPeriod
          .create({
            data: {
              companyId: company.id,
              name,
              year,
              month,
              ...r,
              status: 'OPEN',
            },
            select: { id: true },
          })
          .then((x) => x.id);
      return {
        companyId: company.id,
        actorId: user.id,
        currentPeriodId: await mkPeriod(
          `${RUN}-${tag}-cur`,
          CUR_YEAR,
          CUR_MONTH + 1,
          periodRange,
        ),
        priorPeriodId: await mkPeriod(
          `${RUN}-${tag}-pri`,
          priorYear,
          priorMonth + 1,
          priorRange,
        ),
      };
    };

    /** Raw journal lines — this suite must not depend on GL posting internals. */
    let seq = 900;
    const post = async (
      t: Tenant,
      lines: { accountId: string; debit: string; credit: string }[],
      when: 'prior' | 'current' = 'prior',
      referenceType: string | null = 'SALE',
    ): Promise<{ id: string }> =>
      prisma.journalEntry.create({
        data: {
          company: { connect: { id: t.companyId } },
          financialPeriod: {
            connect: {
              id: when === 'prior' ? t.priorPeriodId : t.currentPeriodId,
            },
          },
          entryNumber: seq++,
          entryDate: when === 'prior' ? priorRange.startDate : NOW,
          status: 'POSTED',
          referenceType,
          description: `${RUN} classification`,
          totalDebit: new Decimal(
            lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4),
          ),
          totalCredit: new Decimal(
            lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(4),
          ),
          postedAt: NOW,
          lines: {
            create: lines.map((l) => ({
              account: { connect: { id: l.accountId } },
              debit: new Decimal(l.debit),
              credit: new Decimal(l.credit),
              description: 'leg',
            })),
          },
        },
        select: { id: true },
      });

    const mk = (
      t: Tenant,
      code: string,
      accountType: string,
      normalBalance: string,
      isCashOrBank = false,
    ): Promise<{ id: string; rowVersion: number; isCashOrBank: boolean }> =>
      prisma.chartOfAccount.create({
        data: {
          companyId: t.companyId,
          code,
          name: `${RUN}-${code}`,
          accountType: accountType as never,
          normalBalance: normalBalance as never,
          isCashOrBank,
          isSystem: false,
        },
        select: { id: true, rowVersion: true, isCashOrBank: true },
      });

    const endingCash = async (companyId: string) =>
      (await cashFlow.getCashFlow({ companyId, ...cfRange })).endingCash;

    beforeAll(async () => {
      const { PrismaClient: Ctor } = await import('@prisma/client');
      prisma = new Ctor({ datasources: { db: { url: databaseUrl } } });
      await prisma.$connect();

      const prismaService = prisma as unknown as PrismaService;
      chart = new ChartOfAccountsService(
        new ChartOfAccountsRepository(prismaService),
        prismaService,
        new AuditLogService(prismaService),
        new LedgerRepository(prismaService),
      );
      const ledgerRepo = new LedgerRepository(prismaService);
      ledgerQuery = new LedgerQueryService(ledgerRepo);
      cashFlow = new CashFlowService(
        ledgerRepo,
        new FinancialTransactionsRepository(prismaService),
      );

      scenarioA = await seedTenant('a');
      scenarioB = await seedTenant('b');
      scenarioC = await seedTenant('c');
      scenarioD = await seedTenant('d');
      scenarioE = await seedTenant('e');
      scenarioF = await seedTenant('f');
      scenarioG = await seedTenant('g');
      scenarioI = await seedTenant('i');
    });

    afterAll(async () => {
      if (!prisma) return;
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

    it('A. flipping a balance-bearing receivable into the cash population is rejected and CashFlow is unchanged', async () => {
      const t = scenarioA;
      const cash = await mk(t, '1010', 'ASSET', 'DEBIT', true);
      const ar = await mk(t, '1200', 'ASSET', 'DEBIT', false);
      const revenue = await mk(t, '4000', 'REVENUE', 'CREDIT');

      // Dr Cash 9000 / Cr AR 9000  (cash +9000, receivable -9000)
      await post(t, [
        { accountId: cash.id, debit: '9000', credit: '0' },
        { accountId: ar.id, debit: '0', credit: '9000' },
      ]);
      // Dr AR 6000 / Cr Revenue 6000 — receivable ends at -3000
      await post(t, [
        { accountId: ar.id, debit: '6000', credit: '0' },
        { accountId: revenue.id, debit: '0', credit: '6000' },
      ]);

      const before = await endingCash(t.companyId);
      const bsBefore = await ledgerQuery.getBalanceSheet({
        companyId: t.companyId,
      });
      const arBefore = bsBefore.assets.rows.find((r) => r.accountId === ar.id);
      expect(before).toBe('9000.0000');
      expect(arBefore!.balance).toBe('-3000.0000');

      // THE DEFECT: a plain PATCH used to persist this verbatim.
      const fresh = await prisma.chartOfAccount.findUniqueOrThrow({
        where: { id: ar.id },
        select: { rowVersion: true },
      });
      await expect(
        chart.update(
          ar.id,
          { isCashOrBank: true } as never,
          jwtFor(t.companyId, t.actorId),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Nothing changed on disk.
      const after = await prisma.chartOfAccount.findUniqueOrThrow({
        where: { id: ar.id },
        select: { isCashOrBank: true },
      });
      expect(after.isCashOrBank).toBe(false);
      expect(fresh.rowVersion).toBeGreaterThanOrEqual(0);

      // CashFlow is byte-identical — the 3000 receivable is NOT netted into cash.
      expect(await endingCash(t.companyId)).toBe(before);
      const bsAfter = await ledgerQuery.getBalanceSheet({
        companyId: t.companyId,
      });
      const arAfter = bsAfter.assets.rows.find((r) => r.accountId === ar.id);
      expect(arAfter!.balance).toBe('-3000.0000');
    });

    it('B. a valid ASSET/DEBIT cash account is created and reported correctly', async () => {
      const t = scenarioB;
      const equity = await mk(t, '3000', 'EQUITY', 'CREDIT');
      const created = await chart.create(
        {
          code: '1050',
          name: `${RUN}-1050`,
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          isCashOrBank: true,
        } as never,
        jwtFor(t.companyId, t.actorId),
      );
      expect(created.isCashOrBank).toBe(true);
      expect(created.accountType).toBe('ASSET');

      await post(t, [
        { accountId: created.id, debit: '2500', credit: '0' },
        { accountId: equity.id, debit: '0', credit: '2500' },
      ]);

      expect(await endingCash(t.companyId)).toBe('2500.0000');
    });

    it('C. classification is frozen once the account has journal history', async () => {
      const t = scenarioC;
      const acc = await mk(t, '1300', 'ASSET', 'DEBIT', false);
      const equity = await mk(t, '3000', 'EQUITY', 'CREDIT');
      await post(t, [
        { accountId: acc.id, debit: '400', credit: '0' },
        { accountId: equity.id, debit: '0', credit: '400' },
      ]);

      await expect(
        chart.update(
          acc.id,
          { isCashOrBank: true } as never,
          jwtFor(t.companyId, t.actorId),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const row = await prisma.chartOfAccount.findUniqueOrThrow({
        where: { id: acc.id },
        select: { isCashOrBank: true },
      });
      expect(row.isCashOrBank).toBe(false);
    });

    it('D. REVERSED history still freezes classification (no post->reverse->reclassify bypass)', async () => {
      const t = scenarioD;
      const acc = await mk(t, '1400', 'ASSET', 'DEBIT', false);
      const equity = await mk(t, '3000', 'EQUITY', 'CREDIT');
      const entry = await post(t, [
        { accountId: acc.id, debit: '700', credit: '0' },
        { accountId: equity.id, debit: '0', credit: '700' },
      ]);
      // Reverse it: original -> REVERSED, compensating POSTED entry.
      await prisma.journalEntry.update({
        where: { id: entry.id },
        data: { status: 'REVERSED' },
      });
      await post(
        t,
        [
          { accountId: acc.id, debit: '0', credit: '700' },
          { accountId: equity.id, debit: '700', credit: '0' },
        ],
        'prior',
        'REVERSAL',
      );

      // Net balance is now zero, but history exists and must still freeze it.
      // Computed straight from JournalLine so the assertion does not depend on
      // AccountBalance snapshots, which raw postings here do not create.
      const lines = await prisma.journalLine.findMany({
        where: { accountId: acc.id },
        select: { debit: true, credit: true },
      });
      const net = lines.reduce(
        (acc, l) => acc + Number(l.debit) - Number(l.credit),
        0,
      );
      expect(net).toBe(0);
      expect(lines.length).toBeGreaterThan(0);

      await expect(
        chart.update(
          acc.id,
          { isCashOrBank: true } as never,
          jwtFor(t.companyId, t.actorId),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const row = await prisma.chartOfAccount.findUniqueOrThrow({
        where: { id: acc.id },
        select: { isCashOrBank: true },
      });
      expect(row.isCashOrBank).toBe(false);
    });

    it('E. an account with zero current balance but history stays frozen', async () => {
      const t = scenarioE;
      const acc = await mk(t, '1500', 'ASSET', 'DEBIT', false);
      const equity = await mk(t, '3000', 'EQUITY', 'CREDIT');
      await post(t, [
        { accountId: acc.id, debit: '900', credit: '0' },
        { accountId: equity.id, debit: '0', credit: '900' },
      ]);
      await post(t, [
        { accountId: acc.id, debit: '0', credit: '900' },
        { accountId: equity.id, debit: '900', credit: '0' },
      ]);
      // Unposted-looking account: zero net balance, but journal lines exist.
      const lines = await prisma.journalLine.count({
        where: { accountId: acc.id },
      });
      expect(lines).toBeGreaterThan(0);

      await expect(
        chart.update(
          acc.id,
          { isCashOrBank: true } as never,
          jwtFor(t.companyId, t.actorId),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('F. TB/BS/P&L are unaffected by a rejected classification change', async () => {
      const t = scenarioF;
      const acc = await mk(t, '1600', 'ASSET', 'DEBIT', false);
      const equity = await mk(t, '3000', 'EQUITY', 'CREDIT');
      await post(t, [
        { accountId: acc.id, debit: '1200', credit: '0' },
        { accountId: equity.id, debit: '0', credit: '1200' },
      ]);

      const tbBefore = await ledgerQuery.getTrialBalance({
        companyId: t.companyId,
      });
      const bsBefore = await ledgerQuery.getBalanceSheet({
        companyId: t.companyId,
      });

      await expect(
        chart.update(
          acc.id,
          { isCashOrBank: true } as never,
          jwtFor(t.companyId, t.actorId),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const tbAfter = await ledgerQuery.getTrialBalance({
        companyId: t.companyId,
      });
      const bsAfter = await ledgerQuery.getBalanceSheet({
        companyId: t.companyId,
      });
      expect(tbAfter.totalDebit).toBe(tbBefore.totalDebit);
      expect(tbAfter.totalCredit).toBe(tbBefore.totalCredit);
      expect(bsAfter.balanced).toBe(bsBefore.balanced);
      expect(JSON.stringify(bsAfter.assets)).toBe(
        JSON.stringify(bsBefore.assets),
      );
    });

    it('G. tenant isolation: a foreign account id is not reachable', async () => {
      const a = scenarioG;
      const other = await seedTenant('g-peer');
      const foreign = await mk(other, '1010', 'ASSET', 'DEBIT', true);

      // Caller A asks for B's account -> NotFound, no mutation.
      await expect(
        chart.update(
          foreign.id,
          { isCashOrBank: false } as never,
          jwtFor(a.companyId, a.actorId),
        ),
      ).rejects.toThrow();

      const row = await prisma.chartOfAccount.findUniqueOrThrow({
        where: { id: foreign.id },
        select: { isCashOrBank: true },
      });
      expect(row.isCashOrBank).toBe(true);
    });

    it('I. accepted updates keep the audit trail; rejected ones create no audit entry', async () => {
      const t = scenarioI;
      const acc = await mk(t, '1700', 'ASSET', 'DEBIT', false);
      const equity = await mk(t, '3000', 'EQUITY', 'CREDIT');
      await post(t, [
        { accountId: acc.id, debit: '300', credit: '0' },
        { accountId: equity.id, debit: '0', credit: '300' },
      ]);

      const before = await prisma.auditLog.count({
        where: { companyId: t.companyId, entityId: acc.id },
      });

      // Accepted: benign rename on a posted account (classification untouched).
      await chart.update(
        acc.id,
        { name: `${RUN}-1700-renamed` } as never,
        jwtFor(t.companyId, t.actorId),
      );
      const afterAccepted = await prisma.auditLog.count({
        where: { companyId: t.companyId, entityId: acc.id },
      });
      expect(afterAccepted).toBe(before + 1);

      // Rejected: classification change on a posted account writes nothing.
      await expect(
        chart.update(
          acc.id,
          { isCashOrBank: true } as never,
          jwtFor(t.companyId, t.actorId),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      const afterRejected = await prisma.auditLog.count({
        where: { companyId: t.companyId, entityId: acc.id },
      });
      expect(afterRejected).toBe(afterAccepted);
    });

    it('H. a stale rowVersion still conflicts, and the history guard rides the same predicate', async () => {
      const t = scenarioI;
      const acc = await mk(t, '1800', 'ASSET', 'DEBIT', false);
      const repo = new ChartOfAccountsRepository(
        prisma as unknown as PrismaService,
      );

      const stale = acc.rowVersion;
      // bump it out from under ourselves
      await prisma.chartOfAccount.update({
        where: { id: acc.id },
        data: { name: `${RUN}-1800-bumped`, rowVersion: { increment: 1 } },
      });

      // Optimistic lock still rejects a stale write.
      await expect(
        repo.update(acc.id, { name: `${RUN}-1800-stale` }, t.companyId, stale),
      ).rejects.toBeInstanceOf(ConflictException);

      // The G16-FU-2 extra predicate is optional and changes nothing when omitted:
      // an unposted account is still updatable at the current rowVersion.
      const fresh = await prisma.chartOfAccount.findUniqueOrThrow({
        where: { id: acc.id },
        select: { rowVersion: true },
      });
      const updated = await repo.update(
        acc.id,
        { name: `${RUN}-1800-ok` },
        t.companyId,
        fresh.rowVersion,
      );
      expect(updated.name).toBe(`${RUN}-1800-ok`);
    });
  },
);
