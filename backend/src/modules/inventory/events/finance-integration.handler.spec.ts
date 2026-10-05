import { Test, TestingModule } from '@nestjs/testing';
import { InventoryFinanceHandler } from './finance-integration.handler';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

/**
 * Regression tests for the accounting direction of inventory adjustments
 * (v1.1.1 Critical fix).
 *
 * Invariant:
 * - Increase:  Dr Inventory (1300) / Cr Inventory Adjustment (5100)
 * - Decrease:  Dr Inventory Adjustment (5100) / Cr Inventory (1300)
 * - Every journal must be balanced (debit == credit).
 */
describe('InventoryFinanceHandler — journal direction', () => {
  let handler: InventoryFinanceHandler;
  let glEngine: { post: jest.Mock };
  let tx: Record<string, any>;

  const ACCOUNTS = {
    INVENTORY: 'inv-1300',
    ADJUSTMENT: 'adj-5100',
  };

  const createEvent = (overrides: Record<string, any> = {}) => ({
    eventName: 'inventory.adjusted',
    // G16-N-4 P2: the handler uses eventId as the journal clientOperationId.
    eventId: 'evt-1',
    payload: {
      productId: 'prod-1',
      companyId: 'company-1',
      warehouseId: 'wh-1',
      quantity: 0,
      beforeQuantity: 10,
      afterQuantity: 10,
      reason: 'manual count',
      adjustedBy: 'user-1',
      unitCost: '1000',
      ...overrides,
    },
  });

  beforeEach(async () => {
    glEngine = { post: jest.fn().mockResolvedValue({ id: 'je-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryFinanceHandler,
        { provide: PrismaService, useValue: {} },
        { provide: GlEngineService, useValue: glEngine },
        // G16-F: the handler now persists GL skip records through the
        // existing AuditLogService — stub it for the happy-path specs here.
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    handler = module.get<InventoryFinanceHandler>(InventoryFinanceHandler);

    tx = {
      journalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      chartOfAccount: {
        findMany: jest.fn().mockResolvedValue([
          { id: ACCOUNTS.INVENTORY, code: '1300' },
          { id: ACCOUNTS.ADJUSTMENT, code: '5100' },
        ]),
      },
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'fp-1',
          status: 'OPEN',
        }),
      },
    };
  });

  const postedLines = () =>
    (
      glEngine.post.mock.calls[0][0] as {
        lines: Array<{ accountId: string; debit: string; credit: string }>;
      }
    ).lines;

  it('increase posts Dr Inventory / Cr Adjustment', async () => {
    await handler.handle(
      createEvent({ beforeQuantity: 10, afterQuantity: 15 }),
      { transactionClient: tx },
    );

    const lines = postedLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      accountId: ACCOUNTS.INVENTORY,
      debit: '5000',
      credit: '0',
      description: expect.any(String),
    });
    expect(lines[1]).toEqual({
      accountId: ACCOUNTS.ADJUSTMENT,
      debit: '0',
      credit: '5000',
      description: expect.any(String),
    });
  });

  it('decrease posts Dr Adjustment / Cr Inventory (v1.1.1 fix)', async () => {
    await handler.handle(
      createEvent({ beforeQuantity: 10, afterQuantity: 7 }),
      { transactionClient: tx },
    );

    const lines = postedLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      accountId: ACCOUNTS.INVENTORY,
      debit: '0',
      credit: '3000',
      description: expect.any(String),
    });
    expect(lines[1]).toEqual({
      accountId: ACCOUNTS.ADJUSTMENT,
      debit: '3000',
      credit: '0',
      description: expect.any(String),
    });
  });

  it('every posted adjustment is balanced (debit == credit)', async () => {
    await handler.handle(
      createEvent({ beforeQuantity: 10, afterQuantity: 7 }),
      { transactionClient: tx },
    );
    await handler.handle(
      createEvent({ beforeQuantity: 10, afterQuantity: 25 }),
      { transactionClient: tx },
    );

    for (const call of glEngine.post.mock.calls) {
      const { lines } = call[0] as {
        lines: Array<{ debit: string; credit: string }>;
      };
      const totalDebit = lines.reduce((sum, l) => sum + parseFloat(l.debit), 0);
      const totalCredit = lines.reduce(
        (sum, l) => sum + parseFloat(l.credit),
        0,
      );
      expect(totalDebit).toBe(totalCredit);
    }
  });

  it('multiple sequential adjustments use consistent direction', async () => {
    await handler.handle(
      createEvent({ beforeQuantity: 10, afterQuantity: 12 }),
      { transactionClient: tx },
    );
    await handler.handle(
      createEvent({ beforeQuantity: 12, afterQuantity: 9 }),
      { transactionClient: tx },
    );

    const [first, second] = glEngine.post.mock.calls.map(
      (c) =>
        (c[0] as { lines: Array<{ accountId: string; debit: string }> }).lines,
    );
    // First: increase → inventory debited
    expect(first![0]!.accountId).toBe(ACCOUNTS.INVENTORY);
    expect(first![0]!.debit).toBe('2000');
    // Second: decrease → inventory credited, adjustment debited
    expect(second![0]!.accountId).toBe(ACCOUNTS.INVENTORY);
    expect(second![0]!.debit).toBe('0');
    expect(second![1]!.accountId).toBe(ACCOUNTS.ADJUSTMENT);
    expect(second![1]!.debit).toBe('3000');
  });

  it('skips journal when amount is zero (no cost price)', async () => {
    await handler.handle(
      createEvent({
        beforeQuantity: 10,
        afterQuantity: 15,
        unitCost: undefined,
      }),
      { transactionClient: tx },
    );
    expect(glEngine.post).not.toHaveBeenCalled();
  });

  it('does not post when transaction context is missing', async () => {
    await handler.handle(createEvent({ afterQuantity: 15 }));
    expect(glEngine.post).not.toHaveBeenCalled();
  });

  // ── G16-N-4 P1-A: authoritative totalCost (count shrinkage) ──────────
  it('uses payload.totalCost AS-IS as the GL amount when present', async () => {
    // Multi-layer shrinkage: 3 @ 100 + 2 @ 120 → totalCost 540. An average
    // basis would give unitCost 108 — and 108 × 5 also equals 540 for this
    // fixture, so use a unitCost that is deliberately WRONG for the total
    // (e.g. the costPrice fallback of the FIRST layer only): if the handler
    // re-derived unitCost × |diff| the entry would be 500, not 540.
    await handler.handle(
      createEvent({
        beforeQuantity: 15,
        afterQuantity: 10,
        quantity: -5,
        unitCost: '100',
        totalCost: '540',
        costBasis: 'FIFO',
      }),
      { transactionClient: tx },
    );

    const lines = postedLines();
    expect(lines[0]).toEqual({
      accountId: ACCOUNTS.INVENTORY,
      debit: '0',
      credit: '540',
      description: expect.any(String),
    });
    expect(lines[1]).toEqual({
      accountId: ACCOUNTS.ADJUSTMENT,
      debit: '540',
      credit: '0',
      description: expect.any(String),
    });
  });

  it('keeps the decrease direction for a totalCost-based shrinkage entry', async () => {
    await handler.handle(
      createEvent({
        beforeQuantity: 15,
        afterQuantity: 10,
        quantity: -5,
        totalCost: '540',
      }),
      { transactionClient: tx },
    );

    const lines = postedLines();
    // Canonical decrease: Dr 5100 Inventory Adjustment / Cr 1300 Inventory.
    expect(lines[0]!.accountId).toBe(ACCOUNTS.INVENTORY);
    expect(lines[0]!.credit).toBe('540');
    expect(lines[1]!.accountId).toBe(ACCOUNTS.ADJUSTMENT);
    expect(lines[1]!.debit).toBe('540');
  });

  it('falls back to unitCost × abs(diff) when totalCost is absent (legacy publishers)', async () => {
    await handler.handle(
      createEvent({ beforeQuantity: 10, afterQuantity: 7, unitCost: '1000' }),
      { transactionClient: tx },
    );

    const lines = postedLines();
    expect(lines[0]!.credit).toBe('3000');
    expect(lines[1]!.debit).toBe('3000');
  });

  it('zero totalCost keeps the canonical zero-amount skip (no journal, durable skip record)', async () => {
    const auditLog = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    // Rebuild the handler with an inspectable audit stub for this case.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryFinanceHandler,
        { provide: PrismaService, useValue: {} },
        { provide: GlEngineService, useValue: glEngine },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();
    const localHandler = module.get<InventoryFinanceHandler>(
      InventoryFinanceHandler,
    );

    await localHandler.handle(
      createEvent({
        beforeQuantity: 5,
        afterQuantity: 3,
        quantity: -2,
        totalCost: '0',
      }),
      { transactionClient: tx },
    );

    expect(glEngine.post).not.toHaveBeenCalled();
    expect(auditLog.log).toHaveBeenCalledTimes(1);
    expect(auditLog.log.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        action: 'GL_SKIP_ZERO_AMOUNT',
        companyId: 'company-1',
      }),
    );
  });
});
