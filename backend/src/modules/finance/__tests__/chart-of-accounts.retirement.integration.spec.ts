/**
 * G16-FU-3 — ChartOfAccount retirement & restore policy (REAL PostgreSQL).
 *
 * Policy under test:
 *   - retirement is permitted only when the account's canonical positional
 *     balance is zero;
 *   - soft delete is reversible through restore();
 *   - neither operation may change any reported figure or delete any
 *     accounting record.
 *
 * The balance is read through `LedgerRepository.aggregatedJournalLines`, i.e.
 * the SAME canonical primitive the Trial Balance / Balance Sheet / P&L use, so
 * the gate cannot drift from G16-N-8-A reversal semantics: POSTED entries only,
 * excluding exactly the literal referenceType='REVERSAL' compensation and
 * treating a NULL referenceType as included.
 *
 * Conventions follow the sibling finance integration suites: integration-env
 * imported FIRST, @prisma/client loaded lazily in beforeAll, ordered cleanup
 * (journalEntry -> auditLog -> company -> user).
 */
import {
  hasIntegrationDatabase,
  integrationDatabaseUrl,
} from '../../../infrastructure/idempotency/__tests__/integration-env';

import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ChartOfAccountsRepository } from '../repositories/chart-of-accounts.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { FinancialTransactionsRepository } from '../repositories/financial-transactions.repository';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CashFlowService } from '../services/cash-flow.service';
import { LedgerQueryService } from '../services/ledger-query.service';
import { PostingValidationService } from '../services/posting-validation.service';

const databaseUrl = integrationDatabaseUrl;
const describeDb = hasIntegrationDatabase ? describe : describe.skip;

