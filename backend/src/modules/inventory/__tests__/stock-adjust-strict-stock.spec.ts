import { BadRequestException } from '@nestjs/common';
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
});
