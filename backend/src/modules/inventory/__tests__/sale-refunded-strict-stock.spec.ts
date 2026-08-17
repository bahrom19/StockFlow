import { StockMovementType } from '@prisma/client';
import { SaleRefundedEventHandler } from '../events/sale-refunded.handler';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';

/**
 * Phase 6B — refund invariants under strict stock (Policy A).
 *
 * Once oversell is rejected, a refund after a legitimate exact-stock sale must
 * restore the exact quantity (3 → 0 → 3) and every movement must keep the
 * ledger invariant `beforeQuantity + quantity == afterQuantity`.
 */
describe('SaleRefundedEventHandler — exact restore (strict stock)', () => {
  let handler: SaleRefundedEventHandler;
  let repo: {
    findStockByProductAndWarehouse: jest.Mock;
    updateStock: jest.Mock;
    createStock: jest.Mock;
  };
  let updateStock: jest.Mock;
  let createStock: jest.Mock;
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
    updateStock = jest.fn().mockResolvedValue({ id: 'stock-1' });
    createStock = jest.fn().mockResolvedValue({ id: 'stock-1' });
    createMovement = jest.fn().mockResolvedValue({ id: 'mov-1' });
    repo = {
      findStockByProductAndWarehouse: jest.fn(),
      updateStock,
      createStock,
    };
    handler = new SaleRefundedEventHandler(
      repo as unknown as InventoryRepository,
      {} as PrismaService,
    );
  });

  it('refund after an exact-stock sale restores the exact quantity (3 → 0 → 3)', async () => {
    // Stock is 0 after the exact sale of 3.
    repo.findStockByProductAndWarehouse.mockResolvedValue(stock(0));

    await handler.handle(
      { eventName: 'sale.refunded', payload: payload(3) } as any,
      {
        transactionClient: {
          stockMovement: { create: createMovement },
        },
      },
    );

    expect(updateStock).toHaveBeenCalledWith(
      'stock-1',
      expect.objectContaining({ quantity: 3, availableQuantity: 3 }),
      'comp-1',
      0,
      expect.anything(),
    );
    expect(createMovement).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: StockMovementType.RETURN,
        quantity: 3,
        beforeQuantity: 0,
        afterQuantity: 3,
      }),
    });
    const movement = createMovement.mock.calls[0][0].data;
    expect(movement.beforeQuantity + movement.quantity).toBe(
      movement.afterQuantity,
    );
  });

  it('keeps the ledger consistent for a partial refund (3 → 0, refund 2 → 2)', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(stock(0));

    await handler.handle(
      { eventName: 'sale.refunded', payload: payload(2) } as any,
      {
        transactionClient: {
          stockMovement: { create: createMovement },
        },
      },
    );

    const movement = createMovement.mock.calls[0][0].data;
    expect(movement.beforeQuantity).toBe(0);
    expect(movement.afterQuantity).toBe(2);
    expect(movement.beforeQuantity + movement.quantity).toBe(
      movement.afterQuantity,
    );
  });

  it('creates a stock record when none exists (never fabricates quantity)', async () => {
    repo.findStockByProductAndWarehouse.mockResolvedValue(null);

    await handler.handle(
      { eventName: 'sale.refunded', payload: payload(5) } as any,
      {
        transactionClient: {
          stockMovement: { create: createMovement },
        },
      },
    );

    expect(createStock).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 5,
        reservedQuantity: 0,
        availableQuantity: 5,
      }),
      expect.anything(),
    );
    const movement = createMovement.mock.calls[0][0].data;
    expect(movement.beforeQuantity + movement.quantity).toBe(
      movement.afterQuantity,
    );
  });
});
