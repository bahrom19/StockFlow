import { BadRequestException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { SaleCompletedEventHandler } from '../events/sale-completed.handler';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';

/**
 * Phase 6B — Strict stock (Policy A) for sale completion.
 *
 * Regression coverage for F-02:
 * - oversell (requested > available) is rejected with 'Insufficient stock';
 * - the rejected sale produces no stock update and no movement;
 * - an exact-stock sale succeeds and keeps the ledger invariant
 *   `beforeQuantity + quantity == afterQuantity`;
 * - no stock record -> rejected;
 * - a concurrent race that leaves insufficient stock (updateMany count 0)
 *   -> rejected with 'Insufficient stock'.
 */
describe('SaleCompletedEventHandler — strict stock (Policy A)', () => {
  let handler: SaleCompletedEventHandler;
  let repo: {
    findStockByProductAndWarehouse: jest.Mock;
  };
  let updateMany: jest.Mock;
  let createMovement: jest.Mock;

  const payload = (quantity: number, productId = 'prod-1') => ({
    items: [{ productId, quantity }],
    warehouseId: 'wh-1',
    companyId: 'comp-1',
    saleId: 'sale-1',
    saleNumber: 'SALE-001',
    cashierId: 'user-1',
  });

  const stock = (quantity: number, reserved = 0) => ({
    id: 'stock-1',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantity,
    reservedQuantity: reserved,
    availableQuantity: quantity - reserved,
    rowVersion: 0,
  });

  beforeEach(() => {
    updateMany = jest.fn();
    createMovement = jest.fn().mockResolvedValue({ id: 'mov-1' });
    repo = {
      findStockByProductAndWarehouse: jest.fn(),
    };
    handler = new SaleCompletedEventHandler(
      repo as unknown as InventoryRepository,
      {} as PrismaService,
    );
  });

  it('rejects oversell (available 3, requested 10) — no update, no movement', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stock(3));

    await expect(
      handler.handle(
        { eventName: 'sale.completed', payload: payload(10) } as any,
        {
          transactionClient: {
            stock: { updateMany },
            stockMovement: { create: createMovement },
          },
        },
      ),
    ).rejects.toThrow(new BadRequestException('Insufficient stock'));

    expect(updateMany).not.toHaveBeenCalled();
    expect(createMovement).not.toHaveBeenCalled();
  });

  it('rejects when no stock record exists', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(null);

    await expect(
      handler.handle(
        { eventName: 'sale.completed', payload: payload(1) } as any,
        {
          transactionClient: {
            stock: { updateMany },
            stockMovement: { create: createMovement },
          },
        },
      ),
    ).rejects.toThrow(new BadRequestException('Insufficient stock'));
    expect(createMovement).not.toHaveBeenCalled();
  });

  it('exact-stock sale succeeds with atomic guarded decrement and consistent ledger', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stock(3));
    updateMany.mockResolvedValue({ count: 1 });

    await handler.handle(
      { eventName: 'sale.completed', payload: payload(3) } as any,
      {
        transactionClient: {
          stock: { updateMany },
          stockMovement: { create: createMovement },
        },
      },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'stock-1',
        companyId: 'comp-1',
        quantity: { gte: 3 },
      },
      data: {
        quantity: { decrement: 3 },
        availableQuantity: { decrement: 3 },
        rowVersion: { increment: 1 },
      },
    });
    expect(createMovement).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: StockMovementType.SALE,
        quantity: -3,
        beforeQuantity: 3,
        afterQuantity: 0,
      }),
    });
    const movement = createMovement.mock.calls[0][0].data;
    expect(movement.beforeQuantity + movement.quantity).toBe(
      movement.afterQuantity,
    );
  });

  it('rejects when reserved stock reduces available below requested', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stock(5, 3));

    await expect(
      handler.handle(
        { eventName: 'sale.completed', payload: payload(3) } as any,
        {
          transactionClient: {
            stock: { updateMany },
            stockMovement: { create: createMovement },
          },
        },
      ),
    ).rejects.toThrow(new BadRequestException('Insufficient stock'));
    expect(createMovement).not.toHaveBeenCalled();
  });

  it('concurrent race leaving insufficient stock -> rejected (updateMany count 0)', async () => {
    // Both requests read stock 3; the first decremented to 1, so the second's
    // guarded update matches 0 rows -> insufficient stock.
    repo.findStockByProductAndWarehouse.mockResolvedValue(stock(3));
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      handler.handle(
        { eventName: 'sale.completed', payload: payload(2) } as any,
        {
          transactionClient: {
            stock: { updateMany },
            stockMovement: { create: createMovement },
          },
        },
      ),
    ).rejects.toThrow(new BadRequestException('Insufficient stock'));
    expect(createMovement).not.toHaveBeenCalled();
  });
});
