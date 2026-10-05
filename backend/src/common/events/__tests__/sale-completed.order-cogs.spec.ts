import { Decimal } from '@prisma/client/runtime/library';
import { InMemoryEventBus } from '../in-memory-event-bus';
import { SaleCompletedEvent } from '../../../modules/sales/events/sale-completed.event';
import { SaleCompletedEventHandler as InventorySaleCompletedHandler } from '../../../modules/inventory/events/sale-completed.handler';
import { SaleCompletedEventHandler as FinanceSaleCompletedHandler } from '../../../modules/finance/events/sale-completed.handler';
import { FinanceIntegrationService } from '../../../modules/finance/services/finance-integration.service';
import { CostingService } from '../../../modules/inventory/services/costing.service';

/**
 * G16-E — D2/D3/D7/D8: real InMemoryEventBus with the REAL Inventory and
 * Finance `sale.completed` handlers over one shared fake transaction store.
 *
 * The subscriptions are registered in the historically wrong order
 * (Finance first, Inventory last) to prove execution order comes from
 * explicit priorities (Inventory 10 → Finance 20 → Notifications 30),
 * not registration order:
 *
 * - D2: Finance COGS uses the FIFO CostLayer basis (NOT legacy costPrice)
 * - D3: journal COGS == CostLayer valuation (read-after-write in-tx)
 * - D7: finance failure → publish rejects, Notifications skipped,
 *       snapshot/restore demonstrates full rollback of inventory changes
 * - D8: inventory failure → Finance never posts, Notifications skipped,
 *       store unchanged
 *
 * The fake transaction emulates Prisma's all-or-nothing contract with a
 * snapshot/restore wrapper; DB-level rollback itself is guaranteed by
 * Prisma and covered by the integration suite.
 */

interface FakeStock {
  id: string;
  companyId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  rowVersion: number;
}

interface Store {
  costLayers: any[];
  stock: FakeStock;
  movements: any[];
}

