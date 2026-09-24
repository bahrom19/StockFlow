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

  // Positive line without any cost basis: stock moves, no layer, no finance event.
  it('should skip layer and finance event when no cost basis exists', async () => {
    mockRepo.findInventoryCountById.mockResolvedValue(draftCount([countItem(10, 15)]));
    mockRepo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    mockCosting.calculateAverageCost.mockResolvedValueOnce(new Decimal('0'));
    mockRepo.findProductById.mockResolvedValueOnce({ id: productId, costPrice: null });

    await service.complete('count-1', { rowVersion: 0 } as any, companyId, userId);

    expect(mockRepo.updateStock).toHaveBeenCalled();
    expect(mockRepo.createStockMovement).toHaveBeenCalledTimes(1);
    expect(mockCosting.recordInboundLayer).not.toHaveBeenCalled();
    const adjustedCalls = mockEventBus.publish.mock.calls.filter(
      ([event]: any) => event?.eventName === 'inventory.adjusted',
    );
    expect(adjustedCalls).toHaveLength(0);
  });
});
