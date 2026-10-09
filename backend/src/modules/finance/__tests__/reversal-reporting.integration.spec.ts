/**
 * G16-N-8-A — Reversal reporting integrity (REAL PostgreSQL).
 *
 * Proves the canonical reversal semantics end-to-end on the real service
 * graph (real Prisma client, GlEngineService, LedgerQueryService,
 * CashFlowService, repositories, PostingValidationService):
 *
 *   - a GlEngine reversal pair (original REVERSED + POSTED compensation with
 *     referenceType='REVERSAL') is economically NEUTRAL in every POSITION
 *     aggregate (Trial Balance, P&L, Balance Sheet, CF beginning/ending cash)
 *     and reconciles exactly with the AccountBalance snapshot layer;
 *   - the account statement (getLedger) still shows BOTH real legs;
 *   - the cash-flow MOVEMENT section keeps the real compensation movement
 *     with the category inherited from the original;
 *   - entries with a NULL referenceType are NOT swept up by the reversal
 *     exclusion (nullable column + PostgreSQL three-valued logic);
 *   - a second reversal is rejected (CAS + guard);
 *   - tenant isolation holds.
 *
 * Expected values are hardcoded independently — never derived from the
 * production implementation. The EventBus is the only stub (side-effect
 * fan-out only). Conventions follow fiscal-year-close.integration.spec.ts:
 * integration-env imported FIRST, @prisma/client loaded lazily in beforeAll,
 * ordered cleanup (journalEntry -> auditLog -> company -> user).
 */
import {
  hasIntegrationDatabase,
  integrationDatabaseUrl,
} from '../../../infrastructure/idempotency/__tests__/integration-env';

import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { EventBus } from '../../../common/events/event-bus.interface';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestException, ConflictException } from '@nestjs/common';
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

const RUN = `g16n8a-${process.pid}-${Date.now()}`;
const ACTOR_SUFFIX = '@g16-n-8-a.invalid';
const AMOUNT = '250'; // X: original JE = Dr expense 250 / Cr cash 250
const NULL_TYPED_AMOUNT = '400'; // JE with referenceType omitted → NULL column

// G16-N-8-A scope note: GlEngineService.reverse() posts the compensation into
// the ORIGINAL's financial period with entryDate = new Date(). A reversal of
// an entry from any non-current month therefore fails date-in-period
// validation — a REAL pre-existing defect discovered by this suite and
// reported separately (out of approved scope here). All scenarios below use
// the CURRENT month so the reversal path itself is exercisable.
const NOW = new Date();
const CUR_YEAR = NOW.getUTCFullYear();
const CUR_MONTH = NOW.getUTCMonth(); // 0-based
const periodRange = {
  startDate: new Date(Date.UTC(CUR_YEAR, CUR_MONTH, 1)),
  endDate: new Date(Date.UTC(CUR_YEAR, CUR_MONTH + 1, 0, 23, 59, 59, 999)),
};
const cfRange = {
  dateFrom: periodRange.startDate,
  dateTo: periodRange.endDate,
};
// Report windows must cover the current month regardless of when the suite
// runs, so they are derived from CUR_YEAR rather than hardcoded.
const YEAR_START = new Date(Date.UTC(CUR_YEAR, 0, 1));
const YEAR_END = new Date(Date.UTC(CUR_YEAR, 11, 31, 23, 59, 59, 999));

interface Tenant {
  companyId: string;
  actorId: string;
  periodId: string;
  expenseAccountId: string;
  cashAccountId: string;
}