describe('sale.completed ordering & FIFO COGS (G16-E, D2/D3/D7/D8)', () => {
  const COMPANY_ID = 'co-1';
  const PRODUCT_ID = 'p-1';
  const SALE_ID = 'sale-1';
  // FIFO basis: layer unitCost 7.50 × 2 = 15.00.
  // Legacy basis: SaleItem.costPrice 3.00 × 2 = 6.00 (deliberately differs).
  const FIFO_TOTAL = new Decimal('15.00');
  const LEGACY_TOTAL = new Decimal('6.00');

  let store: Store;
  let fakeTx: any;
  let bus: InMemoryEventBus;
  let timeline: string[];
  let stockAtNotification: number | null;
  let glEngine: { post: jest.Mock };
  let postFailure: Error | null;
  let notificationsHandler: { handle: jest.Mock };
  let inventoryRepository: Record<string, jest.Mock>;

  const snapshot = () => ({
    costLayers: store.costLayers.map((l) => ({ ...l })),
    stock: { ...store.stock },
    movements: store.movements.map((m) => ({ ...m })),
  });

  const restore = (backup: ReturnType<typeof snapshot>) => {
    store.costLayers = backup.costLayers;
    store.stock = backup.stock;
    store.movements = backup.movements;
  };

  /** Emulates Prisma.$transaction: commit on success, full rollback on throw. */
  const runInTransaction = async (fn: () => Promise<void>): Promise<void> => {
    const backup = snapshot();
    try {
      await fn();
    } catch (err) {
      restore(backup);
      throw err;
    }
  };

  const payload = {
    saleId: SALE_ID,
    companyId: COMPANY_ID,
    warehouseId: 'wh-1',
    cashierId: 'u-1',
    customerId: null,
    saleNumber: 'S-0001',
    subtotal: '30.00',
    discount: '0.00',
    total: '30.00',
    paidAmount: '30.00',
    changeAmount: '0.00',
    currency: 'USD',
    items: [
      {
        productId: PRODUCT_ID,
        quantity: 2,
        unitPrice: '15.00',
        costPrice: '3.00',
        discount: '0.00',
        subtotal: '30.00',
        total: '30.00',
        margin: '24.00',
      },
    ],
    payments: [{ method: 'CASH', amount: '30.00' }],
  };

  const publishSale = () =>
    runInTransaction(() =>
      bus.publish(new SaleCompletedEvent(payload), {
        context: { transactionClient: fakeTx },
      }),
    );

  const outLayersForSale = () =>
    store.costLayers.filter(
      (l) =>
        l.direction === 'OUT' &&
        l.referenceType === 'SALE' &&
        l.referenceId === SALE_ID,
    );

  beforeEach(() => {
    timeline = [];
    stockAtNotification = null;

    store = {
      costLayers: [
        {
          id: 'in-1',
          companyId: COMPANY_ID,
          productId: PRODUCT_ID,
          direction: 'IN',
          quantity: 10,
          remainingQuantity: 10,
          unitCost: new Decimal('7.50'),
          totalCost: new Decimal('75.00'),
          referenceType: 'PURCHASE',
          referenceId: 'po-1',
          createdAt: new Date('2026-01-01'),
        },
      ],
      stock: {
        id: 'stock-1',
        companyId: COMPANY_ID,
        quantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10,
        rowVersion: 1,
      },
      movements: [],
    };

    fakeTx = {
      stock: {
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (store.stock.id !== where.id) return { count: 0 };
          if (
            where.quantity?.gte !== undefined &&
            store.stock.quantity < where.quantity.gte
          ) {
            return { count: 0 };
          }
          store.stock.quantity -= data.quantity.decrement;
          store.stock.availableQuantity -= data.availableQuantity.decrement;
          store.stock.rowVersion += data.rowVersion.increment;
          return { count: 1 };
        }),
      },
      stockMovement: {
        create: jest.fn(async ({ data }: any) => {
          timeline.push('inventory');
          store.movements.push(data);
          return data;
        }),
        // G16-N-4 P2: duplicate-delivery marker read. Absent here — the
        // harness delivers each event once; duplicate-delivery coverage
        // lives in the handler specs.
        findFirst: jest.fn(async () => null),
      },
      // G16-N-4 P2: the real FinanceIntegrationService reads this to decide
      // whether this event occurrence was already journaled.
      journalEntry: {
        findFirst: jest.fn(async () => null),
      },
      // G16-G: the completion handler persists each item's FIFO total cost
      // through this tx; a 0-count update must fail the sale transaction.
      saleItem: {
        updateMany: jest.fn(async ({ where }: any) =>
          where.saleId === payload.saleId &&
          payload.items.some((i: any) => i.saleItemId === where.id)
            ? { count: 1 }
            : { count: 0 },
        ),
      },
      costLayer: {
        create: jest.fn(async ({ data }: any) => {
          const row = {
            ...data,
            id: `layer-${store.costLayers.length + 1}`,
            createdAt: new Date(),
          };
          store.costLayers.push(row);
          return row;
        }),
        findMany: jest.fn(async ({ where }: any) =>
          store.costLayers.filter(
            (l) =>
              l.companyId === where.companyId &&
              l.direction === where.direction &&
              l.referenceType === where.referenceType &&
              l.referenceId === where.referenceId,
          ),
        ),
      },
      chartOfAccount: {
        findMany: jest.fn(async () => [
          { id: 'acc-cash', code: '1010' },
          { id: 'acc-bank', code: '1020' },
          { id: 'acc-ar', code: '1200' },
          { id: 'acc-revenue', code: '4000' },
          { id: 'acc-cogs', code: '5000' },
          { id: 'acc-inventory', code: '1300' },
        ]),
      },
    };

    inventoryRepository = {
      findStockByProductAndWarehouse: jest.fn(async () => store.stock),
      findActiveCostLayers: jest.fn(
        async (productId: string, companyId: string) =>
          store.costLayers
            .filter(
              (l) =>
                l.productId === productId &&
                l.companyId === companyId &&
                l.direction === 'IN' &&
                l.remainingQuantity > 0,
            )
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            ),
      ),
      consumeCostLayer: jest.fn(
        async (id: string, newRemaining: number, expected: number) => {
          const layer = store.costLayers.find((l) => l.id === id);
          if (!layer || layer.remainingQuantity !== expected) return false;
          layer.remainingQuantity = newRemaining;
          return true;
        },
      ),
      findProductById: jest.fn(async () => ({
        costPrice: new Decimal('3.00'),
      })),
    };

    const costingService = new CostingService(
      inventoryRepository as any,
      {} as any,
    );

    postFailure = null;
    glEngine = {
      post: jest.fn(async () => {
        timeline.push('finance');
        if (postFailure) {
          const failure = postFailure;
          postFailure = null;
          throw failure;
        }
        return undefined;
      }),
    };
    const calendarService = {
      ensureCurrentCalendar: jest.fn(async () => ({
        isPostable: true,
        financialPeriod: { id: 'fp-1', name: 'Sep 2026', status: 'OPEN' },
      })),
    };
    const financeIntegration = new FinanceIntegrationService(
      calendarService as any,
      glEngine as any,
    );

    notificationsHandler = {
      handle: jest.fn(async () => {
        timeline.push('notifications');
        stockAtNotification = store.stock.quantity;
      }),
    };

    const inventoryHandler = new InventorySaleCompletedHandler(
      inventoryRepository as any,
      costingService,
      {} as any,
    );
    const financeHandler = new FinanceSaleCompletedHandler(financeIntegration);

    // Worst-case historical registration order: Finance first, Inventory last.
    bus = new InMemoryEventBus();
    bus.subscribe('sale.completed', financeHandler, { priority: 20 });
    bus.subscribe('sale.completed', notificationsHandler, { priority: 30 });
    bus.subscribe('sale.completed', inventoryHandler, { priority: 10 });
  });

  it('D2/D3: executes Inventory → Finance → Notifications and posts FIFO COGS equal to the CostLayer valuation', async () => {
    await publishSale();

    // Execution order is priority-driven despite worst-case registration.
    expect(timeline).toEqual(['inventory', 'finance', 'notifications']);
    // Notifications observed the post-decrement stock (ran AFTER inventory).
    expect(stockAtNotification).toBe(8);

    expect(glEngine.post).toHaveBeenCalledTimes(1);
    const journal = glEngine.post.mock.calls[0][0];
    const cogsLine = journal.lines.find((l: any) => l.accountId === 'acc-cogs');
    const inventoryLine = journal.lines.find(
      (l: any) => l.accountId === 'acc-inventory',
    );

    // The OUT CostLayer exists (created by inventory before finance read it).
    const outLayers = outLayersForSale();
    expect(outLayers).toHaveLength(1);
    const fifoTotal = outLayers.reduce(
      (acc, l) => acc.add(new Decimal(l.totalCost)),
      new Decimal(0),
    );
    expect(fifoTotal.eq(FIFO_TOTAL)).toBe(true);

    // D3: journal COGS == CostLayer valuation.
    expect(new Decimal(cogsLine.debit).eq(fifoTotal)).toBe(true);
    expect(new Decimal(inventoryLine.credit).eq(fifoTotal)).toBe(true);

    // D2: FIFO basis, not the legacy costPrice basis (6.00).
    expect(new Decimal(cogsLine.debit).eq(LEGACY_TOTAL)).toBe(false);
    expect(new Decimal(cogsLine.debit).eq(FIFO_TOTAL)).toBe(true);

    // Side effects persisted: stock decremented, movement recorded.
    expect(store.stock.quantity).toBe(8);
    expect(store.movements).toHaveLength(1);
    // Inventory consumed from the IN layer (10 → 8 remaining).
    expect(store.costLayers[0].remainingQuantity).toBe(8);
  });

  it('D7: finance failure rejects publish, skips Notifications, and rolls back all inventory changes', async () => {
    postFailure = new Error('non-postable period');

    await expect(publishSale()).rejects.toThrow('non-postable period');

    // 'finance' records the attempt — posting itself failed and threw.
    expect(timeline).toEqual(['inventory', 'finance']);
    expect(notificationsHandler.handle).not.toHaveBeenCalled();

    // Full rollback: no OUT layer, no movement, stock and IN layer untouched.
    expect(outLayersForSale()).toHaveLength(0);
    expect(store.movements).toHaveLength(0);
    expect(store.stock.quantity).toBe(10);
    expect(store.costLayers[0].remainingQuantity).toBe(10);
  });

  it('D8: inventory failure prevents Finance posting, skips Notifications, leaves the store unchanged', async () => {
    store.stock.quantity = 1; // less than the sold quantity of 2

    await expect(publishSale()).rejects.toThrow('Insufficient stock');

    expect(glEngine.post).not.toHaveBeenCalled();
    expect(notificationsHandler.handle).not.toHaveBeenCalled();
    expect(outLayersForSale()).toHaveLength(0);
    expect(store.movements).toHaveLength(0);
    expect(store.stock.quantity).toBe(1);
  });

  it('D10: a successful completion produces exactly one movement, one OUT layer, one journal (no duplicates)', async () => {
    await publishSale();

    expect(store.movements).toHaveLength(1);
    expect(outLayersForSale()).toHaveLength(1);
    expect(glEngine.post).toHaveBeenCalledTimes(1);
    expect(notificationsHandler.handle).toHaveBeenCalledTimes(1);
  });
});
