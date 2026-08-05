import { Test, TestingModule } from '@nestjs/testing';
import { InventoryFinanceHandler } from './finance-integration.handler';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { PrismaService } from '../../../common/prisma';

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
      ],
    }).compile();

    handler = module.get<InventoryFinanceHandler>(InventoryFinanceHandler);

    tx = {
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
});