describeDb('G16-N-8-A — reversal reporting integrity (real PostgreSQL)', () => {
  let prisma: PrismaClient;
  let glEngine: GlEngineService;
  let ledgerQuery: LedgerQueryService;
  let cashFlow: CashFlowService;
  let main: Tenant;
  let other: Tenant;
  let nullRef: Tenant;
  let pnlTenant: Tenant;
  let lifecycleTenant: Tenant;
  let g16ModeC: Tenant;
  let g16OneLeg: Tenant;
  let g16Earnings: Tenant;
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

    const period = await prisma.financialPeriod.create({
      data: {
        companyId: company.id,
        name: `${RUN}-p`,
        year: CUR_YEAR,
        month: CUR_MONTH + 1,
        ...periodRange,
        status: 'OPEN',
      },
      select: { id: true },
    });

    const mkAcc = (code: string, type: string, normal: string, cash = false) =>
      prisma.chartOfAccount
        .create({
          data: {
            companyId: company.id,
            code,
            name: `${RUN}-${code}`,
            accountType: type as never,
            normalBalance: normal as never,
            isCashOrBank: cash,
            isActive: true,
          },
          select: { id: true },
        })
        .then((r) => r.id);

    return {
      companyId: company.id,
      actorId: user.id,
      periodId: period.id,
      expenseAccountId: await mkAcc('6100', 'EXPENSE', 'DEBIT'),
      cashAccountId: await mkAcc('1010', 'ASSET', 'DEBIT', true),
    };
  };

  /** Post a real JE through the real engine: Dr expense X / Cr cash X. */
  const postExpense = async (t: Tenant): Promise<string> => {
    const result = await glEngine.post(
      {
        companyId: t.companyId,
        financialPeriodId: t.periodId,
        entryDate: NOW,
        description: `${RUN} expense`,
        referenceType: 'MANUAL',
        createdBy: t.actorId,
        lines: [
          {
            accountId: t.expenseAccountId,
            debit: AMOUNT,
            credit: '0',
            description: 'expense leg',
          },
          {
            accountId: t.cashAccountId,
            debit: '0',
            credit: AMOUNT,
            description: 'cash leg',
          },
        ],
      },
      undefined,
    );
    return result.id;
  };

  const trialBalance = async (companyId: string) =>
    ledgerQuery.getTrialBalance({ companyId, asOfDate: YEAR_END });

  const pnl = async (companyId: string) =>
    ledgerQuery.getPnlReport({
      companyId,
      dateFrom: YEAR_START,
      dateTo: YEAR_END,
    });

  const cashFlowReport = async (companyId: string) =>
    cashFlow.getCashFlow({ companyId, ...cfRange });

  const snapshotOf = async (t: Tenant, accountId: string) => {
    const row = await prisma.accountBalance.findFirst({
      where: {
        companyId: t.companyId,
        accountId,
        financialPeriodId: t.periodId,
      },
    });
    return {
      debit: new Decimal(row?.closingDebit?.toString() ?? '0'),
      credit: new Decimal(row?.closingCredit?.toString() ?? '0'),
    };
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
    ledgerQuery = new LedgerQueryService(ledgerRepo);
    cashFlow = new CashFlowService(
      ledgerRepo,
      new FinancialTransactionsRepository(prismaService),
    );

    main = await seedTenant('main');
    other = await seedTenant('other');
    nullRef = await seedTenant('nullref');
    pnlTenant = await seedTenant('pnl');
    lifecycleTenant = await seedTenant('lifecycle');
    // G16 TB/BS lifecycle tests get DEDICATED tenants: they assert exact
    // totals, so they must not share a company with any other test's postings.
    g16ModeC = await seedTenant('g16modec');
    g16OneLeg = await seedTenant('g16oneleg');
    g16Earnings = await seedTenant('g16earnings');
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

  it('reversal is economically neutral in positions and visible in details/movements', async () => {
    const t = main;

    // ── 1. POSTED original JE: Dr expense 250 / Cr cash 250 ──────────
    const originalId = await postExpense(t);
    const original = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: originalId },
      include: { lines: true },
    });
    expect(original.status).toBe('POSTED');

    // ── 2-3. pre-reversal state: aggregate includes the original ──────
    const before = await trialBalance(t.companyId);
    const expenseBefore = before.rows.find(
      (r) => r.accountId === t.expenseAccountId,
    );
    expect(expenseBefore).toBeDefined();
    expect(
      new Decimal(expenseBefore!.debit.toString()).equals(new Decimal(AMOUNT)),
    ).toBe(true);
    const pnlBefore = await pnl(t.companyId);
    // Account 6100 → 6xxx = operating expenses bucket (5xxx/6xxx prefix rule).
    expect(
      new Decimal(pnlBefore.expenses.toString()).equals(new Decimal(AMOUNT)),
    ).toBe(true);

    const cfBefore = await cashFlowReport(t.companyId);
    expect(cfBefore.beginningCash).toBe('0.0000');
    // Cash leg: Cr 250 → outflow → ending cash −250.
    expect(cfBefore.endingCash).toBe('-250.0000');

    const snapBefore = await snapshotOf(t, t.expenseAccountId);
    expect(snapBefore.debit.equals(new Decimal(AMOUNT))).toBe(true);

    // ── 4. reverse the original ───────────────────────────────────────
    const reversal = await glEngine.reverse(
      originalId,
      t.companyId,
      t.actorId,
      'audit test',
    );

    // ── 5. lifecycle: original REVERSED, compensation POSTED/REVERSAL ─
    const afterOrig = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: originalId },
    });
    expect(afterOrig.status).toBe('REVERSED');
    const compensation = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: reversal.reversalEntryId },
      include: { lines: true },
    });
    expect(compensation.status).toBe('POSTED');
    expect(compensation.referenceType).toBe('REVERSAL');
    expect(compensation.referenceId).toBe(originalId);
    expect(compensation.lines).toHaveLength(2);

    // ── 6. positions return to pre-original economic state (net 0) ────
    const after = await trialBalance(t.companyId);
    const expenseAfter = after.rows.find(
      (r) => r.accountId === t.expenseAccountId,
    );
    expect(expenseAfter).toBeDefined();
    expect(
      new Decimal(expenseAfter!.debit.toString())
        .sub(expenseAfter!.credit.toString())
        .equals(new Decimal(0)),
    ).toBe(true);

    const pnlAfter = await pnl(t.companyId);
    expect(new Decimal(pnlAfter.cogs.toString()).equals(new Decimal(0))).toBe(
      true,
    );
    expect(
      new Decimal(pnlAfter.expenses.toString()).equals(new Decimal(0)),
    ).toBe(true);

    // ── 7. AccountBalance matches the journal aggregate (reconciliation)
    const snapAfter = await snapshotOf(t, t.expenseAccountId);
    // The compensation posted Cr expense 250 through updateAccountBalances.
    expect(snapAfter.debit.toString()).toBe(snapBefore.debit.toString());
    expect(snapAfter.credit.equals(new Decimal(AMOUNT))).toBe(true);
    // Snapshot net == journal aggregate net (both zero for the pair).
    expect(
      snapAfter.debit
        .sub(snapAfter.credit)
        .equals(
          new Decimal(expenseAfter!.debit.toString()).sub(
            expenseAfter!.credit.toString(),
          ),
        ),
    ).toBe(true);

    // ── 8-10. Trial Balance == P&L == Balance Sheet consistency ───────
    const bs = await ledgerQuery.getBalanceSheet({
      companyId: t.companyId,
      asOfDate: YEAR_END,
    });
    const bsAsset = bs.assets.rows.find((r) => r.accountId === t.cashAccountId);
    expect(
      new Decimal(bsAsset!.balance.toString()).equals(new Decimal(0)),
    ).toBe(true);

    // ── 11. CF positions neutral again ────────────────────────────────
    const cfAfter = await cashFlowReport(t.companyId);
    expect(cfAfter.beginningCash).toBe('0.0000');
    expect(cfAfter.endingCash).toBe('0.0000');

    // ── 12. CF movement shows BOTH legs of the reversal and nets to zero ──
    // G16-N-8-B. Previously only the compensation appeared: the reversed
    // ORIGINAL's outflow leg was dropped by POSTED-only enumeration, leaving a
    // phantom one-sided +250 inflow whose total could never foot against the
    // (correct) reversal-neutral positions, leaving `reconciled` false.
    //
    // Movement is now the event view and enumerates POSTED ∪ REVERSED, so the
    // pair renders as two opposite rows: the original SALE/MANUAL leg
    // (Cr cash 250 → −250) and the REVERSAL compensation (Dr cash 250 → +250).
    const allRows = [
      ...cfAfter.operating.rows,
      ...cfAfter.unclassified.rows,
      ...cfAfter.transfers.rows,
    ];
    const reversalRows = allRows.filter((r) => r.referenceType === 'REVERSAL');
    expect(reversalRows).toHaveLength(1);
    expect(
      new Decimal(reversalRows[0]!.inflow).equals(new Decimal(AMOUNT)),
    ).toBe(true);

    // The original leg is back, carrying its own referenceType ('MANUAL') and
    // the opposite sign.
    const originalRows = allRows.filter(
      (r) => r.referenceType === 'MANUAL' && r.accountId === t.cashAccountId,
    );
    expect(originalRows).toHaveLength(1);
    expect(
      new Decimal(originalRows[0]!.outflow).equals(new Decimal(AMOUNT)),
    ).toBe(true);

    // Both legs are present and they cancel.
    expect(new Decimal(cfAfter.netCashMovement).equals(new Decimal(0))).toBe(
      true,
    );
    // RESIDUAL B (G15-07-C3-C enumeration semantics) is now RESOLVED for the
    // same-window case: movement foots with positions and `reconciled` is true
    // because the missing information was restored — NOT because the check was
    // weakened. The formula is unchanged:
    //   endingCash === beginningCash + netCashMovement
    expect(
      new Decimal(cfAfter.endingCash).equals(
        new Decimal(cfAfter.beginningCash).add(
          new Decimal(cfAfter.netCashMovement),
        ),
      ),
    ).toBe(true);
    expect(cfAfter.reconciled).toBe(true);

    // ── statement (getLedger) shows BOTH legs with net-zero running balance
    const ledger = await ledgerQuery.getLedger({
      companyId: t.companyId,
      accountId: t.expenseAccountId,
    });
    expect(ledger.items).toHaveLength(2);
    expect(ledger.items[ledger.items.length - 1]!.runningBalance).toBe(
      '0.0000',
    );

    // ── 13. second reversal rejected (guard/CAS) ─────────────────────
    await expect(
      glEngine.reverse(originalId, t.companyId, t.actorId, 'again'),
    ).rejects.toThrow(ConflictException);
    await expect(
      glEngine.reverse(
        compensation.id,
        t.companyId,
        t.actorId,
        'reverse the reversal',
      ),
    ).rejects.toThrow(BadRequestException);

    // ── 14. tenant isolation: other company sees nothing ─────────────
    const tbOther = await trialBalance(other.companyId);
    expect(
      tbOther.rows.every(
        (r) =>
          new Decimal(r.debit.toString()).isZero() &&
          new Decimal(r.credit.toString()).isZero(),
      ),
    ).toBe(true);
    await expect(
      glEngine.reverse(originalId, other.companyId, other.actorId, 'foreign'),
    ).rejects.toThrow();
  });

  it('multi-account reversal and fiscal-close consistency with snapshots', async () => {
    const t = other; // reuse the second tenant for the multi-account case

    // Multi-account original: Dr expense-1 100 + Dr expense-2 150 / Cr cash 250.
    const expense2 = await prisma.chartOfAccount
      .create({
        data: {
          companyId: t.companyId,
          code: '6200',
          name: `${RUN}-6200`,
          accountType: 'EXPENSE',
          normalBalance: 'DEBIT',
          isActive: true,
        },
        select: { id: true },
      })
      .then((r) => r.id);

    const originalId = await glEngine
      .post(
        {
          companyId: t.companyId,
          financialPeriodId: t.periodId,
          entryDate: NOW,
          description: `${RUN} multi-account`,
          referenceType: 'MANUAL',
          createdBy: t.actorId,
          lines: [
            {
              accountId: t.expenseAccountId,
              debit: '100',
              credit: '0',
              description: 'e1',
            },
            {
              accountId: expense2,
              debit: '150',
              credit: '0',
              description: 'e2',
            },
            {
              accountId: t.cashAccountId,
              debit: '0',
              credit: '250',
              description: 'cash',
            },
          ],
        },
        undefined,
      )
      .then((r) => r.id);

    // Fiscal-year-close consistency precondition: snapshots mirror journals.
    const bal1 = await prisma.accountBalance.findFirst({
      where: {
        companyId: t.companyId,
        accountId: t.expenseAccountId,
        financialPeriodId: t.periodId,
      },
    });
    expect(
      new Decimal(bal1!.closingDebit.toString()).equals(new Decimal(100)),
    ).toBe(true);
    const balCash = await prisma.accountBalance.findFirst({
      where: {
        companyId: t.companyId,
        accountId: t.cashAccountId,
        financialPeriodId: t.periodId,
      },
    });
    expect(
      new Decimal(balCash!.closingCredit.toString()).equals(new Decimal(250)),
    ).toBe(true);

    // Reverse: every account must return to zero in BOTH layers.
    await glEngine.reverse(
      originalId,
      t.companyId,
      t.actorId,
      'multi-account reversal',
    );

    const tb = await trialBalance(t.companyId);
    for (const accountId of [t.expenseAccountId, expense2, t.cashAccountId]) {
      const row = tb.rows.find((r) => r.accountId === accountId);
      const net = new Decimal(row!.debit.toString()).sub(
        row!.credit.toString(),
      );
      expect(net.isZero()).toBe(true);
    }
    // Snapshot layer agrees for every account.
    for (const accountId of [t.expenseAccountId, expense2, t.cashAccountId]) {
      const s = await snapshotOf(t, accountId);
      expect(s.debit.sub(s.credit).isZero()).toBe(true);
    }
  });

  it('NULL referenceType entries survive positional aggregates while REVERSAL compensations do not', async () => {
    // Regression guard for the nullable-column hazard: referenceType is
    // `String?` and GlEngineService stores `input.referenceType ?? null`.
    // Expressing the reversal exclusion as a bare `{ not: 'REVERSAL' }`
    // (SQL `<>`, `NOT IN`, or `NOT (=)`) makes PostgreSQL three-valued logic
    // DROP those NULL rows from Trial Balance / P&L / Balance Sheet / cash
    // positions. Only referenceType='REVERSAL' may be excluded.
    const t = nullRef;

    const expenseNull = await prisma.chartOfAccount
      .create({
        data: {
          companyId: t.companyId,
          code: '6300',
          name: `${RUN}-6300`,
          accountType: 'EXPENSE',
          normalBalance: 'DEBIT',
          isActive: true,
        },
        select: { id: true },
      })
      .then((r) => r.id);

    // JE #1 — posted WITHOUT a referenceType → referenceType IS NULL.
    const nullTypedId = await glEngine
      .post(
        {
          companyId: t.companyId,
          financialPeriodId: t.periodId,
          entryDate: NOW,
          description: `${RUN} no reference type`,
          createdBy: t.actorId,
          lines: [
            {
              accountId: expenseNull,
              debit: NULL_TYPED_AMOUNT,
              credit: '0',
              description: 'e',
            },
            {
              accountId: t.cashAccountId,
              debit: '0',
              credit: NULL_TYPED_AMOUNT,
              description: 'cash',
            },
          ],
        },
        undefined,
      )
      .then((r) => r.id);

    const nullTyped = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: nullTypedId },
    });
    expect(nullTyped.status).toBe('POSTED');
    expect(nullTyped.referenceType).toBeNull();

    // JE #2 — ordinary MANUAL entry that will be reversed.
    const reversedId = await glEngine
      .post(
        {
          companyId: t.companyId,
          financialPeriodId: t.periodId,
          entryDate: NOW,
          description: `${RUN} to be reversed`,
          referenceType: 'MANUAL',
          createdBy: t.actorId,
          lines: [
            {
              accountId: t.expenseAccountId,
              debit: '600',
              credit: '0',
              description: 'e',
            },
            {
              accountId: t.cashAccountId,
              debit: '0',
              credit: '600',
              description: 'cash',
            },
          ],
        },
        undefined,
      )
      .then((r) => r.id);

    await glEngine.reverse(
      reversedId,
      t.companyId,
      t.actorId,
      'scope isolation',
    );

    const tb = await trialBalance(t.companyId);
    const nullRow = tb.rows.find((r) => r.accountId === expenseNull);
    expect(
      new Decimal(nullRow!.debit.toString()).equals(
        new Decimal(NULL_TYPED_AMOUNT),
      ),
    ).toBe(true);
    const reversedRow = tb.rows.find((r) => r.accountId === t.expenseAccountId);
    expect(
      new Decimal(reversedRow!.debit.toString())
        .sub(reversedRow!.credit.toString())
        .isZero(),
    ).toBe(true);

    // P&L expenses: only the NULL-typed entry counts (6xxx bucket).
    const report = await pnl(t.companyId);
    expect(
      new Decimal(report.expenses.toString()).equals(
        new Decimal(NULL_TYPED_AMOUNT),
      ),
    ).toBe(true);

    // Balance sheet: cash net = −NULL_TYPED_AMOUNT (reversed pair contributes 0).
    const bs = await ledgerQuery.getBalanceSheet({
      companyId: t.companyId,
      asOfDate: YEAR_END,
    });
    const cashRow = bs.assets.rows.find((r) => r.accountId === t.cashAccountId);
    expect(
      new Decimal(cashRow!.balance.toString()).equals(
        new Decimal(-1).mul(new Decimal(NULL_TYPED_AMOUNT)),
      ),
    ).toBe(true);

    // Cash positions: NULL-typed credit survives, reversal pair nets to zero.
    const cf = await cashFlowReport(t.companyId);
    expect(cf.beginningCash).toBe('0.0000');
    expect(cf.endingCash).toBe(
      new Decimal(-1).mul(new Decimal(NULL_TYPED_AMOUNT)).toFixed(4),
    );
  });

  // ═══════════════════════════════════════════════════════════════════
  // G16-N-8-B — P&L header ⇄ daily parity on REAL PostgreSQL
  // ═══════════════════════════════════════════════════════════════════

  describe('G16-N-8-B — P&L daily shares the canonical population', () => {
    const dailySum = (
      daily: Record<
        string,
        { revenue: Decimal; cogs: Decimal; expenses: Decimal }
      >,
    ) =>
      Object.values(daily).reduce(
        (acc, d) => ({
          revenue: acc.revenue.add(d.revenue),
          cogs: acc.cogs.add(d.cogs),
          expenses: acc.expenses.add(d.expenses),
        }),
        {
          revenue: new Decimal(0),
          cogs: new Decimal(0),
          expenses: new Decimal(0),
        },
      );

    /** Direct journal write used only to materialise a referenceType taxonomy
     *  that belongs to another domain module (FT / supplier payment) without
     *  dragging that module's posting pipeline into this suite. */
    let rawSeq = 0;
    const postRaw = async (
      t: Tenant,
      referenceType: string | null,
      referenceId: string | null,
      lines: { accountId: string; debit: string; credit: string }[],
    ): Promise<string> => {
      const entry = await prisma.journalEntry.create({
        data: {
          companyId: t.companyId,
          financialPeriodId: t.periodId,
          entryNumber: 900 + rawSeq++,
          entryDate: NOW,
          description: `${RUN} raw ${referenceType ?? 'NULL'}`,
          referenceType,
          referenceId,
          status: 'POSTED',
          totalDebit: new Decimal(
            lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4),
          ),
          totalCredit: new Decimal(
            lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(4),
          ),
          createdBy: t.actorId,
          postedAt: NOW,
          lines: { create: lines },
        },
        select: { id: true },
      });
      return entry.id;
    };

    const mkAcc = async (
      t: Tenant,
      code: string,
      accountType: string,
    ): Promise<string> =>
      prisma.chartOfAccount
        .create({
          data: {
            companyId: t.companyId,
            code,
            name: `${RUN}-${code}`,
            accountType: accountType as never,
            normalBalance: (accountType === 'REVENUE'
              ? 'CREDIT'
              : 'DEBIT') as never,
            isActive: true,
          },
          select: { id: true },
        })
        .then((r) => r.id);

    it('header totals equal the sum of daily buckets across every referenceType class', async () => {
      const t = pnlTenant;
      const revenueAcc = await mkAcc(t, '4000', 'REVENUE');
      const cogsAcc = await mkAcc(t, '5000', 'EXPENSE');
      const expenseAcc = await mkAcc(t, '6600', 'EXPENSE');

      // 1. normal POSTED sale: Dr cash 500 / Cr revenue 500
      await glEngine.post(
        {
          companyId: t.companyId,
          financialPeriodId: t.periodId,
          entryDate: NOW,
          description: `${RUN} sale`,
          referenceType: 'SALE',
          createdBy: t.actorId,
          lines: [
            {
              accountId: t.cashAccountId,
              debit: '500',
              credit: '0',
              description: 'cash',
            },
            {
              accountId: revenueAcc,
              debit: '0',
              credit: '500',
              description: 'rev',
            },
          ],
        },
        undefined,
      );

      // 2. NULL referenceType expense: Dr expense 100 / Cr cash 100
      const nullTyped = await glEngine
        .post(
          {
            companyId: t.companyId,
            financialPeriodId: t.periodId,
            entryDate: NOW,
            description: `${RUN} null ref`,
            createdBy: t.actorId,
            lines: [
              {
                accountId: expenseAcc,
                debit: '100',
                credit: '0',
                description: 'e',
              },
              {
                accountId: t.cashAccountId,
                debit: '0',
                credit: '100',
                description: 'cash',
              },
            ],
          },
          undefined,
        )
        .then((r) => r.id);
      expect(
        (
          await prisma.journalEntry.findUniqueOrThrow({
            where: { id: nullTyped },
          })
        ).referenceType,
      ).toBeNull();

      // 3. SUPPLIER_PAYMENT_REVERSAL leg pair (originals stay POSTED in that
      //    lifecycle) — both legs must remain included.
      await postRaw(t, 'SUPPLIER_PAYMENT', 'pay-1', [
        { accountId: t.cashAccountId, debit: '0', credit: '40' },
        { accountId: expenseAcc, debit: '40', credit: '0' },
      ]);
      await postRaw(t, 'SUPPLIER_PAYMENT_REVERSAL', 'pay-1', [
        { accountId: t.cashAccountId, debit: '40', credit: '0' },
        { accountId: expenseAcc, debit: '0', credit: '40' },
      ]);

      // 4. FINANCIAL_TRANSACTION_REVERSAL — must remain included.
      await postRaw(t, 'FINANCIAL_TRANSACTION_REVERSAL', 'ft-1', [
        { accountId: cogsAcc, debit: '0', credit: '60' },
        { accountId: t.cashAccountId, debit: '60', credit: '0' },
      ]);

      // 5. a GlEngine reversal that must be invisible to BOTH header and daily
      const toReverse = await glEngine
        .post(
          {
            companyId: t.companyId,
            financialPeriodId: t.periodId,
            entryDate: NOW,
            description: `${RUN} to reverse`,
            referenceType: 'MANUAL',
            createdBy: t.actorId,
            lines: [
              {
                accountId: expenseAcc,
                debit: '250',
                credit: '0',
                description: 'e',
              },
              {
                accountId: t.cashAccountId,
                debit: '0',
                credit: '250',
                description: 'cash',
              },
            ],
          },
          undefined,
        )
        .then((r) => r.id);
      await glEngine.reverse(toReverse, t.companyId, t.actorId, 'parity');

      const report = await pnl(t.companyId);
      const summed = dailySum(report.daily);

      // revenue: only the 500 sale
      expect(report.revenue.equals(new Decimal(500))).toBe(true);
      // COGS: the FT reversal credits 60 → net −60
      expect(report.cogs.equals(new Decimal(-60))).toBe(true);
      // expenses: 100 (NULL-typed) + 40 − 40 (supplier pair) + 0 (reversed pair)
      expect(report.expenses.equals(new Decimal(100))).toBe(true);

      // PARITY — the actual G16-N-8-B invariant.
      expect(summed.revenue.equals(report.revenue)).toBe(true);
      expect(summed.cogs.equals(report.cogs)).toBe(true);
      expect(summed.expenses.equals(report.expenses)).toBe(true);

      // The daily series is non-empty and contains real days.
      expect(Object.keys(report.daily).length).toBeGreaterThan(0);
    });

    it('tenant isolation: daily never sees another company population', async () => {
      const mine = await pnl(lifecycleTenant.companyId);
      const theirs = await pnl(pnlTenant.companyId);

      // The P&L tenant posted entries; the lifecycle tenant posted none yet.
      expect(Object.keys(mine.daily)).toHaveLength(0);
      expect(mine.revenue.equals(new Decimal(0))).toBe(true);
      expect(mine.expenses.equals(new Decimal(0))).toBe(true);
      // ...and the P&L tenant's own data is intact and unaffected.
      expect(theirs.revenue.equals(new Decimal(500))).toBe(true);
    });
  });

  describe('G16-N-8-B — account lifecycle must not gate historical amounts', () => {
    const mkAcc = async (
      t: Tenant,
      code: string,
      accountType: string,
    ): Promise<string> =>
      prisma.chartOfAccount
        .create({
          data: {
            companyId: t.companyId,
            code,
            name: `${RUN}-${code}`,
            accountType: accountType as never,
            normalBalance: 'DEBIT' as never,
            isActive: true,
          },
          select: { id: true },
        })
        .then((r) => r.id);

    it('INACTIVE and SOFT-DELETED historical accounts stay in header AND daily; inactive 5xxx stays COGS', async () => {
      const t = lifecycleTenant;
      const inactiveExpense = await mkAcc(t, '6800', 'EXPENSE');
      const softDeletedExpense = await mkAcc(t, '6900', 'EXPENSE');
      const inactiveCogs = await mkAcc(t, '5900', 'EXPENSE');

      const post = async (accountId: string, amount: string) =>
        glEngine.post(
          {
            companyId: t.companyId,
            financialPeriodId: t.periodId,
            entryDate: NOW,
            description: `${RUN} lifecycle`,
            referenceType: 'MANUAL',
            createdBy: t.actorId,
            lines: [
              { accountId, debit: amount, credit: '0', description: 'e' },
              {
                accountId: t.cashAccountId,
                debit: '0',
                credit: amount,
                description: 'cash',
              },
            ],
          },
          undefined,
        );

      await post(inactiveExpense, '30');
      await post(softDeletedExpense, '70');
      await post(inactiveCogs, '50');

      // Deactivate / soft-delete AFTER posting — the historical lines must
      // survive. Account lifecycle governs future posting and API visibility,
      // never historical accounting.
      await prisma.chartOfAccount.update({
        where: { id: inactiveExpense },
        data: { isActive: false },
      });
      await prisma.chartOfAccount.update({
        where: { id: inactiveCogs },
        data: { isActive: false },
      });
      await prisma.chartOfAccount.update({
        where: { id: softDeletedExpense },
        data: { deletedAt: new Date() },
      });

      const report = await pnl(t.companyId);
      const summed = Object.values(report.daily).reduce(
        (acc, d) => ({
          revenue: acc.revenue.add(d.revenue),
          cogs: acc.cogs.add(d.cogs),
          expenses: acc.expenses.add(d.expenses),
        }),
        {
          revenue: new Decimal(0),
          cogs: new Decimal(0),
          expenses: new Decimal(0),
        },
      );

      // 30 (inactive) + 70 (soft-deleted) as operating expenses.
      expect(report.expenses.equals(new Decimal(100))).toBe(true);
      // 50 on an INACTIVE 5xxx is still COGS — never reclassified as expense.
      expect(report.cogs.equals(new Decimal(50))).toBe(true);
      // ...and daily agrees on both, so parity holds for historical accounts.
      expect(summed.expenses.equals(report.expenses)).toBe(true);
      expect(summed.cogs.equals(report.cogs)).toBe(true);
    });
  });
  // ═══════════════════════════════════════════════════════════════════
  // G16 — Trial Balance / Balance Sheet historical-account lifecycle
  // CR-1: JournalLines are accounting history; isActive/deletedAt gate
  // posting (CR-2) and API visibility (CR-3), never financial amounts.
  // ═══════════════════════════════════════════════════════════════════

  describe('G16 — TB/BS keep historical amounts after account retirement', () => {
    const LIFECYCLE_AMOUNT = '5000';

    const mkAcc = async (
      t: Tenant,
      code: string,
      accountType: string,
    ): Promise<string> =>
      prisma.chartOfAccount
        .create({
          data: {
            companyId: t.companyId,
            code,
            name: `${RUN}-${code}`,
            accountType: accountType as never,
            normalBalance: (accountType === 'REVENUE' ||
            accountType === 'LIABILITY' ||
            accountType === 'EQUITY'
              ? 'CREDIT'
              : 'DEBIT') as never,
            isActive: true,
          },
          select: { id: true },
        })
        .then((r) => r.id);

    const accountIdsOf = async (t: Tenant): Promise<Set<string>> =>
      new Set(
        (
          await prisma.chartOfAccount.findMany({
            where: { companyId: t.companyId },
            select: { id: true },
          })
        ).map((r) => r.id),
      );

    /** Retire an account exactly as ChartOfAccountsService does. */
    const retire = async (id: string, hard = true) =>
      prisma.chartOfAccount.update({
        where: { id },
        data: hard
          ? { isActive: false, deletedAt: new Date() }
          : { isActive: false },
      });

    const post = async (
      t: Tenant,
      lines: { accountId: string; debit: string; credit: string }[],
    ) =>
      glEngine.post(
        {
          companyId: t.companyId,
          financialPeriodId: t.periodId,
          entryDate: NOW,
          description: `${RUN} lifecycle`,
          referenceType: 'MANUAL',
          createdBy: t.actorId,
          lines: lines.map((l) => ({ ...l, description: 'leg' })),
        },
        undefined,
      );

    it('Mode C — retiring BOTH legs keeps 5000/5000 and the balance sheet balances with real amounts', async () => {
      const t = g16ModeC;
      const asset = await mkAcc(t, '1500', 'ASSET');
      const equity = await mkAcc(t, '3000', 'EQUITY');

      // Real GL posting: Dr 1500 = 5000 / Cr 3000 = 5000
      await post(t, [
        { accountId: asset, debit: LIFECYCLE_AMOUNT, credit: '0' },
        { accountId: equity, debit: '0', credit: LIFECYCLE_AMOUNT },
      ]);

      // Sanity: before retirement the report is correct.
      const beforeTb = await ledgerQuery.getTrialBalance({
        companyId: t.companyId,
        asOfDate: YEAR_END,
      });
      expect(
        new Decimal(beforeTb.totalDebit).equals(new Decimal(LIFECYCLE_AMOUNT)),
      ).toBe(true);

      // Retire BOTH legs — inactive AND soft-deleted.
      await retire(asset);
      await retire(equity);

      // Pre-G16 this returned 0 rows, Dr 0 / Cr 0 and still "balanced".
      const tb = await ledgerQuery.getTrialBalance({
        companyId: t.companyId,
        asOfDate: YEAR_END,
      });

      // seedTenant also provisions 1010/6100 per tenant; assert OUR two
      // accounts are present rather than pinning the whole row set.
      expect(tb.rows.map((r) => r.accountId)).toEqual(
        expect.arrayContaining([asset, equity]),
      );
      expect(
        new Decimal(tb.totalDebit).equals(new Decimal(LIFECYCLE_AMOUNT)),
      ).toBe(true);
      expect(
        new Decimal(tb.totalCredit).equals(new Decimal(LIFECYCLE_AMOUNT)),
      ).toBe(true);
      // The exact signature of the old defect must be unreachable.
      expect(new Decimal(tb.totalDebit).isZero()).toBe(false);
      expect(new Decimal(tb.totalCredit).isZero()).toBe(false);

      const bs = await ledgerQuery.getBalanceSheet({
        companyId: t.companyId,
        asOfDate: YEAR_END,
      });
      const assetRow = bs.assets.rows.find((r) => r.accountId === asset);
      const equityRow = bs.equity.rows.find((r) => r.accountId === equity);
      expect(assetRow).toBeDefined();
      expect(equityRow).toBeDefined();
      expect(
        new Decimal(assetRow!.balance).equals(new Decimal(LIFECYCLE_AMOUNT)),
      ).toBe(true);
      expect(
        new Decimal(equityRow!.balance).equals(new Decimal(LIFECYCLE_AMOUNT)),
      ).toBe(true);
      expect(bs.balanced).toBe(true);
      expect(new Decimal(bs.assets.total).isZero()).toBe(false);
    });

    it('retiring only ONE leg still yields a balanced, fully-valued statement', async () => {
      const t = g16OneLeg;
      const asset = await mkAcc(t, '1600', 'ASSET');
      const equity = await mkAcc(t, '3100', 'EQUITY');

      await post(t, [
        { accountId: asset, debit: LIFECYCLE_AMOUNT, credit: '0' },
        { accountId: equity, debit: '0', credit: LIFECYCLE_AMOUNT },
      ]);
      await retire(equity, false); // inactive only, still visible

      const tb = await ledgerQuery.getTrialBalance({
        companyId: t.companyId,
        asOfDate: YEAR_END,
      });
      expect(
        new Decimal(tb.totalDebit).equals(new Decimal(LIFECYCLE_AMOUNT)),
      ).toBe(true);
      expect(
        new Decimal(tb.totalCredit).equals(new Decimal(LIFECYCLE_AMOUNT)),
      ).toBe(true);

      const bs = await ledgerQuery.getBalanceSheet({
        companyId: t.companyId,
        asOfDate: YEAR_END,
      });
      expect(bs.balanced).toBe(true);
      expect(new Decimal(bs.assets.total).isZero()).toBe(false);
    });

    it('retiring revenue + expense leaves currentEarnings unchanged', async () => {
      const t = g16Earnings;
      const revenue = await mkAcc(t, '4100', 'REVENUE');
      const expense = await mkAcc(t, '6400', 'EXPENSE');

      // Balanced journal: Cr revenue 3000 / Dr expense 1000 / Dr asset 2000.
      const asset = await mkAcc(t, '1700', 'ASSET');
      await post(t, [
        { accountId: revenue, debit: '0', credit: '3000' },
        { accountId: expense, debit: '1000', credit: '0' },
        { accountId: asset, debit: '2000', credit: '0' },
      ]);

      const earningsBefore = new Decimal(
        (
          await ledgerQuery.getBalanceSheet({
            companyId: t.companyId,
            asOfDate: YEAR_END,
          })
        ).currentEarnings,
      );

      await retire(revenue);
      await retire(expense, false);

      const bsAfter = await ledgerQuery.getBalanceSheet({
        companyId: t.companyId,
        asOfDate: YEAR_END,
      });

      // Retirement must not delete revenue/expense from the earnings figure.
      expect(new Decimal(bsAfter.currentEarnings).equals(earningsBefore)).toBe(
        true,
      );
      expect(
        new Decimal(bsAfter.currentEarnings).equals(new Decimal(2000)),
      ).toBe(true);
      // ...and neither appears as a balance-sheet row.
      expect(
        [
          ...bsAfter.assets.rows,
          ...bsAfter.liabilities.rows,
          ...bsAfter.equity.rows,
        ].map((r) => r.accountId),
      ).not.toContain(revenue);
    });

    it("tenant isolation: one tenant's accounts never appear in another's statement", async () => {
      const a = g16Earnings; // retired revenue/expense + posted 1700/4100/6400
      const b = g16ModeC; // retired 1500/3000 + posted 5000

      const aIdsInA = await accountIdsOf(a);
      const bIdsInB = await accountIdsOf(b);

      const tbA = await ledgerQuery.getTrialBalance({
        companyId: a.companyId,
        asOfDate: YEAR_END,
      });
      const tbB = await ledgerQuery.getTrialBalance({
        companyId: b.companyId,
        asOfDate: YEAR_END,
      });
      const rowsA = new Set(tbA.rows.map((r) => r.accountId));
      const rowsB = new Set(tbB.rows.map((r) => r.accountId));

      // Each company sees only its own accounts — no cross-company leakage in
      // either direction, including for accounts retired in the other tenant.
      expect([...rowsA].filter((id) => bIdsInB.has(id))).toEqual([]);
      expect([...rowsB].filter((id) => aIdsInA.has(id))).toEqual([]);
      // Sanity: both statements are non-empty, so the assertion above is real.
      expect(rowsA.size).toBeGreaterThan(0);
      expect(rowsB.size).toBeGreaterThan(0);
    });
  });
});
