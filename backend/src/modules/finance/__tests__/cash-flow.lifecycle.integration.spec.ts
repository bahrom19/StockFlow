/**
 * G16-FU-1 — Cash-flow historical-account lifecycle integrity (REAL PostgreSQL).
 *
 * Proves that `CashFlowService` keeps historical cash balances and historical
 * cash MOVEMENTS visible after an account's lifecycle changes, matching the
 * lifecycle-inclusive semantics already established for the Trial Balance and
 * Balance Sheet (G16) and the P&L (G16-N-8-A/B):
 *
 *   CR-1 historical JournalLine amounts remain report-visible after a
 *        lifecycle change;
 *   CR-2 posting targets require active + non-deleted (posting validation
 *        only — no report read may consult it);
 *   CR-3 `deletedAt` is API visibility, not accounting erasure;
 *   CR-4 reports derive from accounting history, not current lifecycle state.
 *
 * Before the fix this suite FAILED: `CashFlowService` built its cash
 * population from `{ companyId, isCashOrBank: true, isActive: true,
 * deletedAt: null }`, so a retired cash account vanished from `beginningCash`,
 * `endingCash`, the movement enumeration and every movement partition — while
 * TB/BS kept reporting it. The cross-statement assertion below is the detector.
 *
 * `reconciled` is asserted for arithmetic consistency ONLY and is deliberately
 * NOT the defect detector: beginning cash, the movement partitions and ending
 * cash are all computed over the same account set, so an omission in that set
 * cancels out on both sides and the flag reads `true` even while the statement
 * is materially wrong.
 *
 * Expected values are computed independently from `JournalLine` aggregates
 * (see `expectedCash`), never from CashFlowService or LedgerQueryService.
 *
 * Conventions follow fiscal-year-close.integration.spec.ts and
 * reversal-reporting.integration.spec.ts: integration-env imported FIRST,
 * @prisma/client loaded lazily in beforeAll, ordered cleanup
 * (journalEntry -> auditLog -> company -> user). The EventBus is the only
 * stub (side-effect fan-out only). Each scenario gets a DEDICATED tenant so
 * exact totals cannot be polluted by another test's postings.
 */
import {
  hasIntegrationDatabase,
  integrationDatabaseUrl,
} from '../../../infrastructure/idempotency/__tests__/integration-env';

import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { EventBus } from '../../../common/events/event-bus.interface';
import { Decimal } from '@prisma/client/runtime/library';
import { GlEngineService } from '../services/gl-engine.service';
import { PostingValidationService } from '../services/posting-validation.service';
import { JournalEntriesRepository } from '../repositories/journal-entries.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { FinancialPeriodsRepository } from '../repositories/financial-periods.repository';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { LedgerQueryService } from '../services/ledger-query.service';
import { FinancialTransactionsRepository } from '../repositories/financial-transactions.repository';
import { CashFlowService } from '../services/cash-flow.service';

const databaseUrl = integrationDatabaseUrl;
const describeDb = hasIntegrationDatabase ? describe : describe.skip;

const RUN = `g16fu1-${process.pid}-${Date.now()}`;
const ACTOR_SUFFIX = '@g16-fu-1.invalid';

// Two periods so `beginningCash` (before the window) can be exercised with a
// non-zero value: OPENING entries land in the prior month, MOVEMENT entries in
// the current month, and the report window is the current month.
const NOW = new Date();
const CUR_YEAR = NOW.getUTCFullYear();
const CUR_MONTH = NOW.getUTCMonth(); // 0-based
const currentRange = {
  startDate: new Date(Date.UTC(CUR_YEAR, CUR_MONTH, 1)),
  endDate: new Date(Date.UTC(CUR_YEAR, CUR_MONTH + 1, 0, 23, 59, 59, 999)),
};
const priorYear = CUR_MONTH === 0 ? CUR_YEAR - 1 : CUR_YEAR;
const priorMonth = CUR_MONTH === 0 ? 11 : CUR_MONTH - 1;
const priorRange = {
  startDate: new Date(Date.UTC(priorYear, priorMonth, 1)),
  endDate: new Date(Date.UTC(priorYear, priorMonth + 1, 0, 23, 59, 59, 999)),
};
/** Report window = current month, the same range movement entries are dated in. */
const cfRange = { dateFrom: currentRange.startDate, dateTo: currentRange.endDate };

