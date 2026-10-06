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

    // ── 12. CF movement still shows the real reversal movement ───────
    // The reversal compensation (Dr cash 250) remains visible as a real
    // cash movement with the category inherited from the original.
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

    // DOCUMENTED RESIDUAL (pre-existing G15-07-C3-C enumeration semantics,
    // out of G16-N-8-A scope): findCashJournalEntries enumerates POSTED
    // entries only, so after a reversal the reversed original's outflow leg
    // drops out of the movement partitions while its compensation remains.
    // Movement totals therefore do NOT foot to (ending − beginning) for a
    // period containing a GlEngine reversal. Positions themselves are
    // correct (the fix under test); the movement/position footing gap is a
    // separate residual finding, reported to the workstream owner.
    expect(
      new Decimal(cfAfter.netCashMovement).equals(new Decimal(AMOUNT)),
    ).toBe(true);

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
});
