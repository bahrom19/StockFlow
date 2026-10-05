import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { SaleCompletedEventHandler } from '../events/sale-completed.handler';
import { InventoryRepository } from '../repositories/inventory.repository';
import { CostingService } from '../services/costing.service';
import { PrismaService } from '../../../common/prisma';

/**
 * G9-F2.1 — Sale FIFO consumption in the Inventory sale-completed handler.
 *
 * Contract under test (per approved architecture):
 * - after strict-stock validation, atomic stock decrement and StockMovement,
 *   each SaleItem's cost is consumed via CostingService.consumeFifoLayers with
 *   referenceType='SALE', referenceId=saleId and the SAME transaction client;
 * - costing errors (CAS ConflictException, no cost basis, generic) propagate —
 *   the caller's sale transaction must roll back (no swallow/warn-continue);
 * - FIFO must NOT be invoked for an item whose stock validation/decrement
 *   failed;
 * - multi-item sales run N costing calls in deterministic payload order.
 *
 * The FIFO engine itself (layering, CAS, FALLBACK B, OUT layer, Decimal) is
 * covered by costing-foundation.spec.ts; Finance COGS alignment is G9-F2.2
 * and intentionally out of scope here.
 */
describe('SaleCompletedEventHandler — G9-F2.1 sale FIFO consumption', () => {
  let handler: SaleCompletedEventHandler;
  let repo: { findStockByProductAndWarehouse: jest.Mock };
  let costing: { consumeFifoLayers: jest.Mock };
  let updateMany: jest.Mock;
  let createMovement: jest.Mock;
  let saleItemUpdateMany: jest.Mock;
  let tx: {
    stock: { updateMany: jest.Mock };
    saleItem: { updateMany: jest.Mock };
    stockMovement: { create: jest.Mock; findFirst: jest.Mock };
  };

  const payload = (
    items: Array<{ productId: string; quantity: number; saleItemId?: string }>,
  ) => ({
    items: items.map((i, idx) => ({
      saleItemId: i.saleItemId ?? `si-${idx + 1}`,
      productId: i.productId,
      quantity: i.quantity,
    })),
    warehouseId: 'wh-1',
    companyId: 'comp-1',
    saleId: 'sale-1',
    saleNumber: 'SALE-001',
    cashierId: 'user-1',
  });

  const stock = (quantity: number, productId = 'prod-1') => ({
    id: `stock-${productId}`,
    productId,
    warehouseId: 'wh-1',
    quantity,
    reservedQuantity: 0,
    availableQuantity: quantity,
    rowVersion: 0,
  });

  const fifoResult = (
    totalCost: string,
    layers: Array<Record<string, unknown>> = [],
    fallbackCost = '0',
  ) => ({ totalCost, layers, fallbackCost });

  beforeEach(() => {
    updateMany = jest.fn().mockResolvedValue({ count: 1 });
    createMovement = jest.fn().mockResolvedValue({ id: 'mov-1' });
    // G16-G: every payload item also carries its persisted SaleItem id, and
    // the handler writes fifoCost back through the same tx.
    saleItemUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    tx = {
      stock: { updateMany },
      stockMovement: {
        create: createMovement,
        // G16-N-4 P2: duplicate-delivery marker read (absent by default).
        findFirst: jest.fn().mockResolvedValue(null),
      },
      saleItem: { updateMany: saleItemUpdateMany },
    };
    repo = {
      findStockByProductAndWarehouse: jest
        .fn()
        .mockImplementation((_productId: string) =>
          Promise.resolve(stock(100, _productId)),
        ),
    };
    costing = {
      consumeFifoLayers: jest
        .fn()
        .mockResolvedValue(
          fifoResult('500', [
            { layerId: 'layer-a', quantity: 5, unitCost: '100', cost: '500' },
          ]),
        ),
    };
    handler = new SaleCompletedEventHandler(
      repo as unknown as InventoryRepository,
      costing as unknown as CostingService,
      {} as PrismaService,
    );
  });

  // ── 1. One-item FIFO ────────────────────────────────────────────────

  it('invokes consumeFifoLayers with correct product, company, quantity, SALE reference and tx', async () => {
    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 5 }]),
      } as any,
      { transactionClient: tx },
    );

    expect(costing.consumeFifoLayers).toHaveBeenCalledTimes(1);
    expect(costing.consumeFifoLayers).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      5,
      'SALE',
      'sale-1',
      tx,
    );
  });

  // ── 2. FIFO multi-layer runs through the existing engine ───────────

  it('runs the existing FIFO costing engine and completes on multi-layer results', async () => {
    costing.consumeFifoLayers.mockResolvedValue(
      fifoResult('1300', [
        { layerId: 'layer-a', quantity: 10, unitCost: '100', cost: '1000' },
        { layerId: 'layer-b', quantity: 2, unitCost: '150', cost: '300' },
      ]),
    );

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([{ productId: 'prod-1', quantity: 12 }]),
        } as any,
        { transactionClient: tx },
      ),
    ).resolves.toBeUndefined();

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(costing.consumeFifoLayers).toHaveBeenCalledTimes(1);
  });

  // ── 3. Partial consumption ──────────────────────────────────────────

  it('completes a partial layer consumption without altering the costing result', async () => {
    costing.consumeFifoLayers.mockResolvedValue(
      fifoResult('400', [
        { layerId: 'layer-a', quantity: 4, unitCost: '100', cost: '400' },
      ]),
    );

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 4 }]),
      } as any,
      { transactionClient: tx },
    );

    // partial consumption detail is delegated to CostingService untouched —
    // the handler neither transforms it nor creates cost records itself
    expect(costing.consumeFifoLayers).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      4,
      'SALE',
      'sale-1',
      tx,
    );
    // handler does not touch costLayer directly (OUT layer is CostingService's job)
    expect((tx as any).costLayer).toBeUndefined();
  });
  // ── 4. Fallback B ───────────────────────────────────────────────────

  it('completes when costing reports FALLBACK B (layers + shortfall) and does not swallow it', async () => {
    costing.consumeFifoLayers.mockResolvedValue(
      fifoResult(
        '860',
        [{ layerId: 'layer-a', quantity: 5, unitCost: '100', cost: '500' }],
        '360',
      ),
    );

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([{ productId: 'prod-1', quantity: 8 }]),
        } as any,
        { transactionClient: tx },
      ),
    ).resolves.toBeUndefined();

    // fallback semantics (shortfall × costPrice, logging, OUT totalCost) stay
    // entirely inside CostingService — verified there; here we only assert the
    // sale still completes and the call happened once with the full quantity
    expect(costing.consumeFifoLayers).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      8,
      'SALE',
      'sale-1',
      tx,
    );
  });

  it('G16-H-3 T6: zero-cost fallback (fifoCost = 0) persists successfully — zero is not treated as missing', async () => {
    costing.consumeFifoLayers.mockResolvedValue(
      fifoResult('0', [], '0'),
    );

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([{ productId: 'prod-1', quantity: 8 }]),
        } as any,
        { transactionClient: tx },
      ),
    ).resolves.toBeUndefined();

    expect(saleItemUpdateMany).toHaveBeenCalledWith({
      where: { id: 'si-1', saleId: 'sale-1' },
      data: { fifoCost: '0' },
    });
  });

  // ── 5. No cost basis ────────────────────────────────────────────────

  it('propagates the no-cost-basis error — no swallow, no warn-and-continue', async () => {
    costing.consumeFifoLayers.mockRejectedValue(
      new Error(
        'Insufficient cost layers and no costPrice basis. Short 8 units for product prod-1',
      ),
    );

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([{ productId: 'prod-1', quantity: 8 }]),
        } as any,
        { transactionClient: tx },
      ),
    ).rejects.toThrow(/no costPrice basis/);
  });

  // ── 6. CAS conflict ─────────────────────────────────────────────────

  it('propagates ConflictException on CostLayer CAS loss (rollback upstream)', async () => {
    costing.consumeFifoLayers.mockRejectedValue(
      new ConflictException(
        'Cost layer layer-a was modified concurrently. Please retry the transaction.',
      ),
    );

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([{ productId: 'prod-1', quantity: 4 }]),
        } as any,
        { transactionClient: tx },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ── 7. Multi-item sale ──────────────────────────────────────────────

  it('runs N costing calls for N items in deterministic payload order (A×2, B×5, C×1)', async () => {
    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([
          { productId: 'prod-a', quantity: 2 },
          { productId: 'prod-b', quantity: 5 },
          { productId: 'prod-c', quantity: 1 },
        ]),
      } as any,
      { transactionClient: tx },
    );

    expect(costing.consumeFifoLayers).toHaveBeenCalledTimes(3);
    expect(costing.consumeFifoLayers.mock.calls.map((c) => c[0])).toEqual([
      'prod-a',
      'prod-b',
      'prod-c',
    ]);
    expect(costing.consumeFifoLayers.mock.calls.map((c) => c[2])).toEqual([
      2, 5, 1,
    ]);
    for (const call of costing.consumeFifoLayers.mock.calls) {
      expect(call[3]).toBe('SALE');
      expect(call[4]).toBe('sale-1');
      expect(call[5]).toBe(tx);
    }
  });
  // ── 8. Stock failure ordering ───────────────────────────────────────

  it('does NOT invoke FIFO when strict-stock validation fails', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stock(3));

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([{ productId: 'prod-1', quantity: 10 }]),
        } as any,
        { transactionClient: tx },
      ),
    ).rejects.toThrow(/Insufficient stock/);
    expect(createMovement).not.toHaveBeenCalled();
    expect(costing.consumeFifoLayers).not.toHaveBeenCalled();
  });

  it('does NOT invoke FIFO when the guarded stock decrement loses the race (count 0)', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([{ productId: 'prod-1', quantity: 2 }]),
        } as any,
        { transactionClient: tx },
      ),
    ).rejects.toThrow(/Insufficient stock/);
    expect(createMovement).not.toHaveBeenCalled();
    expect(costing.consumeFifoLayers).not.toHaveBeenCalled();
  });

  it('does NOT invoke FIFO for remaining items after an earlier item fails stock validation', async () => {
    repo.findStockByProductAndWarehouse.mockImplementation(
      (productId: string) =>
        productId === 'prod-a'
          ? Promise.resolve(stock(1, 'prod-a')) // requested 2 -> insufficient
          : Promise.resolve(stock(100, productId)),
    );

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([
            { productId: 'prod-a', quantity: 2 },
            { productId: 'prod-b', quantity: 5 },
          ]),
        } as any,
        { transactionClient: tx },
      ),
    ).rejects.toThrow(/Insufficient stock/);

    expect(costing.consumeFifoLayers).not.toHaveBeenCalled();
    expect(createMovement).not.toHaveBeenCalled();
  });

  // ── 9. Transaction propagation ──────────────────────────────────────

  it('passes the SAME transaction client to FIFO costing as used for stock and movement', async () => {
    const otherTx = {
      stock: { updateMany },
      stockMovement: {
        create: createMovement,
        // G16-N-4 P2: duplicate-delivery marker read (absent by default).
        findFirst: jest.fn().mockResolvedValue(null),
      },
      saleItem: { updateMany: saleItemUpdateMany },
    };

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 5 }]),
      } as any,
      { transactionClient: otherTx },
    );

    expect(costing.consumeFifoLayers).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      5,
      'SALE',
      'sale-1',
      otherTx,
    );
  });

  // ── ordering: movement is created before FIFO ──────────────────────

  it('creates the StockMovement before consuming FIFO (stock -> movement -> FIFO)', async () => {
    const order: string[] = [];
    createMovement.mockImplementation(() => {
      order.push('movement');
      return Promise.resolve({ id: 'mov-1' });
    });
    costing.consumeFifoLayers.mockImplementation(() => {
      order.push('fifo');
      return Promise.resolve(fifoResult('500'));
    });

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 5 }]),
      } as any,
      { transactionClient: tx },
    );

    expect(order).toEqual(['movement', 'fifo']);
  });

  it('rejects with Insufficient stock when no stock record exists (before FIFO)', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(null);

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([{ productId: 'prod-1', quantity: 1 }]),
        } as any,
        { transactionClient: tx },
      ),
    ).rejects.toThrow(/Insufficient stock/);
    expect(costing.consumeFifoLayers).not.toHaveBeenCalled();
  });

  // ── G16-G: runtime fifoCost persistence (T1–T8, T15, T17) ───────────

  it('T1: persists result.totalCost AS-IS on the item\'s SaleItem row via the same tx', async () => {
    costing.consumeFifoLayers.mockResolvedValue(fifoResult('500'));

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 5 }]),
      } as any,
      { transactionClient: tx },
    );

    expect(saleItemUpdateMany).toHaveBeenCalledTimes(1);
    expect(saleItemUpdateMany).toHaveBeenCalledWith({
      where: { id: 'si-1', saleId: 'sale-1' },
      data: { fifoCost: '500' },
    });
  });

  it('T2: multi-layer consumption persists the layered total (1000 + 300 = 1300)', async () => {
    costing.consumeFifoLayers.mockResolvedValue(
      fifoResult('1300', [
        { layerId: 'layer-a', quantity: 10, unitCost: '100', cost: '1000' },
        { layerId: 'layer-b', quantity: 2, unitCost: '150', cost: '300' },
      ]),
    );

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 12 }]),
      } as any,
      { transactionClient: tx },
    );

    expect(saleItemUpdateMany).toHaveBeenCalledWith({
      where: { id: 'si-1', saleId: 'sale-1' },
      data: { fifoCost: '1300' },
    });
  });

  it('T3: partial FIFO + FALLBACK B persists layered + fallback total (500 + 360 = 860)', async () => {
    costing.consumeFifoLayers.mockResolvedValue(
      fifoResult(
        '860',
        [{ layerId: 'layer-a', quantity: 5, unitCost: '100', cost: '500' }],
        '360',
      ),
    );

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 8 }]),
      } as any,
      { transactionClient: tx },
    );

    expect(saleItemUpdateMany).toHaveBeenCalledWith({
      where: { id: 'si-1', saleId: 'sale-1' },
      data: { fifoCost: '860' },
    });
  });

  it('T4: zero FIFO layers + costPrice fallback persists the full fallback total', async () => {
    costing.consumeFifoLayers.mockResolvedValue(
      fifoResult('960', [], '960'),
    );

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 8 }]),
      } as any,
      { transactionClient: tx },
    );

    expect(saleItemUpdateMany).toHaveBeenCalledWith({
      where: { id: 'si-1', saleId: 'sale-1' },
      data: { fifoCost: '960' },
    });
  });

  it('T6: N items each get their OWN consume result — different products (T7 duplicates keep their own OUT too)', async () => {
    costing.consumeFifoLayers
      .mockResolvedValueOnce(fifoResult('60'))
      .mockResolvedValueOnce(fifoResult('45'))
      .mockResolvedValueOnce(fifoResult('12.5'));

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([
          { productId: 'prod-a', quantity: 2 },
          { productId: 'prod-b', quantity: 3 },
          { productId: 'prod-c', quantity: 1 },
        ]),
      } as any,
      { transactionClient: tx },
    );

    expect(saleItemUpdateMany).toHaveBeenCalledTimes(3);
    expect(saleItemUpdateMany.mock.calls.map((c) => c[0].where.id)).toEqual([
      'si-1',
      'si-2',
      'si-3',
    ]);
    expect(saleItemUpdateMany.mock.calls.map((c) => c[0].data.fifoCost)).toEqual([
      '60',
      '45',
      '12.5',
    ]);
    // per-item consume → per-item OUT layers → Σ SaleItem.fifoCost ==
    // Σ OUT.totalCost(sale) holds by construction (I1); for duplicate
    // productIds each sequential consume sees updated layer remainders and
    // writes its own OUT layer, so A.fifoCost + B.fifoCost == OUT1 + OUT2.
  });

  it('T7: duplicate productId items persist distinct fifoCosts summing to the canonical total', async () => {
    // Same product in two lines: FIFO order is payload order; OUT1 + OUT2 =
    // 20 + 30 → the two SaleItems carry exactly those totals (I1 exact).
    costing.consumeFifoLayers
      .mockResolvedValueOnce(fifoResult('20'))
      .mockResolvedValueOnce(fifoResult('30'));

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([
          { productId: 'prod-x', quantity: 2, saleItemId: 'si-first' },
          { productId: 'prod-x', quantity: 3, saleItemId: 'si-second' },
        ]),
      } as any,
      { transactionClient: tx },
    );

    expect(costing.consumeFifoLayers).toHaveBeenCalledTimes(2);
    expect(saleItemUpdateMany.mock.calls.map((c) => c[0].where.id)).toEqual([
      'si-first',
      'si-second',
    ]);
    expect(
      saleItemUpdateMany.mock.calls.reduce(
        (sum, c) => sum.add(c[0].data.fifoCost),
        new Decimal(0),
      ),
    ).toEqual(new Decimal('50'));
  });

  it('T8: Decimal conservation — no unitCost multiplication, no rounding of totalCost', async () => {
    // totalCost carries 4-decimal precision that unitCost × qty could never
    // reproduce (5.0001 is not divisible by 3): the persisted value must be
    // the consume total verbatim.
    costing.consumeFifoLayers.mockResolvedValue(
      fifoResult('10.0002'),
    );

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 3 }]),
      } as any,
      { transactionClient: tx },
    );

    expect(saleItemUpdateMany).toHaveBeenCalledWith({
      where: { id: 'si-1', saleId: 'sale-1' },
      data: { fifoCost: '10.0002' },
    });
  });

  it('T15: SaleItem persist failure after consume → fail-fast, whole transaction rolls back', async () => {
    costing.consumeFifoLayers.mockResolvedValue(fifoResult('500'));
    saleItemUpdateMany.mockResolvedValue({ count: 0 }); // row vanished?

    await expect(
      handler.handle(
        {
          eventName: 'sale.completed',
          payload: payload([{ productId: 'prod-1', quantity: 5 }]),
        } as any,
        { transactionClient: tx },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(saleItemUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('T17: saleId predicate in the write keeps the persist tenant-scoped', async () => {
    costing.consumeFifoLayers.mockResolvedValue(fifoResult('500'));

    await handler.handle(
      {
        eventName: 'sale.completed',
        payload: payload([{ productId: 'prod-1', quantity: 5 }]),
      } as any,
      { transactionClient: tx },
    );

    // where.clause must always pair the item id with THIS sale's id — the
    // saleId is tenant/context-scoped upstream, so a foreign SaleItem row can
    // never match even if the id collided.
    expect(saleItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'si-1',
          saleId: 'sale-1',
        }),
      }),
    );
  });
});