interface Tenant {
  companyId: string;
  actorId: string;
  currentPeriodId: string;
  priorPeriodId: string;
}

describeDb('G16-FU-1 — cash-flow historical-account lifecycle integrity (real PostgreSQL)', () => {
  let prisma: PrismaClient;
  let glEngine: GlEngineService;
  let ledgerQuery: LedgerQueryService;
  let cashFlow: CashFlowService;

  let scenarioA: Tenant;
  let scenarioB: Tenant;
  let scenarioC: Tenant;
  let scenarioD: Tenant;
  let scenarioD2: Tenant;
  let scenarioE: Tenant;
  let isolationA: Tenant;
  let isolationPeer: Tenant;

  const tenantIds: string[] = [];
  const actorIds: string[] = [];

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

    const mkPeriod = (name: string, year: number, month: number, range: typeof currentRange) =>
      prisma.financialPeriod
        .create({
          data: {
            companyId: company.id,
            name,
            year,
            month,
            ...range,
            status: 'OPEN',
          },
          select: { id: true },
        })
        .then((r) => r.id);

    return {
      companyId: company.id,
      actorId: user.id,
      currentPeriodId: await mkPeriod(
        `${RUN}-${tag}-cur`,
        CUR_YEAR,
        CUR_MONTH + 1,
        currentRange,
      ),
      priorPeriodId: await mkPeriod(
        `${RUN}-${tag}-prior`,
        priorYear,
        priorMonth + 1,
        priorRange,
      ),
    };
  };

  /** Create an account; `cash: true` marks the cash population. */
  const mkAcc = async (
    t: Tenant,
    code: string,
    accountType: string,
    cash = false,
  ): Promise<string> =>
    prisma.chartOfAccount
      .create({
        data: {
          companyId: t.companyId,
          code,
          name: `${RUN}-${code}`,
          accountType: accountType as never,
          normalBalance: (
            accountType === 'REVENUE' ||
            accountType === 'LIABILITY' ||
            accountType === 'EQUITY'
              ? 'CREDIT'
              : 'DEBIT'
          ) as never,
          isCashOrBank: cash,
          isActive: true,
        },
        select: { id: true },
      })
      .then((r) => r.id);

  /**
   * Real GL posting through GlEngineService, so CR-2 (posting requires an
   * active, non-deleted target) is exercised by the same write path
   * production uses — not by a hand-rolled insert.
   */
  const post = async (
    t: Tenant,
    lines: { accountId: string; debit: string; credit: string }[],
    when: 'prior' | 'current',
    referenceType: string = 'SALE',
  ) =>
    glEngine.post(
      {
        companyId: t.companyId,
        financialPeriodId:
          when === 'prior' ? t.priorPeriodId : t.currentPeriodId,
        entryDate: when === 'prior' ? priorRange.startDate : NOW,
        description: `${RUN} lifecycle`,
        referenceType,
        createdBy: t.actorId,
        lines: lines.map((l) => ({ ...l, description: 'leg' })),
      },
      undefined,
    );

  /** Retire as ChartOfAccountsService.update() would. */
  const retireInactive = (id: string) =>
    prisma.chartOfAccount.update({
      where: { id },
      data: { isActive: false },
    });

  /** Retire as ChartOfAccountsService.softDelete() would. */
  const retireSoftDeleted = (id: string) =>
    prisma.chartOfAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

  /**
   * Independently computed truth: net cash (debit − credit) over the tenant's
   * cash accounts, using the canonical positional semantics —
   * POSTED entries, excluding literal referenceType='REVERSAL'.
   *
   * Deliberately derived straight from JournalLine, never from
   * CashFlowService or LedgerQueryService, so the cross-statement assertion
   * cannot be satisfied by the implementation under test.
   */
  const expectedCash = async (t: Tenant): Promise<Decimal> => {
    const cashIds = (
      await prisma.chartOfAccount.findMany({
        where: { companyId: t.companyId, isCashOrBank: true },
        select: { id: true },
      })
    ).map((a) => a.id);
    if (cashIds.length === 0) return new Decimal(0);

    const grouped = await prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: cashIds },
        journalEntry: {
          companyId: t.companyId,
          status: 'POSTED',
          NOT: { referenceType: 'REVERSAL' },
        },
      },
      _sum: { debit: true, credit: true },
    });
    return grouped.reduce(
      (acc, g) =>
        acc
          .add(new Decimal(g._sum.debit?.toString() ?? '0'))
          .sub(new Decimal(g._sum.credit?.toString() ?? '0')),
      new Decimal(0),
    );
  };

  /** Balance Sheet cash total, taken from the real service output. */
  const bsCashOf = async (t: Tenant): Promise<Decimal> => {
    const bs = await ledgerQuery.getBalanceSheet({ companyId: t.companyId });
    return bs.assets.rows
      .filter((r) => r.accountType === 'ASSET')
      .reduce((acc, r) => acc.add(new Decimal(r.balance)), new Decimal(0));
  };

  /** Trial Balance cash total, taken from the real service output. */
  const tbCashOf = async (t: Tenant): Promise<Decimal> => {
    const tb = await ledgerQuery.getTrialBalance({ companyId: t.companyId });
    const cashIds = new Set(
      (
        await prisma.chartOfAccount.findMany({
          where: { companyId: t.companyId, isCashOrBank: true },
          select: { id: true },
        })
      ).map((a) => a.id),
    );
    return tb.rows
      .filter((r) => cashIds.has(r.accountId))
      .reduce((acc, r) => acc.add(new Decimal(r.debit)), new Decimal(0));
  };

  /** The one assertion that actually detects this defect class. */
  const expectStatementsAgree = async (t: Tenant, expected: Decimal) => {
    const truth = await expectedCash(t);
    const tb = await tbCashOf(t);
    const bs = await bsCashOf(t);
    const cf = await cashFlow.getCashFlow({ companyId: t.companyId, ...cfRange });

    expect(truth.toFixed(4)).toBe(expected.toFixed(4));
    expect(tb.toFixed(4)).toBe(expected.toFixed(4));
    expect(bs.toFixed(4)).toBe(expected.toFixed(4));
    expect(cf.endingCash).toBe(expected.toFixed(4));
    return cf;
  };

  beforeAll(async () => {
    const { PrismaClient: Ctor } = await import('@prisma/client');
    prisma = new Ctor({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const prismaService = prisma as unknown as PrismaService;
    const auditLog = new AuditLogService(prismaService);
    const validation = new PostingValidationService();
    const docSeq = new DocumentSequenceService(prismaService);
    const journalRepo = new JournalEntriesRepository(prismaService, docSeq);
    const eventBus = { publish: async () => undefined } as unknown as EventBus;
    glEngine = new GlEngineService(
      journalRepo,
      validation,
      prismaService,
      auditLog,
      eventBus,
    );
    const ledgerRepo = new LedgerRepository(prismaService);
    // FinancialPeriodsRepository is constructed for parity with the sibling
    // suites; periods above are seeded directly so the window is explicit.
    void new FinancialPeriodsRepository(prismaService);
    ledgerQuery = new LedgerQueryService(ledgerRepo);
    cashFlow = new CashFlowService(
      ledgerRepo,
      new FinancialTransactionsRepository(prismaService),
    );

    scenarioA = await seedTenant('a');
    scenarioB = await seedTenant('b');
    scenarioC = await seedTenant('c');
    scenarioD = await seedTenant('d');
    scenarioD2 = await seedTenant('d2');
    scenarioE = await seedTenant('e');
    isolationA = await seedTenant('iso-a');
    isolationPeer = await seedTenant('iso-peer');
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

  it('A. inactive cash account keeps its historical balance and movements visible', async () => {
    const t = scenarioA;
    const active = await mkAcc(t, '1010', 'ASSET', true);
    const inactive = await mkAcc(t, '1020', 'ASSET', true);
    const equity = await mkAcc(t, '3000', 'EQUITY');

    // Opening balances, all BEFORE the report window.
    await post(
      t,
      [
        { accountId: active, debit: '5000', credit: '0' },
        { accountId: equity, debit: '0', credit: '5000' },
      ],
      'prior',
    );
    await post(
      t,
      [
        { accountId: inactive, debit: '7000', credit: '0' },
        { accountId: equity, debit: '0', credit: '7000' },
      ],
      'prior',
    );

    // The in-window movement is posted while the account is still active —
    // CR-2 correctly refuses postings to a retired account — and must remain
    // visible AFTER retirement.
    await post(
      t,
      [
        { accountId: inactive, debit: '1000', credit: '0' },
        { accountId: equity, debit: '0', credit: '1000' },
      ],
      'current',
    );
    await retireInactive(inactive);

    const cf = await expectStatementsAgree(t, new Decimal('13000'));

    // opening 12000, movement +1000 on a retired account, ending 13000
    expect(cf.beginningCash).toBe('12000.0000');
    expect(cf.netCashMovement).toBe('1000.0000');
    expect(cf.operating.total).toBe('1000.0000');
    const rows = cf.operating.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.accountId).toBe(inactive);
    expect(rows[0]!.amount).toBe('1000.0000');
    // lifecycle state must not blank the report
    expect(cf.endingCash).not.toBe('0.0000');
    expect(cf.reconciled).toBe(true);
  });

  it('B. soft-deleted cash account keeps its historical balance visible', async () => {
    const t = scenarioB;
    const active = await mkAcc(t, '1010', 'ASSET', true);
    const deleted = await mkAcc(t, '1020', 'ASSET', true);
    const equity = await mkAcc(t, '3000', 'EQUITY');

    await post(
      t,
      [
        { accountId: active, debit: '5000', credit: '0' },
        { accountId: equity, debit: '0', credit: '5000' },
      ],
      'prior',
    );
    await post(
      t,
      [
        { accountId: deleted, debit: '3000', credit: '0' },
        { accountId: equity, debit: '0', credit: '3000' },
      ],
      'prior',
    );

    await retireSoftDeleted(deleted);
    await post(
      t,
      [
        { accountId: active, debit: '500', credit: '0' },
        { accountId: equity, debit: '0', credit: '500' },
      ],
      'current',
    );

    const cf = await expectStatementsAgree(t, new Decimal('8500'));
    expect(cf.beginningCash).toBe('8000.0000');
    expect(cf.netCashMovement).toBe('500.0000');
    expect(cf.reconciled).toBe(true);
  });

  it('C. mixed active + inactive cash accounts both contribute', async () => {
    const t = scenarioC;
    const active = await mkAcc(t, '1010', 'ASSET', true);
    const inactive = await mkAcc(t, '1020', 'ASSET', true);
    const equity = await mkAcc(t, '3000', 'EQUITY');

    await post(
      t,
      [
        { accountId: active, debit: '5000', credit: '0' },
        { accountId: equity, debit: '0', credit: '5000' },
      ],
      'prior',
    );
    await post(
      t,
      [
        { accountId: inactive, debit: '7000', credit: '0' },
        { accountId: equity, debit: '0', credit: '7000' },
      ],
      'prior',
    );

    await post(
      t,
      [
        { accountId: active, debit: '500', credit: '0' },
        { accountId: equity, debit: '0', credit: '500' },
      ],
      'current',
    );
    await post(
      t,
      [
        { accountId: inactive, debit: '1500', credit: '0' },
        { accountId: equity, debit: '0', credit: '1500' },
      ],
      'current',
    );
    await retireInactive(inactive);

    const cf = await expectStatementsAgree(t, new Decimal('14000'));
    expect(cf.beginningCash).toBe('12000.0000');
    expect(cf.netCashMovement).toBe('2000.0000');
    const codes = cf.operating.rows.map((r) => r.accountCode).sort();
    expect(codes).toEqual(['1010', '1020']);
    expect(cf.reconciled).toBe(true);
  });

  it('D. ALL cash accounts inactive: statement is real, not the zeroed() result', async () => {
    const t = scenarioD;
    const a1 = await mkAcc(t, '1010', 'ASSET', true);
    const a2 = await mkAcc(t, '1020', 'ASSET', true);
    const equity = await mkAcc(t, '3000', 'EQUITY');

    await post(
      t,
      [
        { accountId: a1, debit: '5000', credit: '0' },
        { accountId: equity, debit: '0', credit: '5000' },
      ],
      'prior',
    );
    await post(
      t,
      [
        { accountId: a2, debit: '4000', credit: '0' },
        { accountId: equity, debit: '0', credit: '4000' },
      ],
      'prior',
    );

    await retireInactive(a1);
    await retireInactive(a2);

    const cf = await expectStatementsAgree(t, new Decimal('9000'));
    // The zeroed() short-circuit must NOT fire while cash balances exist.
    expect(cf.endingCash).not.toBe('0.0000');
    expect(cf.beginningCash).not.toBe('0.0000');
    expect(cf.operating.rows.length + cf.transfers.rows.length).toBe(0);
    expect(cf.reconciled).toBe(true);
  });

  it('D2. ALL cash accounts soft-deleted: statement is real, not the zeroed() result', async () => {
    const t = scenarioD2;
    const a1 = await mkAcc(t, '1010', 'ASSET', true);
    const a2 = await mkAcc(t, '1020', 'ASSET', true);
    const equity = await mkAcc(t, '3000', 'EQUITY');

    await post(
      t,
      [
        { accountId: a1, debit: '5000', credit: '0' },
        { accountId: equity, debit: '0', credit: '5000' },
      ],
      'prior',
    );
    await post(
      t,
      [
        { accountId: a2, debit: '4000', credit: '0' },
        { accountId: equity, debit: '0', credit: '4000' },
      ],
      'prior',
    );

    await retireSoftDeleted(a1);
    await retireSoftDeleted(a2);

    const cf = await expectStatementsAgree(t, new Decimal('9000'));
    expect(cf.endingCash).not.toBe('0.0000');
    expect(cf.beginningCash).not.toBe('0.0000');
    expect(cf.reconciled).toBe(true);
  });

  it('E. reversal through a lifecycle-off cash account stays reversal-neutral and visible', async () => {
    const t = scenarioE;
    const active = await mkAcc(t, '1010', 'ASSET', true);
    const inactive = await mkAcc(t, '1020', 'ASSET', true);
    const equity = await mkAcc(t, '3000', 'EQUITY');

    // Opening balances, before the report window.
    await post(
      t,
      [
        { accountId: active, debit: '5000', credit: '0' },
        { accountId: equity, debit: '0', credit: '5000' },
      ],
      'prior',
    );
    await post(
      t,
      [
        { accountId: inactive, debit: '7000', credit: '0' },
        { accountId: equity, debit: '0', credit: '7000' },
      ],
      'prior',
    );

    // A faithful GlEngine reversal shape: its own SALE in the window, reversed
    // in full by a compensating POSTED entry with referenceType='REVERSAL'.
    const sale = await post(
      t,
      [
        { accountId: inactive, debit: '3000', credit: '0' },
        { accountId: equity, debit: '0', credit: '3000' },
      ],
      'current',
    );
    const compensation = await post(
      t,
      [
        { accountId: inactive, debit: '0', credit: '3000' },
        { accountId: equity, debit: '3000', credit: '0' },
      ],
      'current',
      'REVERSAL',
    );
    // Postings must target an ACTIVE account (CR-2), so the retirement happens
    // last — every leg still has to be visible afterwards.
    await prisma.journalEntry.update({
      where: { id: (sale as { id: string }).id },
      data: { status: 'REVERSED' },
    });
    // Bind the compensation to the original so category inheritance resolves.
    await prisma.journalEntry.update({
      where: { id: (compensation as { id: string }).id },
      data: { referenceId: (sale as { id: string }).id },
    });
    await retireInactive(inactive);

    // Positional truth is reversal-neutral (CR-4 + G16-N-8-A): the REVERSED
    // original and the REVERSAL compensation are both excluded, so the reversed
    // 3000 leaves no trace in any position — only the opening 5000 + 7000.
    const cf = await expectStatementsAgree(t, new Decimal('12000'));
    expect(cf.beginningCash).toBe('12000.0000');

    // The MOVEMENT view is the event view: both legs stay enumerated on the
    // retired account, so the +3000 sale and its −3000 compensation are visible
    // and net to zero. Before the fix both were filtered out of the population
    // and the account showed no movement at all.
    const saleRows = cf.operating.rows.filter(
      (r) => r.accountId === inactive && r.referenceType === 'SALE',
    );
    const reversalRows = cf.operating.rows.filter(
      (r) => r.accountId === inactive && r.referenceType === 'REVERSAL',
    );
    expect(saleRows).toHaveLength(1);
    expect(reversalRows).toHaveLength(1);
    expect(saleRows[0]!.amount).toBe('3000.0000');
    // the compensation credits the cash account
    expect(reversalRows[0]!.amount).toBe('-3000.0000');
    // category inheritance unchanged: a REVERSAL of a SALE is OPERATING
    expect(reversalRows[0]!.category).toBe('OPERATING');
    // the pair must net to zero
    expect(cf.netCashMovement).toBe('0.0000');
    expect(cf.endingCash).toBe('12000.0000');
    expect(cf.reconciled).toBe(true);
  });

  it("tenant isolation: another company's cash never appears in this statement", async () => {
    const a = isolationA;
    const peer = isolationPeer;
    const aCash = await mkAcc(a, '1010', 'ASSET', true);
    const aEquity = await mkAcc(a, '3000', 'EQUITY');
    const pCash = await mkAcc(peer, '1010', 'ASSET', true);
    const pEquity = await mkAcc(peer, '3000', 'EQUITY');

    await post(
      a,
      [
        { accountId: aCash, debit: '2000', credit: '0' },
        { accountId: aEquity, debit: '0', credit: '2000' },
      ],
      'prior',
    );
    // Retire A's account so its cash depends on the fixed behaviour, and give
    // the peer a large balance that must stay invisible.
    await retireInactive(aCash);
    await post(
      peer,
      [
        { accountId: pCash, debit: '7777', credit: '0' },
        { accountId: pEquity, debit: '0', credit: '7777' },
      ],
      'prior',
    );

    const cfA = await expectStatementsAgree(a, new Decimal('2000'));
    expect(cfA.endingCash).toBe('2000.0000');
    const aIds = new Set([
      aCash,
      ...(await prisma.chartOfAccount.findMany({
        where: { companyId: a.companyId },
        select: { id: true },
      })).map((r) => r.id),
    ]);
    const cfARows = [
      ...cfA.operating.rows,
      ...cfA.investing.rows,
      ...cfA.financing.rows,
      ...cfA.transfers.rows,
      ...cfA.unclassified.rows,
    ];
    const foreignRows = cfARows.filter((r) => !aIds.has(r.accountId));
    expect(foreignRows).toEqual([]);
    expect(cfA.endingCash).not.toBe('7777.0000');

    // The peer's own statement is unaffected by A's retirement.
    const cfPeer = await cashFlow.getCashFlow({
      companyId: peer.companyId,
      ...cfRange,
    });
    expect(cfPeer.endingCash).toBe('7777.0000');
  });
});
