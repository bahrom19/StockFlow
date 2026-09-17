import { StockMovementType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SalePartiallyRefundedEventHandler } from '../sale-partially-refunded.handler';
import { InventoryRepository } from '../../repositories/inventory.repository';
import { CostingService } from '../../services/costing.service';
import { PrismaService } from '../../../../common/prisma';

/**
 * G11-E E3 — `sale.partially_refunded` inventory handler.
 *
 * An in-memory fake ledger (stocks, movements, cost layers) proves the actual
 * end state after handling the event: restored quantities, exact restored
 * FIFO values, one RETURN movement per refund line, and idempotent duplicate
 * delivery. The handler is always invoked with `context.transactionClient`,
 * matching the publisher's in-transaction execution model.
 */

interface FakeStock {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  rowVersion: number;
}

interface FakeMovement {
  companyId: string;
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  referenceType: string;
  referenceId: string;
  comment: string;
  createdBy: string | null;
}

interface FakeLayer {
  companyId: string;
  productId: string;
  direction: string;
  quantity: number;
  remainingQuantity: number;
  unitCost: Decimal;
  totalCost: Decimal;
  referenceType: string;
  referenceId: string;
}

const COMPANY_A = 'comp-11111111';
const COMPANY_B = 'comp-22222222';
const WH_A = 'wh-A';
const WH_B = 'wh-B';
const PROD_1 = 'prod-1';
const PROD_2 = 'prod-2';

