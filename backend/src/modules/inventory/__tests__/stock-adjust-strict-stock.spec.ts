import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { StockService } from '../services/stock.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CostingService } from '../services/costing.service';
import { EVENT_BUS } from '../../../common/events';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Phase 6B — strict stock for manual adjustments.
 *
 * The old implementation clamped `before + qty` with `Math.max(0, …)`, which
 * made the negative-balance guard unreachable dead code. Under Policy A an
 * adjustment that would drive the balance below zero must be rejected and the
 * whole transaction rolled back — never silently clamped.
 */
describe('StockService.adjustStock — strict stock (Policy A)', () => {
  let service: StockService;
  let repo: {
    findProductById: jest.Mock;
    findWarehouseById: jest.Mock;
    findStockByProductAndWarehouse: jest.Mock;
    createStock: jest.Mock;
    updateStock: jest.Mock;
    createStockMovement: jest.Mock;
  };
  let mockPrisma: { $transaction: jest.Mock };
  let auditLog: { log: jest.Mock };
  let costing: {
    calculateAverageCost: jest.Mock;
    resolvePositiveEntryUnitCost: jest.Mock;
    recordInboundLayer: jest.Mock;
    consumeFifoLayers: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };

  const stockRow = (quantity: number) => ({
    id: 'stock-1',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantity,
    reservedQuantity: 0,
    availableQuantity: quantity,
    rowVersion: 0,
  });

  const dto = (quantity: number) => ({
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantity,
    reason: 'test',
  });

  beforeEach(() => {
    repo = {
      findProductById: jest.fn().mockResolvedValue({
        id: 'prod-1',
        costPrice: new Decimal('100'),
      }),
      findWarehouseById: jest.fn().mockResolvedValue({ id: 'wh-1' }),
      findStockByProductAndWarehouse: jest.fn(),
      createStock: jest.fn().mockResolvedValue(stockRow(0)),
      updateStock: jest.fn().mockResolvedValue({ id: 'stock-1' }),
      createStockMovement: jest.fn().mockResolvedValue({ id: 'mov-1' }),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    costing = {
      calculateAverageCost: jest.fn().mockResolvedValue(new Decimal('0')),
      recordInboundLayer: jest.fn().mockResolvedValue(undefined),
      // G16-H-1: default resolver fixture — average basis @ 15 (matches the
      // calculateAverageCost fixture the old ladder relied on).
      resolvePositiveEntryUnitCost: jest
        .fn()
        .mockResolvedValue({ unitCost: new Decimal('15'), source: 'AVERAGE' }),
      consumeFifoLayers: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };

    const idempotencyService = {
      hashRequest: jest.fn().mockReturnValue('hash'),
    } as unknown as IdempotencyService;

    service = new StockService(
      repo as unknown as InventoryRepository,
      mockPrisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      costing as unknown as CostingService,
      idempotencyService,
      eventBus as any,
    );
  });

  it('rejects an adjustment that would drive stock below zero (3 − 10)', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(3));

    await expect(
      service.adjustStock(dto(-10), 'comp-1', 'user-1'),
    ).rejects.toThrow(new BadRequestException('Insufficient stock'));

    // No partial application, no movement, no cost-layer or event side effects.
    expect(repo.updateStock).not.toHaveBeenCalled();
    expect(repo.createStockMovement).not.toHaveBeenCalled();
    expect(costing.recordInboundLayer).not.toHaveBeenCalled();
    expect(costing.consumeFifoLayers).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('allows an adjustment exactly to zero and keeps the ledger invariant (3 − 3 = 0)', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(3));

    await service.adjustStock(dto(-3), 'comp-1', 'user-1');

    expect(repo.updateStock).toHaveBeenCalledWith(
      'stock-1',
      expect.objectContaining({ quantity: 0, availableQuantity: 0 }),
      'comp-1',
      0,
      expect.anything(),
    );
    expect(repo.createStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: StockMovementType.ADJUSTMENT,
        quantity: -3,
        beforeQuantity: 3,
        afterQuantity: 0,
      }),
      expect.anything(),
    );
    const movement = repo.createStockMovement.mock.calls[0][0];
    expect(movement.beforeQuantity + movement.quantity).toBe(
      movement.afterQuantity,
    );
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('rejects when no stock record exists and the adjustment is negative', async () => {
    // The zero-quantity stock row is created inside the transaction first;
    // the negative-balance guard then rejects and the whole tx rolls back.
    repo.findStockByProductAndWarehouse.mockResolvedValue(null);

    await expect(
      service.adjustStock(dto(-1), 'comp-1', 'user-1'),
    ).rejects.toThrow(new BadRequestException('Insufficient stock'));
    // No committed side effects: no update, no movement, no event.
    expect(repo.updateStock).not.toHaveBeenCalled();
    expect(repo.createStockMovement).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  // ── G16-F (NWD-01): fail-closed cost-layer consume for adjustments ────
  //
  // Every consume failure must propagate out of the $transaction callback so
  // Prisma rolls back the whole adjustment (stock update, movement, layers,
  // GL journal, audit). "Complete rollback" is verified at the DB-contract
  // level: every mutation that DID run received the transaction client (so
  // it belongs to the aborted tx), and NO post-consume step (event publish,
  // audit log) ever executed.

  const fifoResult = (total: string) =>
    ({
      layers: [{ layerId: 'layer-1', quantity: 1, unitCost: '15', cost: '15' }],
      totalCost: new Decimal(total),
      fallbackCost: new Decimal('0'),
    }) as never;

  it('F1: fully layered negative adjustment succeeds and consumes layers with the FIFO valuation', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    costing.calculateAverageCost.mockResolvedValue(new Decimal('15'));
    costing.consumeFifoLayers.mockResolvedValue(fifoResult('30'));

    const movement = await service.adjustStock(dto(-2), 'comp-1', 'user-1');

    expect(movement).toBeDefined();
    expect(costing.consumeFifoLayers).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      2,
      'ADJUSTMENT',
      'stock-1',
      mockPrisma,
    );
    // GL-adjacent contract: the event carries the canonical FIFO unit cost
    // and the transaction client for the finance handler.
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ unitCost: '15', quantity: -2 }),
      }),
      { context: { transactionClient: mockPrisma } },
    );
    expect(auditLog.log).toHaveBeenCalled();
  });

  it('F2: zero layers and no costPrice → 400, transaction rolled back, no event/audit', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    costing.consumeFifoLayers.mockRejectedValue(
      new BadRequestException(
        'Insufficient cost layers and no costPrice basis. Short 2 units for product prod-1',
      ),
    );

    await expect(
      service.adjustStock(dto(-2), 'comp-1', 'user-1'),
    ).rejects.toThrow(BadRequestException);

    // The consume failure is the rollback trigger: mutations that already
    // ran belong to the aborted tx (they got the tx client), and nothing
    // after the consume step executed.
    expect(repo.updateStock).toHaveBeenCalledWith(
      'stock-1',
      expect.anything(),
      'comp-1',
      0,
      mockPrisma,
    );
    expect(repo.createStockMovement).toHaveBeenCalledWith(
      expect.anything(),
      mockPrisma,
    );
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('F3: partial layers with costPrice → success with layered+fallback valuation (FALLBACK B preserved)', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    costing.calculateAverageCost.mockResolvedValue(new Decimal('15'));
    // 1 layered unit + 1 fallback unit, canonical total 30.
    costing.consumeFifoLayers.mockResolvedValue(fifoResult('30'));

    await expect(
      service.adjustStock(dto(-2), 'comp-1', 'user-1'),
    ).resolves.toBeDefined();

    expect(costing.consumeFifoLayers).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      2,
      'ADJUSTMENT',
      'stock-1',
      mockPrisma,
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ unitCost: '15' }),
      }),
      { context: { transactionClient: mockPrisma } },
    );
  });

  it('F4: partial layers with no costPrice → 400, complete rollback', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    costing.consumeFifoLayers.mockRejectedValue(
      new BadRequestException(/no costPrice basis/.source),
    );

    await expect(
      service.adjustStock(dto(-2), 'comp-1', 'user-1'),
    ).rejects.toThrow(BadRequestException);

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
    expect(repo.updateStock).toHaveBeenCalledWith(
      'stock-1',
      expect.anything(),
      'comp-1',
      0,
      mockPrisma,
    );
  });

  it('F5: consume CAS loss → ConflictException (409), complete rollback, no silent retry', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    costing.consumeFifoLayers.mockRejectedValue(
      new ConflictException('Cost layer layer-1 was modified concurrently.'),
    );

    await expect(
      service.adjustStock(dto(-2), 'comp-1', 'user-1'),
    ).rejects.toThrow(ConflictException);

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('F14: cross-tenant productId → 404, no side effects (tenant isolation preserved)', async () => {
    // The product lookup is company-scoped; a foreign productId is invisible
    // exactly like a missing one — never a cross-tenant leak.
    repo.findProductById.mockResolvedValue(null);

    await expect(
      service.adjustStock(dto(-2), 'comp-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);

    expect(repo.updateStock).not.toHaveBeenCalled();
    expect(repo.createStockMovement).not.toHaveBeenCalled();
    expect(costing.consumeFifoLayers).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('G16-H-1: positive adjustment with average basis → layer at average cost (shared ladder)', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    costing.resolvePositiveEntryUnitCost = jest
      .fn()
      .mockResolvedValue({ unitCost: new Decimal('15'), source: 'AVERAGE' });

    await expect(service.adjustStock(dto(3), 'comp-1', 'user-1')).resolves.toBeDefined();
    expect(costing.recordInboundLayer).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      3,
      new Decimal('15'),
      'ADJUSTMENT',
      'stock-1',
      undefined,
      mockPrisma,
    );
  });

  it('G16-H-1: positive adjustment with Decimal(0) cost basis → zero-valued layer (valid zero-cost)', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    costing.resolvePositiveEntryUnitCost = jest
      .fn()
      .mockResolvedValue({ unitCost: new Decimal('0'), source: 'COST_PRICE' });

    await expect(service.adjustStock(dto(3), 'comp-1', 'user-1')).resolves.toBeDefined();
    expect(costing.recordInboundLayer).toHaveBeenCalledWith(
      'prod-1',
      'comp-1',
      3,
      new Decimal('0'),
      'ADJUSTMENT',
      'stock-1',
      undefined,
      mockPrisma,
    );
  });

  it('G16-H-1: positive adjustment without any basis → 400, rollback before layer/GL/event', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    costing.resolvePositiveEntryUnitCost = jest
      .fn()
      .mockResolvedValue({ unitCost: null, source: 'NONE' });

    await expect(
      service.adjustStock(dto(3), 'comp-1', 'user-1'),
    ).rejects.toThrow(/no cost basis for product/);
    expect(costing.recordInboundLayer).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('F6: unexpected consume error → propagated (500 path), never swallowed, complete rollback', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stockRow(10));
    costing.consumeFifoLayers.mockRejectedValue(
      new Error('unexpected costing infrastructure failure'),
    );

    // The pre-G16-F behaviour swallowed this class of error and committed a
    // drifting adjustment. Now it must propagate out of the tx callback.
    await expect(
      service.adjustStock(dto(-2), 'comp-1', 'user-1'),
    ).rejects.toThrow('unexpected costing infrastructure failure');
    await expect(
      service.adjustStock(dto(-2), 'comp-1', 'user-1'),
    ).rejects.not.toThrow(BadRequestException);

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });
});
