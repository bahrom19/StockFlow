import { BadRequestException } from '@nestjs/common';
import { InventoryCountService } from '../services/inventory-count.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CostingService } from '../services/costing.service';
import { EVENT_BUS } from '../../../common/events';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * G15-05-A regression — inventory count completion maintains the full
 * accounting triple (stock + CostLayer + GL) atomically.
 *
 * Previously `complete()` only wrote Stock + COUNT_ADJUSTMENT movement:
 * no CostLayer, no GL journal, no AccountBalance effect, and a missing
 * Stock row was silently skipped while the movement was still recorded.
 */
describe('InventoryCountService.complete — accounting integrity (G15-05-A)', () => {
  let service: InventoryCountService;
  let mockTx: any;
  let mockRepo: any;
  let mockPrisma: any;
  let mockAuditLog: any;
  let mockCosting: any;
  let mockEventBus: any;

  const companyId = 'comp-1';
  const userId = 'user-1';
  const warehouseId = 'wh-1';
  const productId = 'prod-1';

  const countItem = (expected: number, actual: number) => ({
    productId,
    expectedQuantity: expected,
    actualQuantity: actual,
    difference: actual - expected,
  });

  const draftCount = (items: any[]) => ({
    id: 'count-1',
    companyId,
    warehouseId,
    countNumber: 'CNT-001',
    status: 'DRAFT',
    rowVersion: 0,
    items,
  });

  beforeEach(() => {
    mockTx = {};
    mockRepo = {
      // B02-08: complete() now validates persisted warehouse/product
      // ownership before mutating, so the fixture must provide the
      // company-scoped lookups it uses.
      findWarehouseById: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve({ id, isActive: true, deletedAt: null }),
        ),
      findProductsByIds: jest
        .fn()
        .mockImplementation((ids: string[]) =>
          Promise.resolve(
            ids.map((id) => ({ id, costPrice: null, isActive: true })),
          ),
        ),
      findInventoryCountById: jest.fn(),
      updateInventoryCount: jest.fn().mockResolvedValue({}),
      findStockByProductAndWarehouse: jest.fn(),
      createStock: jest.fn(),
      updateStock: jest.fn().mockResolvedValue({}),
      createStockMovement: jest.fn().mockResolvedValue({}),
      findProductById: jest.fn(),
    };
    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };
    mockCosting = {
      calculateAverageCost: jest
        .fn()
        .mockResolvedValue(new Decimal('20')),
      // G16-H-1: the shared positive-entry ladder — default fixture resolves
      // AVERAGE @ 20 (same effective basis the old ladder produced).
      resolvePositiveEntryUnitCost: jest
        .fn()
        .mockResolvedValue({ unitCost: new Decimal('20'), source: 'AVERAGE' }),
      recordInboundLayer: jest.fn().mockResolvedValue(undefined),
      consumeFifoLayers: jest.fn().mockResolvedValue({ totalCost: new Decimal('100') }),
    };
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    service = new InventoryCountService(
      mockRepo,
      mockPrisma,
      mockAuditLog,
      mockCosting,
      mockEventBus,
    );
  });

  const stockRow = (quantity: number) => ({
    id: 'stock-1',
    productId,
    warehouseId,
    companyId,
    quantity,
    reservedQuantity: 0,
    rowVersion: 1,
  });

  // 1+4. Positive difference: stock set to actual, IN layer at average cost.
  it('should apply a positive difference with an IN cost layer', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 15)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    expect(mockRepo.updateStock).toHaveBeenCalledWith(
      'stock-1',
      expect.objectContaining({ quantity: 15 }),
      companyId,
      1,
      mockTx,
    );
    expect(mockCosting.recordInboundLayer).toHaveBeenCalledTimes(1);
    const layerCall = mockCosting.recordInboundLayer.mock.calls[0];
    expect(layerCall.slice(0, 3)).toEqual([productId, companyId, 5]);
    expect(layerCall[3].toString()).toBe('20');
    expect(layerCall.slice(4, 6)).toEqual(['INVENTORY_COUNT', 'count-1']);
  });

  // 2+6. Negative difference consumes FIFO layers.
  it('should consume FIFO layers on a negative difference', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(15, 10)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(15));

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    expect(mockRepo.updateStock).toHaveBeenCalledWith(
      'stock-1',
      expect.objectContaining({ quantity: 10 }),
      companyId,
      1,
      mockTx,
    );
    expect(mockCosting.consumeFifoLayers).toHaveBeenCalledWith(
      productId,
      companyId,
      5,
      'INVENTORY_COUNT',
      'count-1',
      mockTx,
    );
    expect(mockCosting.recordInboundLayer).not.toHaveBeenCalled();
  });

  // 3. Zero difference: no financial side effects.
  it('should skip stock, layers and finance events for zero differences', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 10)]));

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    expect(mockRepo.updateStock).not.toHaveBeenCalled();
    expect(mockRepo.createStockMovement).not.toHaveBeenCalled();
    expect(mockCosting.recordInboundLayer).not.toHaveBeenCalled();
    expect(mockCosting.consumeFifoLayers).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  // 5+7+8. Financial event carries everything the GL handler needs.
  it('should publish an adjustment event driving the 1300/5100 journal', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 15)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    const adjustedCalls = mockEventBus.publish.mock.calls.filter(
      ([event]: any) => event?.eventName === 'inventory.adjusted',
    );
    expect(adjustedCalls).toHaveLength(1);
    expect(adjustedCalls[0][0].payload).toEqual(
      expect.objectContaining({
        productId,
        companyId,
        warehouseId,
        quantity: 5,
        beforeQuantity: 10,
        afterQuantity: 15,
        referenceType: 'INVENTORY_COUNT',
        referenceId: 'count-1',
        unitCost: '20',
      }),
    );
    // Published inside the transaction so GL + balances commit atomically.
    expect(adjustedCalls[0][1]).toEqual(
      expect.objectContaining({
        context: expect.objectContaining({ transactionClient: mockTx }),
      }),
    );
  });

  // 10. Missing Stock row is materialized (Option A, adjust-path invariant).
  it('should create a zero stock row when none exists', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(0, 7)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(null);
    mockRepo.createStock.mockResolvedValue(stockRow(0));

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    expect(mockRepo.createStock).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateStock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ quantity: 7 }),
      companyId,
      expect.anything(),
      mockTx,
    );
    expect(mockRepo.createStockMovement).toHaveBeenCalledTimes(1);
  });

  // 11. Valuation failure rolls back the entire count.
  it('should roll back stock and movement when FIFO consumption fails', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(15, 10)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(15));
    mockCosting.consumeFifoLayers.mockRejectedValueOnce(
      new Error('Insufficient cost layers and no costPrice basis'),
    );

    await expect(
      service.complete('count-1', { rowVersion: 0 } as any, companyId, userId),
    ).rejects.toThrow('Insufficient cost layers');

    expect(mockRepo.createStockMovement).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  // 11b. GL-side failure (event publish) rolls back too.
  it('should roll back when the finance event publish fails', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 15)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    mockEventBus.publish.mockRejectedValueOnce(new Error('bus down'));

    await expect(
      service.complete('count-1', { rowVersion: 0 } as any, companyId, userId),
    ).rejects.toThrow('bus down');
  });

  // 13. Concurrent/replayed completion is rejected.
  it('should reject completing a non-DRAFT count with no side effects', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(
      draftCount([countItem(10, 15)]),
    );
    // Simulate an already-completed count.
    mockRepo.findInventoryCountById.mockResolvedValueOnce({
      ...draftCount([countItem(10, 15)]),
      status: 'COMPLETED',
    } as any);

    await expect(
      service.complete('count-1', { rowVersion: 0 } as any, companyId, userId),
    ).rejects.toThrow(BadRequestException);

    expect(mockRepo.updateStock).not.toHaveBeenCalled();
    expect(mockCosting.recordInboundLayer).not.toHaveBeenCalled();
    expect(mockCosting.consumeFifoLayers).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  // 14. Tenant isolation.
  it('should scope count lookup to the company', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 10)]));

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    expect(mockRepo.findInventoryCountById).toHaveBeenCalledWith(
      'count-1',
      companyId,
      mockTx,
    );
  });

  // G16-H-1: positive differences without any basis are refused (fail-closed
  // gate); the old skip-and-continue behavior is intentionally gone.
  it('G16-H-1: refuses a positive difference when no cost basis exists', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 15)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    mockCosting.resolvePositiveEntryUnitCost.mockResolvedValueOnce({
      unitCost: null,
      source: 'NONE',
    });

    await expect(
      service.complete('count-1', { rowVersion: 0 } as any, companyId, userId),
    ).rejects.toThrow(/no cost basis for product/);
    // gate fires before valuation/stock side effects of the +diff line
    expect(mockCosting.recordInboundLayer).not.toHaveBeenCalled();
  });

  it('G16-H-1: zero costPrice is a valid basis for a positive difference', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 15)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    mockCosting.resolvePositiveEntryUnitCost.mockResolvedValueOnce({
      unitCost: new Decimal('0'),
      source: 'COST_PRICE',
    });

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    expect(mockCosting.recordInboundLayer).toHaveBeenCalledWith(
      productId,
      companyId,
      5,
      new Decimal('0'),
      'INVENTORY_COUNT',
      'count-1',
      undefined,
      expect.anything(),
    );
  });

  // ── G16-N-4 P1-A: shrinkage GL integrity ─────────────────────────────
  // Before this fix the financial event was gated on `if (unitCost)`, and
  // unitCost was resolved only for POSITIVE differences — so a negative
  // count (shrinkage) consumed FIFO valuation but never reached the finance
  // handler: no inventory.adjusted, no JournalEntry, no AccountBalance.
  const adjustedCalls = () =>
    mockEventBus.publish.mock.calls.filter(
      ([event]: any) => event?.eventName === 'inventory.adjusted',
    );

  it('G16-N-4: publishes inventory.adjusted for a negative difference with authoritative FIFO totalCost', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(15, 10)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(15));
    // Multi-layer consumption: 3 @ 100 + 2 @ 120 → totalCost 540 (avg 108).
    mockCosting.consumeFifoLayers.mockResolvedValueOnce({
      totalCost: new Decimal('540'),
      layers: [
        { layerId: 'l1', quantity: 3, unitCost: '100', cost: '300' },
        { layerId: 'l2', quantity: 2, unitCost: '120', cost: '240' },
      ],
      fallbackCost: new Decimal('0'),
    });

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    const adjusted = adjustedCalls();
    expect(adjusted).toHaveLength(1);
    // Authoritative totalCost passes through AS-IS — not avg-cost × qty,
    // not unitCost × qty. unitCost in the payload is observability-only
    // (totalCost / |difference| = 540 / 5 = 108).
    expect(adjusted[0][0].payload).toEqual(
      expect.objectContaining({
        productId,
        companyId,
        warehouseId,
        quantity: -5,
        beforeQuantity: 15,
        afterQuantity: 10,
        referenceType: 'INVENTORY_COUNT',
        referenceId: 'count-1',
        totalCost: '540',
        unitCost: '108',
        costBasis: 'FIFO',
      }),
    );
    // Published inside the transaction so GL + balances commit atomically.
    expect(adjusted[0][1]).toEqual(
      expect.objectContaining({
        context: expect.objectContaining({ transactionClient: mockTx }),
      }),
    );
  });

  it('G16-N-4: includes FIFO fallback cost in the GL payload', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 4)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    // Layers cover 4 @ 100 = 400; shortfall 2 units FALLBACK-B-priced at
    // costPrice 180 = 360 → totalCost 760.
    mockCosting.consumeFifoLayers.mockResolvedValueOnce({
      totalCost: new Decimal('760'),
      layers: [{ layerId: 'l1', quantity: 4, unitCost: '100', cost: '400' }],
      fallbackCost: new Decimal('360'),
    });

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    const adjusted = adjustedCalls();
    expect(adjusted).toHaveLength(1);
    expect(adjusted[0][0].payload).toEqual(
      expect.objectContaining({
        quantity: -6,
        totalCost: '760',
        unitCost: new Decimal('760').div(6).toString(),
        costBasis: 'FIFO',
      }),
    );
  });

  it('G16-N-4: publishes the event even when shrinkage cost is zero (handler zero-skips)', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(5, 3)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(5));
    // Valid zero-cost basis: shrinkage of genuinely zero-valued stock.
    mockCosting.consumeFifoLayers.mockResolvedValueOnce({
      totalCost: new Decimal('0'),
      layers: [],
      fallbackCost: new Decimal('0'),
    });

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    // The event IS published; the finance handler's canonical zero-amount
    // skip (GL_SKIP_ZERO_AMOUNT) decides that nothing is posted.
    const adjusted = adjustedCalls();
    expect(adjusted).toHaveLength(1);
    expect(adjusted[0][0].payload).toEqual(
      expect.objectContaining({
        quantity: -2,
        totalCost: '0',
        unitCost: '0',
        costBasis: 'FIFO',
      }),
    );
  });

  it('G16-N-4: positive differences still publish the legacy unitCost payload (no totalCost)', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 15)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    const adjusted = adjustedCalls();
    expect(adjusted).toHaveLength(1);
    const payload = adjusted[0][0].payload;
    expect(payload).toEqual(
      expect.objectContaining({
        quantity: 5,
        unitCost: '20',
        costBasis: 'AVERAGE',
      }),
    );
    expect(payload.totalCost).toBeUndefined();
  });

  it('G16-N-4: GL failure on a negative difference rolls back the whole count', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(15, 10)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(15));
    mockEventBus.publish.mockRejectedValueOnce(new Error('GL posting failed'));

    await expect(
      service.complete('count-1', { rowVersion: 0 } as any, companyId, userId),
    ).rejects.toThrow('GL posting failed');

    // The movement is written BEFORE the finance leg in code order — in the
    // real DB transaction the GL failure rolls stock/FIFO/movement/count back
    // together (single $transaction). In this unit mock the observable
    // downstream side effects must not have happened: no audit log, no
    // inventory.counted publication after the failed leg.
    expect(mockAuditLog.log).not.toHaveBeenCalled();
    expect(
      mockEventBus.publish.mock.calls.filter(
        ([event]: any) => event?.eventName === 'inventory.counted',
      ),
    ).toHaveLength(0);
  });
});
