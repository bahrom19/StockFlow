import { SaleRefundedEventHandler } from '../events/sale-refunded.handler';
import { InventoryRepository } from '../repositories/inventory.repository';
import { CostingService } from '../services/costing.service';
import { PrismaService } from '../../../common/prisma';
import { SaleRefundedEventPayload } from '../../sales/interfaces/sale-event.interface';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * G9-F3 — Refund Cost Integrity: FIFO CostLayer restore on sale.refunded.
 *
 * Approved policy under test:
 * - OUT layers for (companyId, 'SALE', saleId, productId) are aggregated by
 *   product (a multi-item sale can contain the same product several times);
 * - full OUT coverage  → restoreLayer at the weighted average unitCost of the
 *   sale's own OUT layers (value restore, not physical composition);
 * - no OUT layers      → legacy sale: no restore (Finance falls back to the
 *   legacy SaleItem.costPrice basis);
 * - partial/excess     → data anomaly: NO partial or over-restore,
 *   error-logged, no FIFO/legacy mixing;
 * - everything runs inside the caller's transaction client; restore failures
 *   propagate so the whole refund rolls back.
 */
describe('SaleRefundedEventHandler — G9-F3 FIFO CostLayer restore', () => {
  let handler: SaleRefundedEventHandler;
  let repo: {
    findStockByProductAndWarehouse: jest.Mock;
    updateStock: jest.Mock;
    createStock: jest.Mock;
  };
  let costing: {
    findOutLayersByReferenceAndProduct: jest.Mock;
    restoreLayer: jest.Mock;
  };
  let errorSpy: jest.Mock;
  let warnSpy: jest.Mock;
  let tx: { stockMovement: { create: jest.Mock } };

  const payload = (
    items: Array<{ productId: string; quantity: number }>,
    overrides?: Partial<SaleRefundedEventPayload>,
  ): SaleRefundedEventPayload => ({
    saleId: 'sale-1',
    companyId: 'comp-1',
    warehouseId: 'wh-1',
    cashierId: 'user-1',
    saleNumber: 'SALE-001',
    total: '100',
    currency: 'KZT',
    items: items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: '10',
      costPrice: '6',
      discount: '0',
      subtotal: new Decimal('10').mul(i.quantity).toString(),
      total: new Decimal('10').mul(i.quantity).toString(),
      margin: '0',
    })),
    payments: [],
    ...overrides,
  });

  const outLayer = (quantity: number, totalCost: string) => ({
    id: `out-${quantity}-${totalCost}`,
    quantity,
    totalCost: new Decimal(totalCost),
    unitCost: new Decimal(totalCost).div(quantity),
  });

  const stock = (quantity: number) => ({
    id: `stock-${quantity}`,
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantity,
    reservedQuantity: 0,
    availableQuantity: quantity,
    rowVersion: 0,
  });

  beforeEach(() => {
    repo = {
      findStockByProductAndWarehouse: jest
        .fn()
        .mockImplementation((_p: string, _w: string, _c: string) =>
          Promise.resolve(stock(0)),
        ),
      updateStock: jest.fn().mockResolvedValue({}),
      createStock: jest.fn().mockResolvedValue({}),
    };
    costing = {
      findOutLayersByReferenceAndProduct: jest.fn().mockResolvedValue([]),
      restoreLayer: jest.fn().mockResolvedValue(undefined),
    };
    tx = { stockMovement: { create: jest.fn().mockResolvedValue({}) } };
    handler = new SaleRefundedEventHandler(
      repo as unknown as InventoryRepository,
      costing as unknown as CostingService,
      {} as PrismaService,
    );
    errorSpy = jest.fn();
    warnSpy = jest.fn();
    (handler as unknown as { logger: unknown }).logger = {
      error: errorSpy,
      warn: warnSpy,
    };
  });

  const run = (p: SaleRefundedEventPayload) =>
    handler.handle(
      { eventName: 'sale.refunded', payload: p } as any,
      { transactionClient: tx } as any,
    );

  // ── 1. Full FIFO refund ─────────────────────────────────────────────

  it('restores the exact OUT value on a full FIFO refund (5 units, 560 → avg 112)', async () => {
    costing.findOutLayersByReferenceAndProduct.mockResolvedValue([
      outLayer(5, '560'),
    ]);

    await run(payload([{ productId: 'prod-1', quantity: 5 }]));

    expect(costing.findOutLayersByReferenceAndProduct).toHaveBeenCalledWith(
      'comp-1',
      'SALE',
      'sale-1',
      'prod-1',
      tx,
    );
    expect(costing.restoreLayer).toHaveBeenCalledTimes(1);
    expect(costing.restoreLayer).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      5,
      new Decimal('112'),
      'REFUND_RESTORE',
      'sale-1',
      tx,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // ── 2. Multiple OUT layers aggregate (weighted average) ─────────────

  it('aggregates multiple OUT layers: 2×100 + 3×120 = 560 over 5 units → avg 112', async () => {
    costing.findOutLayersByReferenceAndProduct.mockResolvedValue([
      outLayer(2, '200'),
      outLayer(3, '360'),
    ]);

    await run(payload([{ productId: 'prod-1', quantity: 5 }]));

    expect(costing.restoreLayer).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      5,
      new Decimal('112'),
      'REFUND_RESTORE',
      'sale-1',
      tx,
    );
  });

  // ── 3. Same product in multiple sale items ──────────────────────────

  it('aggregates refund quantities for the same product across sale items (2 + 3 = 5)', async () => {
    costing.findOutLayersByReferenceAndProduct.mockResolvedValue([
      outLayer(5, '560'),
    ]);

    await run(
      payload([
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-1', quantity: 3 },
      ]),
    );

    // One product-scoped lookup (never a per-item first-layer-only lookup)
    expect(costing.findOutLayersByReferenceAndProduct).toHaveBeenCalledTimes(1);
    expect(costing.restoreLayer).toHaveBeenCalledTimes(1);
    expect(costing.restoreLayer).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      5,
      new Decimal('112'),
      'REFUND_RESTORE',
      'sale-1',
      tx,
    );
  });

  // ── 4. Multi-product sale — each product resolves its own OUT layer ──

  it('resolves each product separately in a multi-product sale', async () => {
    costing.findOutLayersByReferenceAndProduct.mockImplementation(
      (_c: string, _r: string, _s: string, productId: string) =>
        Promise.resolve(
          productId === 'prod-a'
            ? [outLayer(1, '100')]
            : [outLayer(2, '90')],
        ),
    );

    await run(
      payload([
        { productId: 'prod-a', quantity: 1 },
        { productId: 'prod-b', quantity: 2 },
      ]),
    );

    expect(costing.findOutLayersByReferenceAndProduct).toHaveBeenCalledWith(
      'comp-1',
      'SALE',
      'sale-1',
      'prod-a',
      tx,
    );
    expect(costing.findOutLayersByReferenceAndProduct).toHaveBeenCalledWith(
      'comp-1',
      'SALE',
      'sale-1',
      'prod-b',
      tx,
    );
    expect(costing.restoreLayer).toHaveBeenCalledTimes(2);
    expect(costing.restoreLayer).toHaveBeenCalledWith(
      'prod-a',
      'comp-1',
      1,
      new Decimal('100'),
      'REFUND_RESTORE',
      'sale-1',
      tx,
    );
    expect(costing.restoreLayer).toHaveBeenCalledWith(
      'prod-b',
      'comp-1',
      2,
      new Decimal('45'),
      'REFUND_RESTORE',
      'sale-1',
      tx,
    );
  });

  // ── 5. Legacy refund — no OUT layers ────────────────────────────────

  it('performs no CostLayer restore for a legacy sale without OUT layers', async () => {
    costing.findOutLayersByReferenceAndProduct.mockResolvedValue([]);

    await expect(
      run(payload([{ productId: 'prod-1', quantity: 5 }])),
    ).resolves.not.toThrow();

    expect(costing.restoreLayer).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // ── 6. Partial OUT coverage — anomaly, no partial restore ───────────

  it('skips the restore and logs an anomaly when OUT coverage is partial (3 of 5)', async () => {
    costing.findOutLayersByReferenceAndProduct.mockResolvedValue([
      outLayer(3, '330'),
    ]);

    await expect(
      run(payload([{ productId: 'prod-1', quantity: 5 }])),
    ).resolves.not.toThrow();

    expect(costing.restoreLayer).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'OUT layers cover 3 units but refund expects 5',
      ),
    );
  });

  // ── 7. Excess OUT coverage — anomaly, no over-restore ───────────────

  it('skips the restore and logs an anomaly when OUT coverage exceeds the refund (7 of 5)', async () => {
    costing.findOutLayersByReferenceAndProduct.mockResolvedValue([
      outLayer(7, '770'),
    ]);

    await expect(
      run(payload([{ productId: 'prod-1', quantity: 5 }])),
    ).resolves.not.toThrow();

    expect(costing.restoreLayer).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'OUT layers cover 7 units but refund expects 5',
      ),
    );
  });

  // ── 8. Restore failure propagates (transaction rollback upstream) ───

  it('propagates restoreLayer failures so the whole refund transaction rolls back', async () => {
    costing.findOutLayersByReferenceAndProduct.mockResolvedValue([
      outLayer(5, '560'),
    ]);
    costing.restoreLayer.mockRejectedValue(
      new Error('cost layer write failed'),
    );

    await expect(
      run(payload([{ productId: 'prod-1', quantity: 5 }])),
    ).rejects.toThrow('cost layer write failed');
  });

  // ── 9. Stock restore still happens alongside the layer restore ──────

  it('keeps the existing stock-restore behavior when the FIFO restore runs', async () => {
    costing.findOutLayersByReferenceAndProduct.mockResolvedValue([
      outLayer(5, '560'),
    ]);

    await run(payload([{ productId: 'prod-1', quantity: 5 }]));

    expect(repo.updateStock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ quantity: 5 }),
      'comp-1',
      expect.any(Number),
      tx,
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'RETURN' }),
    });
  });
});