const RUN = `g16fu3-${process.pid}-${Date.now()}`;
const ACTOR_SUFFIX = '@g16-fu-3.invalid';

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
  'G16-FU-3 — ChartOfAccount retirement & restore policy (real PostgreSQL)',
  () => {
    let prisma: PrismaClient;
    let chart: ChartOfAccountsService;
    let ledgerQuery: LedgerQueryService;
    let cashFlow: CashFlowService;
    let validation: PostingValidationService;

    const tenantIds: string[] = [];
    const actorIds: string[] = [];

    const jwtFor = (companyId: string, userId: string) =>
      ({ userId, companyId, email: 'x', role: 'OWNER' }) as never;

    const seedTenant = async (tag: string): Promise<Tenant> => {
      const company = await prisma.company.create({
        data: { name: `${RUN}-${tag}` },
        select: { id: true },
      });
      tenantIds.push(company.id);
      const user = await prisma.user.create({
        data: { email: `${RUN}-${tag}${ACTOR_SUFFIX}`, passwordHash: 'x' },
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
          description: `${RUN} retirement`,
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

    const mkAcc = (
      t: Tenant,
      code: string,
      accountType = 'ASSET',
      normalBalance = 'DEBIT',
    ) =>
      chart.create(
        { code, name: `${RUN}-${code}`, accountType, normalBalance } as never,
        jwtFor(t.companyId, t.actorId),
      );

    /** Canonical positional balance of one account, via the shared primitive. */
    const balanceOf = async (
      companyId: string,
      accountId: string,
    ): Promise<Decimal> => {
      const rows = await new LedgerRepository(
        prisma as unknown as PrismaService,
      ).aggregatedJournalLines(companyId, {});
      const row = rows.find((r) => r.accountId === accountId);
      return row ? row.totalDebit.sub(row.totalCredit) : new Decimal(0);
    };

    /** Every reported figure, for the "lifecycle never changes money" proofs. */
    const snapshot = async (companyId: string) => {
      const tb = await ledgerQuery.getTrialBalance({ companyId });
      const bs = await ledgerQuery.getBalanceSheet({ companyId });
      const cf = await cashFlow.getCashFlow({ companyId, ...cfRange });
      return {
        tbDr: tb.totalDebit,
        tbCr: tb.totalCredit,
        bsAssets: bs.assets.total,
        bsLiabilities: bs.liabilities.total,
        bsEquity: bs.equity.total,
        bsCurrentEarnings: bs.currentEarnings,
        bsBalanced: bs.balanced,
        cfEnding: cf.endingCash,
        tbRows: JSON.stringify(tb.rows),
      };
    };

    const rowOf = async (id: string) =>
      prisma.chartOfAccount.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          code: true,
          isActive: true,
          deletedAt: true,
          rowVersion: true,
          parentId: true,
        },
      });

    const auditActions = async (companyId: string, entityId: string) =>
      (
        await prisma.auditLog.findMany({
          where: { companyId, entityId },
          select: { action: true },
          orderBy: { createdAt: 'asc' },
        })
      ).map((r) => r.action);

    beforeAll(async () => {
      const { PrismaClient: Ctor } = await import('@prisma/client');
      prisma = new Ctor({ datasources: { db: { url: databaseUrl } } });
      await prisma.$connect();

      const ps = prisma as unknown as PrismaService;
      const chartRepo = new ChartOfAccountsRepository(ps);
      const ledgerRepo = new LedgerRepository(ps);
      chart = new ChartOfAccountsService(
        chartRepo,
        ps,
        new AuditLogService(ps),
        ledgerRepo,
      );
      ledgerQuery = new LedgerQueryService(ledgerRepo);
      cashFlow = new CashFlowService(
        ledgerRepo,
        new FinancialTransactionsRepository(ps),
      );
      validation = new PostingValidationService();
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

    it('A. no history, zero balance: retirement succeeds on both doors', async () => {
      const t = await seedTenant('a');
      const acc = await mkAcc(t, '1900');

      expect((await balanceOf(t.companyId, acc.id)).toFixed(4)).toBe('0.0000');

      await chart.update(
        acc.id,
        { isActive: false } as never,
        jwtFor(t.companyId, t.actorId),
      );
      expect((await rowOf(acc.id)).isActive).toBe(false);
      // inactive is reversible through the existing PATCH
      await chart.update(
        acc.id,
        { isActive: true } as never,
        jwtFor(t.companyId, t.actorId),
      );
      expect((await rowOf(acc.id)).isActive).toBe(true);

      await chart.softDelete(acc.id, jwtFor(t.companyId, t.actorId));
      const del = await rowOf(acc.id);
      expect(del.isActive).toBe(false);
      expect(del.deletedAt).not.toBeNull();
    });

    it('B. historical ZERO balance: both deactivate and soft delete succeed', async () => {
      const t = await seedTenant('b');
      const acc = await mkAcc(t, '1910');
      const other = await mkAcc(t, '1911');
      // Two entries that leave `acc` at net zero while giving it real history.
      await post(t, [
        { accountId: acc.id, debit: '400', credit: '0' },
        { accountId: other.id, debit: '0', credit: '400' },
      ]);
      await post(t, [
        { accountId: other.id, debit: '400', credit: '0' },
        { accountId: acc.id, debit: '0', credit: '400' },
      ]);
      const lines = await prisma.journalLine.count({
        where: { accountId: acc.id },
      });
      expect(lines).toBeGreaterThan(0);
      expect((await balanceOf(t.companyId, acc.id)).toFixed(4)).toBe('0.0000');

      await chart.update(
        acc.id,
        { isActive: false } as never,
        jwtFor(t.companyId, t.actorId),
      );
      expect((await rowOf(acc.id)).isActive).toBe(false);

      const fresh = await rowOf(acc.id);
      await prisma.chartOfAccount.update({
        where: { id: acc.id },
        data: { isActive: true, rowVersion: { increment: 1 } },
      });
      void fresh;
      await chart.softDelete(acc.id, jwtFor(t.companyId, t.actorId));
      const del = await rowOf(acc.id);
      expect(del.deletedAt).not.toBeNull();
    });

    it('C. NON-ZERO balance: retirement refused on BOTH doors, account untouched', async () => {
      const t = await seedTenant('c');
      const acc = await mkAcc(t, '1920');
      const eq = await mkAcc(t, '3900', 'EQUITY', 'CREDIT');
      await post(t, [
        { accountId: acc.id, debit: '7500', credit: '0' },
        { accountId: eq.id, debit: '0', credit: '7500' },
      ]);
      expect((await balanceOf(t.companyId, acc.id)).toFixed(4)).toBe(
        '7500.0000',
      );

      await expect(
        chart.update(
          acc.id,
          { isActive: false } as never,
          jwtFor(t.companyId, t.actorId),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        chart.softDelete(acc.id, jwtFor(t.companyId, t.actorId)),
      ).rejects.toBeInstanceOf(BadRequestException);

      const after = await rowOf(acc.id);
      expect(after.isActive).toBe(true);
      expect(after.deletedAt).toBeNull();
      expect(after.rowVersion).toBe(0);
      // a rejected retirement must not write an audit row
      expect(await auditActions(t.companyId, acc.id)).toEqual(['CREATE']);
    });

    it('D. fully reversed history: canonical net is zero, retirement succeeds', async () => {
      const t = await seedTenant('d');
      const acc = await mkAcc(t, '1930');
      const eq = await mkAcc(t, '3901', 'EQUITY', 'CREDIT');
      const original = await post(t, [
        { accountId: acc.id, debit: '900', credit: '0' },
        { accountId: eq.id, debit: '0', credit: '900' },
      ]);
      // GlEngine reversal shape: original -> REVERSED, compensation POSTED/REVERSAL
      await prisma.journalEntry.update({
        where: { id: original.id },
        data: { status: 'REVERSED' },
      });
      await post(
        t,
        [
          { accountId: acc.id, debit: '0', credit: '900' },
          { accountId: eq.id, debit: '900', credit: '0' },
        ],
        'prior',
        'REVERSAL',
      );

      // history exists, but the CANONICAL positional net is zero
      expect(
        await prisma.journalLine.count({ where: { accountId: acc.id } }),
      ).toBeGreaterThan(0);
      expect((await balanceOf(t.companyId, acc.id)).toFixed(4)).toBe('0.0000');

      await chart.update(
        acc.id,
        { isActive: false } as never,
        jwtFor(t.companyId, t.actorId),
      );
      expect((await rowOf(acc.id)).isActive).toBe(false);
    });

    it('E. soft-delete -> restore: same id, same code, active, postable again', async () => {
      const t = await seedTenant('e');
      const acc = await mkAcc(t, '1940');
      const eq = await mkAcc(t, '3902', 'EQUITY', 'CREDIT');
      await post(t, [
        { accountId: acc.id, debit: '1000', credit: '0' },
        { accountId: eq.id, debit: '0', credit: '1000' },
      ]);
      // clear it so retirement is permitted
      await post(t, [
        { accountId: acc.id, debit: '0', credit: '1000' },
        { accountId: eq.id, debit: '1000', credit: '0' },
      ]);

      await chart.softDelete(acc.id, jwtFor(t.companyId, t.actorId));

      // invisible through the ordinary scoped read
      await expect(
        chart.findById(acc.id, jwtFor(t.companyId, t.actorId)),
      ).rejects.toBeInstanceOf(NotFoundException);
      const listed = await chart.findAll({}, jwtFor(t.companyId, t.actorId));
      expect(listed.items.map((i) => i.id)).not.toContain(acc.id);

      const restored = await chart.restore(
        acc.id,
        jwtFor(t.companyId, t.actorId),
      );
      const row = await rowOf(acc.id);
      expect(row.id).toBe(acc.id);
      expect(row.code).toBe('1940');
      expect(row.isActive).toBe(true);
      expect(row.deletedAt).toBeNull();
      expect(restored.isActive).toBe(true);

      // visible again
      const found = await chart.findById(
        acc.id,
        jwtFor(t.companyId, t.actorId),
      );
      expect(found.id).toBe(acc.id);

      // posting is permitted again (balanced two-line entry)
      const ok = await validation.validate(
        {
          companyId: t.companyId,
          entryDate: NOW,
          financialPeriodId: t.currentPeriodId,
          lines: [
            { accountId: acc.id, debit: '5', credit: '0', description: 'x' },
            { accountId: eq.id, debit: '0', credit: '5', description: 'x' },
          ],
        },
        prisma as never,
      );
      expect(Number(ok.totalCredit)).toBe(5);
    });

    it('F. retirement and restore never change any reported figure', async () => {
      const t = await seedTenant('f');
      // `revolving` is retired below; it must net to zero. `keeper` is never
      // touched and holds the real balance so every report is non-trivial.
      const revolving = await mkAcc(t, '1955');
      const keeper = await chart.create(
        {
          code: '1956',
          name: `${RUN}-1956`,
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          isCashOrBank: true,
        } as never,
        jwtFor(t.companyId, t.actorId),
      );
      const rev = await mkAcc(t, '4900', 'REVENUE', 'CREDIT');
      await post(t, [
        { accountId: revolving.id, debit: '900', credit: '0' },
        { accountId: keeper.id, debit: '0', credit: '900' },
      ]);
      await post(t, [
        { accountId: keeper.id, debit: '900', credit: '0' },
        { accountId: revolving.id, debit: '0', credit: '900' },
      ]);
      await post(t, [
        { accountId: keeper.id, debit: '6000', credit: '0' },
        { accountId: rev.id, debit: '0', credit: '6000' },
      ]);

      const before = await snapshot(t.companyId);
      expect(Number(before.tbDr)).toBeGreaterThan(0);
      expect(Number(before.bsAssets)).toBeGreaterThan(0);
      expect(Number(before.cfEnding)).toBeGreaterThan(0);

      await chart.update(
        revolving.id,
        { isActive: false } as never,
        jwtFor(t.companyId, t.actorId),
      );
      const during = await snapshot(t.companyId);
      expect(during).toEqual(before);

      await chart.update(
        revolving.id,
        { isActive: true } as never,
        jwtFor(t.companyId, t.actorId),
      );

      // soft-delete then restore the same account through the real endpoints
      await chart.softDelete(revolving.id, jwtFor(t.companyId, t.actorId));
      const afterDelete = await snapshot(t.companyId);
      expect(afterDelete).toEqual(before);

      await chart.restore(revolving.id, jwtFor(t.companyId, t.actorId));
      const afterRestore = await snapshot(t.companyId);
      expect(afterRestore).toEqual(before);
    });

    it('G. data integrity: retirement/restore touch no accounting record', async () => {
      const t = await seedTenant('g');
      const acc = await mkAcc(t, '1950');
      const eq = await mkAcc(t, '3903', 'EQUITY', 'CREDIT');
      await post(t, [
        { accountId: acc.id, debit: '300', credit: '0' },
        { accountId: eq.id, debit: '0', credit: '300' },
      ]);
      await post(t, [
        { accountId: acc.id, debit: '0', credit: '300' },
        { accountId: eq.id, debit: '300', credit: '0' },
      ]);

      const jlBefore = await prisma.journalLine.count({
        where: { accountId: acc.id },
      });
      const abBefore = await prisma.accountBalance.count({
        where: { accountId: acc.id },
      });

      await chart.softDelete(acc.id, jwtFor(t.companyId, t.actorId));
      await chart.restore(acc.id, jwtFor(t.companyId, t.actorId));

      expect(
        await prisma.journalLine.count({ where: { accountId: acc.id } }),
      ).toBe(jlBefore);
      expect(
        await prisma.accountBalance.count({ where: { accountId: acc.id } }),
      ).toBe(abBefore);
    });

    it('H. tenant isolation: a foreign account cannot be retired or restored', async () => {
      const a = await seedTenant('h-a');
      const b = await seedTenant('h-b');
      const foreign = await mkAcc(b, '1960');

      await expect(
        chart.softDelete(foreign.id, jwtFor(a.companyId, a.actorId)),
      ).rejects.toBeInstanceOf(NotFoundException);
      const untouched = await rowOf(foreign.id);
      expect(untouched.isActive).toBe(true);
      expect(untouched.deletedAt).toBeNull();

      // b deletes its own account; a cannot restore it
      await chart.softDelete(foreign.id, jwtFor(b.companyId, b.actorId));
      await expect(
        chart.restore(foreign.id, jwtFor(a.companyId, a.actorId)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect((await rowOf(foreign.id)).deletedAt).not.toBeNull();
    });

    it('I. CAS: stale rowVersion conflicts on retirement and on restore', async () => {
      const t = await seedTenant('i');
      const acc = await mkAcc(t, '1970');

      // stale retire
      const before = await rowOf(acc.id);
      await prisma.chartOfAccount.update({
        where: { id: acc.id },
        data: { name: `${RUN}-bump`, rowVersion: { increment: 1 } },
      });
      const staleRepo = new ChartOfAccountsRepository(
        prisma as unknown as PrismaService,
      );
      await expect(
        staleRepo.softDelete(acc.id, t.companyId, before.rowVersion),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((await rowOf(acc.id)).deletedAt).toBeNull();

      // stale restore
      await chart.softDelete(acc.id, jwtFor(t.companyId, t.actorId));
      const stale = await rowOf(acc.id);
      await prisma.chartOfAccount.update({
        where: { id: acc.id },
        data: { rowVersion: { increment: 1 } },
      });
      await expect(
        staleRepo.restore(acc.id, t.companyId, stale.rowVersion),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((await rowOf(acc.id)).deletedAt).not.toBeNull();
    });

    it('J. audit: DELETE / UPDATE / RESTORE recorded, rejections recorded not', async () => {
      const t = await seedTenant('j');
      const acc = await mkAcc(t, '1980');

      await chart.update(
        acc.id,
        { isActive: false } as never,
        jwtFor(t.companyId, t.actorId),
      );
      expect(await auditActions(t.companyId, acc.id)).toEqual([
        'CREATE',
        'UPDATE',
      ]);

      const actionsBefore = (await auditActions(t.companyId, acc.id)).length;
      await chart.softDelete(acc.id, jwtFor(t.companyId, t.actorId));
      const afterDelete = await auditActions(t.companyId, acc.id);
      expect(afterDelete).toEqual(['CREATE', 'UPDATE', 'DELETE']);
      expect(afterDelete.length).toBe(actionsBefore + 1);

      // rejected restore (not soft-deleted row is impossible here) — use a foreign id
      await expect(
        chart.restore(
          '00000000-0000-4000-8000-000000000000',
          jwtFor(t.companyId, t.actorId),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(await auditActions(t.companyId, acc.id)).toEqual(afterDelete);

      await chart.restore(acc.id, jwtFor(t.companyId, t.actorId));
      expect(await auditActions(t.companyId, acc.id)).toEqual([
        'CREATE',
        'UPDATE',
        'DELETE',
        'RESTORE',
      ]);
    });

    it('J2. restore is never a silent no-op', async () => {
      const t = await seedTenant('j2');
      const acc = await mkAcc(t, '1981');
      // never soft-deleted
      await expect(
        chart.restore(acc.id, jwtFor(t.companyId, t.actorId)),
      ).rejects.toBeInstanceOf(BadRequestException);

      await chart.softDelete(acc.id, jwtFor(t.companyId, t.actorId));
      await chart.restore(acc.id, jwtFor(t.companyId, t.actorId));
      // second restore must fail explicitly, not succeed quietly
      await expect(
        chart.restore(acc.id, jwtFor(t.companyId, t.actorId)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('K. relationships: CashAccount link and parentId survive retire + restore', async () => {
      const t = await seedTenant('k');
      const parent = await mkAcc(t, '1990');
      const child = await mkAcc(t, '1991');
      await prisma.chartOfAccount.update({
        where: { id: parent.id },
        data: { isCashOrBank: true },
      });
      const linked = await prisma.cashAccount.create({
        data: {
          companyId: t.companyId,
          name: `${RUN}-drawer`,
        },
        select: { id: true },
      });
      await prisma.cashAccount.update({
        where: { id: linked.id },
        data: { chartOfAccountId: parent.id },
      });

      const before = await rowOf(child.id);
      await chart.softDelete(parent.id, jwtFor(t.companyId, t.actorId));
      await chart.restore(parent.id, jwtFor(t.companyId, t.actorId));

      const link = await prisma.cashAccount.findUniqueOrThrow({
        where: { id: linked.id },
        select: { chartOfAccountId: true },
      });
      expect(link.chartOfAccountId).toBe(parent.id);
      expect((await rowOf(child.id)).parentId).toBe(before.parentId);
    });

    it('L. posting is refused while retired and permitted after a valid restore', async () => {
      const t = await seedTenant('l');
      const acc = await mkAcc(t, '1995');
      const eq = await mkAcc(t, '3904', 'EQUITY', 'CREDIT');
      await post(t, [
        { accountId: acc.id, debit: '200', credit: '0' },
        { accountId: eq.id, debit: '0', credit: '200' },
      ]);
      await post(t, [
        { accountId: acc.id, debit: '0', credit: '200' },
        { accountId: eq.id, debit: '200', credit: '0' },
      ]);

      const tryPost = async () =>
        validation
          .validate(
            {
              companyId: t.companyId,
              entryDate: NOW,
              financialPeriodId: t.currentPeriodId,
              lines: [
                {
                  accountId: acc.id,
                  debit: '7',
                  credit: '0',
                  description: 'x',
                },
                { accountId: eq.id, debit: '0', credit: '7', description: 'x' },
              ],
            },
            prisma as never,
          )
          .then(() => 'ALLOWED')
          .catch((e) => 'BLOCKED (' + e.constructor.name + ')');

      expect(await tryPost()).toBe('ALLOWED');
      await chart.softDelete(acc.id, jwtFor(t.companyId, t.actorId));
      expect(await tryPost()).toContain('BLOCKED');
      await chart.restore(acc.id, jwtFor(t.companyId, t.actorId));
      expect(await tryPost()).toBe('ALLOWED');
    });
  },
);