describe('SalePartiallyRefundedEventHandler — G11-E E3', () => {
  let handler: SalePartiallyRefundedEventHandler;
  let stocks: FakeStock[];
  let movements: FakeMovement[];
  let layers: FakeLayer[];
  let tx: any;
  let restoreRefundLayer: jest.Mock;

  const stockKey = (productId: string, warehouseId: string, companyId: string) =>
    `${companyId}|${warehouseId}|${productId}`;

  const stockOf = (productId: string, warehouseId: string, companyId: string) =>
    stocks.find(
      (s) =>
        s.productId === productId &&
        s.warehouseId === warehouseId &&
        s.companyId === companyId,
    );

  const buildTx = () => ({
    stockMovement: {
      create: jest.fn(async ({ data }: { data: FakeMovement }) => {
        movements.push(data);
        return { id: `mov-${movements.length}` };
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          movements.find(
            (m) =>
              m.companyId === where.companyId &&
              m.referenceType === where.referenceType &&
              m.referenceId === where.referenceId,
          ) ?? null
        );
      }),
    },
  });

  const payload = (overrides: Record<string, unknown> = {}) => ({
    saleId: 'sale-1',
    companyId: COMPANY_A,
    warehouseId: WH_A,
    refundId: 'refund-1',
    refundNumber: 'REF-COMPANY1-0001',
    saleNumber: 'SALE-001',
    total: '200.0000',
    currency: 'KZT',
    createdBy: 'user-1',
    items: [{ productId: PROD_1, saleItemId: 'sale-item-1', quantity: 2, unitPrice: '100.0000', total: '200.0000', fifoCost: '120.0000' }],
    ...overrides,
  });

  const handleEvent = async (
    eventPayload: Record<string, unknown>,
    tenantTx = tx,
  ) => {
    await handler.handle(
      {
        eventName: 'sale.partially_refunded',
        eventId: 'evt-1',
        occurredOn: new Date(),
        payload: eventPayload,
      } as any,
      { transactionClient: tenantTx },
    );
  };

  beforeEach(() => {
    stocks = [
      {
        id: 'stock-1',
        companyId: COMPANY_A,
        productId: PROD_1,
        warehouseId: WH_A,
        quantity: 3,
        reservedQuantity: 1,
        rowVersion: 0,
      },
    ];
    movements = [];
    layers = [];
    tx = buildTx();
    restoreRefundLayer = jest.fn(
      async (
        productId: string,
        companyId: string,
        quantity: number,
        totalCost: Decimal,
        referenceType: string,
        referenceId: string,
      ) => {
        layers.push({
          companyId,
          productId,
          direction: 'IN',
          quantity,
          remainingQuantity: quantity,
          unitCost: totalCost.div(quantity),
          totalCost,
          referenceType,
          referenceId,
        });
      },
    );

    const mockRepo = {
      findStockByProductAndWarehouse: jest.fn(
        async (productId, warehouseId, companyId) =>
          stockOf(productId, warehouseId, companyId) ?? null,
      ),
      updateStock: jest.fn(
        async (
          id: string,
          data: { quantity: number; availableQuantity: number },
          companyId: string,
          rowVersion: number,
        ) => {
          const s = stocks.find((x) => x.id === id && x.companyId === companyId);
          if (!s || s.rowVersion !== rowVersion) {
            throw new Error('Stock was modified by another user');
          }
          s.quantity = data.quantity;
          s.rowVersion += 1;
          return s;
        },
      ),
      createStock: jest.fn(
        async (data: any, client: any) => {
          const created: FakeStock = {
            id: `stock-${stocks.length + 1}`,
            companyId: data.company.connect.id,
            productId: data.product.connect.id,
            warehouseId: data.warehouse.connect.id,
            quantity: data.quantity,
            reservedQuantity: data.reservedQuantity,
            rowVersion: 0,
          };
          stocks.push(created);
          void client;
          return created;
        },
      ),
    };

    handler = new SalePartiallyRefundedEventHandler(
      mockRepo as unknown as InventoryRepository,
      { restoreRefundLayer } as unknown as CostingService,
      {} as PrismaService,
    );
  });

  // ── A/B. Partial quantities ──────────────────────────────────
  it('A: restores exactly the refunded quantity (1 unit), not the sold quantity', async () => {
    await handleEvent(
      payload({
        items: [{ productId: PROD_1, saleItemId: 'sale-item-1', quantity: 1, unitPrice: '100.0000', total: '100.0000', fifoCost: '60.0000' }],
      }),
    );
    expect(stockOf(PROD_1, WH_A, COMPANY_A)?.quantity).toBe(4); // 3 + 1
    expect(movements).toHaveLength(1);
    expect(movements[0]?.quantity).toBe(1);
  });

  it('B: restores multiple lines across products in one refund', async () => {
    stocks.push({ ...stocks[0]!, id: 'stock-2', productId: PROD_2, quantity: 5 });
    await handleEvent(
      payload({
        items: [
          { productId: PROD_1, saleItemId: 'sale-item-1', quantity: 2, unitPrice: '100.0000', total: '200.0000', fifoCost: '120.0000' },
          { productId: PROD_2, saleItemId: 'sale-item-2', quantity: 4, unitPrice: '50.0000', total: '200.0000', fifoCost: '80.0000' },
        ],
      }),
    );
    expect(stockOf(PROD_1, WH_A, COMPANY_A)?.quantity).toBe(5); // 3 + 2
    expect(stockOf(PROD_2, WH_A, COMPANY_A)?.quantity).toBe(9); // 5 + 4
    expect(movements).toHaveLength(2);
    expect(layers).toHaveLength(2);
  });

  // ── C/D. Multiple partial refunds are independent facts ──────
  it('C: two successive partial refunds each restore their own quantity', async () => {
    await handleEvent(
      payload({ refundId: 'refund-1', items: [payload().items[0]] }),
    );
    await handleEvent(
      payload({ refundId: 'refund-2', items: [payload().items[0]] }),
    );
    expect(stockOf(PROD_1, WH_A, COMPANY_A)?.quantity).toBe(7); // 3 + 2 + 2
    expect(layers).toHaveLength(2);
    expect(layers.map((l) => l.referenceId)).toEqual(['refund-1', 'refund-2']);
  });

  it('D: final partial refund (3 units, remainder fifoCost 99.9998) restores exactly', async () => {
    await handleEvent(
      payload({
        refundId: 'refund-final',
        items: [{ productId: PROD_1, saleItemId: 'sale-item-1', quantity: 3, unitPrice: '100.0000', total: '300.0000', fifoCost: '99.9998' }],
      }),
    );
    expect(stockOf(PROD_1, WH_A, COMPANY_A)?.quantity).toBe(6); // 3 + 3
    const layer = layers.find((l) => l.referenceId === 'refund-final');
    expect(layer?.totalCost.toFixed(4)).toBe('99.9998');
    expect(layer?.quantity).toBe(3);
    const movement = movements.find((m) => m.referenceId === 'refund-final');
    expect(movement?.afterQuantity).toBe(6);
  });

  // ── E. FIFO conservation / decimal remainder ─────────────────
  it('E: conserves the total across three lines of ONE refund (100.0000 → 33.3333 + 33.3333 + 33.3334)', async () => {
    const line = { productId: PROD_1, saleItemId: 'sale-item-1', quantity: 1, unitPrice: '100.0000', total: '100.0000', fifoCost: '0.0000' };
    await handleEvent(
      payload({
        refundId: 'refund-1',
        total: '100.0000',
        items: [
          { ...line, fifoCost: '33.3333' },
          { ...line, fifoCost: '33.3333' },
          { ...line, fifoCost: '33.3334' },
        ],
      }),
    );
    const refundLayers = layers.filter((l) => l.referenceId === 'refund-1');
    expect(refundLayers).toHaveLength(3);
    const sum = refundLayers.reduce(
      (acc, l) => acc.add(l.totalCost),
      new Decimal(0),
    );
    // the three restored values sum to the persisted total EXACTLY
    expect(sum.toFixed(4)).toBe('100.0000');
    expect(movements).toHaveLength(3); // one per refund line
    expect(stockOf(PROD_1, WH_A, COMPANY_A)?.quantity).toBe(6); // 3 + 3×1
  });

  it('E (exact conservation): three 1-unit refunds of a 100.0000 total restore 100.0000 exactly', async () => {
    const item = { productId: PROD_1, saleItemId: 'sale-item-1', quantity: 1, unitPrice: '100.0000', total: '100.0000', fifoCost: '0.0000' };
    await handleEvent(payload({ refundId: 'refund-1', items: [{ ...item, fifoCost: '33.3333' }] }));
    await handleEvent(payload({ refundId: 'refund-2', items: [{ ...item, fifoCost: '33.3333' }] }));
    await handleEvent(payload({ refundId: 'refund-3', items: [{ ...item, fifoCost: '33.3334' }] }));
    const refundLayers = layers.filter((l) => l.referenceId.startsWith('refund-'));
    const sum = refundLayers.reduce(
      (acc, l) => acc.add(l.totalCost),
      new Decimal(0),
    );
    expect(sum.toFixed(4)).toBe('100.0000');
    // no re-FIFO: each layer's totalCost equals the caller-supplied value
    expect(refundLayers.map((l) => l.totalCost.toString())).toEqual([
      '33.3333',
      '33.3333',
      '33.3334',
    ]);
  });

  // ── F. NULL fifoCost fallback (materialized by E2) ───────────
  it('F: NULL SaleItem.fifoCost was materialized by E2 — handler restores the supplied legacy value without consulting CostLayer OUT', async () => {
    await handleEvent(
      payload({
        items: [{ productId: PROD_1, saleItemId: 'sale-item-1', quantity: 2, unitPrice: '100.0000', total: '200.0000', fifoCost: '120.0000' }],
      }),
    );
    // restoreRefundLayer receives the caller-supplied value verbatim — no
    // OUT layer lookup, no costPrice derivation happens inside the handler.
    const layer = layers[0];
    expect(layer?.totalCost.toFixed(4)).toBe('120.0000');
    expect(layer?.direction).toBe('IN');
    expect(layer?.referenceType).toBe('REFUND');
    expect(layer?.referenceId).toBe('refund-1');
  });

  // ── G/H. Tenant & warehouse isolation ────────────────────────
  it('G: a foreign company cannot touch tenant A stock via the same refundId', async () => {
    await handleEvent(payload({ refundId: 'refund-1' }), tx);
    const beforeB = stockOf(PROD_1, WH_A, COMPANY_B)?.quantity;

    // Company B delivers the same refundId — its own (empty) ledger applies,
    // company A stock is untouched.
    const txB = buildTx();
    stocks.push({
      id: 'stock-B',
      companyId: COMPANY_B,
      productId: PROD_1,
      warehouseId: WH_A,
      quantity: 10,
      reservedQuantity: 0,
      rowVersion: 0,
    });
    await handleEvent(payload({ companyId: COMPANY_B, refundId: 'refund-1' }), txB);

    expect(stockOf(PROD_1, WH_A, COMPANY_A)?.quantity).toBe(5); // 3 + 2 (company A only)
    expect(stockOf(PROD_1, WH_A, COMPANY_B)?.quantity).toBe(12); // 10 + 2
    expect(beforeB).toBeUndefined();
    // company B's idempotency check ran against its own (empty) ledger —
    // i.e. tenant A's movements were invisible to it
    const firstCheck = await txB.stockMovement.findFirst.mock.calls[0] && (
      await txB.stockMovement.findFirst.mock.results[0]!.value
    );
    expect(firstCheck).toBeNull();
  });

  it('H: warehouse isolation — refund restores only the refund warehouse', async () => {
    stocks.push({
      id: 'stock-3',
      companyId: COMPANY_A,
      productId: PROD_1,
      warehouseId: WH_B,
      quantity: 10,
      reservedQuantity: 0,
      rowVersion: 0,
    });
    await handleEvent(payload({ warehouseId: WH_A }));
    expect(stockOf(PROD_1, WH_A, COMPANY_A)?.quantity).toBe(5); // 3 + 2
    expect(stockOf(PROD_1, WH_B, COMPANY_A)?.quantity).toBe(10); // untouched
    expect(movements[0]?.warehouseId).toBe(WH_A);
  });

  // ── I. Duplicate event / idempotency ─────────────────────────
  it('I: duplicate delivery of the same refund event is a complete no-op', async () => {
    await handleEvent(payload({ refundId: 'refund-1' }));
    const afterFirst = stockOf(PROD_1, WH_A, COMPANY_A)?.quantity;
    const movementCount = movements.length;
    const layerCount = layers.length;

    await handleEvent(payload({ refundId: 'refund-1' }));

    expect(stockOf(PROD_1, WH_A, COMPANY_A)?.quantity).toBe(afterFirst);
    expect(movements).toHaveLength(movementCount);
    expect(layers).toHaveLength(layerCount);
  });

  // ── J. Concurrent partial refunds (CAS) ──────────────────────
  it('J: stale stock rowVersion (concurrent refund) throws and aborts the restore', async () => {
    const s = stockOf(PROD_1, WH_A, COMPANY_A)!;
    s.rowVersion = 7;
    const repo = (handler as any).inventoryRepository;
    repo.updateStock.mockImplementation(async () => {
      throw new Error('Stock was modified by another user');
    });
    await expect(handleEvent(payload())).rejects.toThrow(
      /modified by another user/,
    );
    // nothing persisted before the failure surfaced
    expect(movements).toHaveLength(0);
    expect(layers).toHaveLength(0);
  });

  // ── K/L. Legacy exclusivity guards ───────────────────────────
  it('L: the event class carries exactly the locked event name and is exported via the barrel', async () => {
    const { SalePartiallyRefundedEvent } = await import(
      '../../../sales/events/sale-partially-refunded.event'
    );
    const { SalePartiallyRefundedEvent: BarreledEvent } = await import(
      '../../../sales/events'
    );
    const event = new SalePartiallyRefundedEvent(payload());
    expect(event.eventName).toBe('sale.partially_refunded');
    expect(event.eventId).toEqual(expect.any(String));
    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(BarreledEvent).toBe(SalePartiallyRefundedEvent);
  });

  // ── Ledger invariants ────────────────────────────────────────
  it('keeps the movement ledger invariant beforeQuantity + quantity == afterQuantity', async () => {
    await handleEvent(payload({ refundId: 'refund-1' }));
    await handleEvent(payload({ refundId: 'refund-2' }));
    for (const m of movements) {
      expect(m.beforeQuantity + m.quantity).toBe(m.afterQuantity);
    }
    expect(movements[0]?.beforeQuantity).toBe(3);
    expect(movements[1]?.beforeQuantity).toBe(5);
  });

  it('creates IN CostLayers referenced to the REFUND (not the sale) with positive quantity', async () => {
    await handleEvent(payload({ refundId: 'refund-1' }));
    const layer = layers[0];
    expect(layer?.direction).toBe('IN');
    expect(layer?.quantity).toBe(2);
    expect(layer?.remainingQuantity).toBe(2);
    expect(layer?.referenceType).toBe('REFUND');
    expect(layer?.referenceId).toBe('refund-1');
    expect(layer?.companyId).toBe(COMPANY_A);
    expect(layer?.totalCost.toFixed(4)).toBe('120.0000');
  });

  it('rejects a non-positive refund quantity (contract violation)', async () => {
    await expect(
      handleEvent(
        payload({
          items: [{ ...payload().items[0]!, quantity: 0 }],
        }),
      ),
    ).rejects.toThrow(/Invalid refund item quantity/);
    expect(movements).toHaveLength(0);
  });

  it('rejects a non-numeric fifoCost (contract violation)', async () => {
    await expect(
      handleEvent(
        payload({
          items: [{ ...payload().items[0]!, fifoCost: 'not-a-number' }],
        }),
      ),
    ).rejects.toThrow(/Invalid refund fifoCost/);
    expect(movements).toHaveLength(0);
    expect(layers).toHaveLength(0);
  });

  it('creates stock when none exists for the product/warehouse/company', async () => {
    await handleEvent(
      payload({
        items: [{ productId: PROD_2, saleItemId: 'sale-item-9', quantity: 1, unitPrice: '10.0000', total: '10.0000', fifoCost: '5.0000' }],
      }),
    );
    const created = stockOf(PROD_2, WH_A, COMPANY_A);
    expect(created?.quantity).toBe(1);
    expect(created?.reservedQuantity).toBe(0);
  });
});
