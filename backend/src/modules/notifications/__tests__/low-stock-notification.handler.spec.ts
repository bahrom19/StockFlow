import { InventoryAdjustedEvent } from '../../inventory/events/inventory-adjusted.event';
import { InventoryTransferredEvent } from '../../inventory/events/inventory-transferred.event';
import { SaleCompletedEvent } from '../../sales/events/sale-completed.event';
import { LowStockNotificationHandler } from '../handlers/low-stock-notification.handler';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../common/prisma';

const makeHandler = () => {
  const service = { notifyLowStock: jest.fn().mockResolvedValue(1) };
  const prisma = { stock: { findFirst: jest.fn() } };
  const handler = new LowStockNotificationHandler(
    service as unknown as NotificationsService,
    prisma as unknown as PrismaService,
  );
  return { handler, service, prisma };
};

describe('LowStockNotificationHandler — inventory.adjusted trigger', () => {
  let handler: LowStockNotificationHandler;
  let service: { notifyLowStock: jest.Mock };

  const adjustedEvent = (afterQuantity: number) =>
    new InventoryAdjustedEvent({
      productId: 'prod-1',
      companyId: 'comp-1',
      warehouseId: 'wh-1',
      quantity: 1,
      beforeQuantity: afterQuantity + 1,
      afterQuantity,
      reason: 'manual',
      adjustedBy: 'user-1',
    });

  beforeEach(() => {
    ({ handler, service } = makeHandler());
  });

  it('afterQuantity <= 5 → LOW_STOCK notification with trusted payload quantity', async () => {
    await handler.handle(adjustedEvent(3));
    expect(service.notifyLowStock).toHaveBeenCalledWith(
      'comp-1',
      'prod-1',
      'wh-1',
      3,
      undefined,
    );
  });

  it('boundary 5 triggers, 6 does not', async () => {
    await handler.handle(adjustedEvent(5));
    expect(service.notifyLowStock).toHaveBeenCalledTimes(1);

    service.notifyLowStock.mockClear();
    await handler.handle(adjustedEvent(6));
    expect(service.notifyLowStock).not.toHaveBeenCalled();
  });

  it('repository failure is caught — handler never throws (business tx protected)', async () => {
    service.notifyLowStock.mockRejectedValue(new Error('db down'));
    await expect(handler.handle(adjustedEvent(2))).resolves.toBeUndefined();
    expect(service.notifyLowStock).toHaveBeenCalledTimes(1);
  });
});

describe('LowStockNotificationHandler — sale.completed trigger', () => {
  let handler: LowStockNotificationHandler;
  let service: { notifyLowStock: jest.Mock };
  let prisma: { stock: { findFirst: jest.Mock } };

  const saleEvent = (productIds: string[]) =>
    new SaleCompletedEvent({
      saleId: 'sale-1',
      companyId: 'comp-1',
      warehouseId: 'wh-1',
      cashierId: 'user-1',
      customerId: null,
      saleNumber: 'S-001',
      subtotal: '100',
      discount: '0',
      total: '100',
      paidAmount: '100',
      changeAmount: '0',
      currency: 'KZT',
      items: productIds.map((productId) => ({
        productId,
        quantity: 1,
        unitPrice: '100',
        costPrice: '50',
        discount: '0',
        subtotal: '100',
        total: '100',
        margin: '50',
      })),
      payments: [],
    });

  beforeEach(() => {
    service = { notifyLowStock: jest.fn().mockResolvedValue(1) };
    prisma = { stock: { findFirst: jest.fn() } };
    handler = new LowStockNotificationHandler(
      service as unknown as NotificationsService,
      prisma as unknown as PrismaService,
    );
  });

  it('reads post-decrement stock via transactionClient; notifies at/below threshold', async () => {
    const tx = {
      stock: { findFirst: jest.fn().mockResolvedValue({ quantity: 4 }) },
    };
    await handler.handle(saleEvent(['prod-1']), {
      transactionClient: tx,
    } as Record<string, unknown>);

    expect(tx.stock.findFirst).toHaveBeenCalledWith({
      where: { companyId: 'comp-1', productId: 'prod-1', warehouseId: 'wh-1' },
      select: { quantity: true },
    });
    expect(prisma.stock.findFirst).not.toHaveBeenCalled();
    expect(service.notifyLowStock).toHaveBeenCalledWith(
      'comp-1',
      'prod-1',
      'wh-1',
      4,
      tx,
    );
  });

  it('duplicate sale lines read stock only once (no duplicate rows)', async () => {
    const tx = {
      stock: { findFirst: jest.fn().mockResolvedValue({ quantity: 2 }) },
    };
    await handler.handle(saleEvent(['prod-1', 'prod-1']), {
      transactionClient: tx,
    } as Record<string, unknown>);
    expect(tx.stock.findFirst).toHaveBeenCalledTimes(1);
    expect(service.notifyLowStock).toHaveBeenCalledTimes(1);
  });

  it('stock above threshold → no notification', async () => {
    const tx = {
      stock: { findFirst: jest.fn().mockResolvedValue({ quantity: 8 }) },
    };
    await handler.handle(saleEvent(['prod-1']), {
      transactionClient: tx,
    } as Record<string, unknown>);
    expect(service.notifyLowStock).not.toHaveBeenCalled();
  });

  it('missing stock row → skip silently (no exception)', async () => {
    const tx = { stock: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(
      handler.handle(saleEvent(['prod-1']), {
        transactionClient: tx,
      } as Record<string, unknown>),
    ).resolves.toBeUndefined();
    expect(service.notifyLowStock).not.toHaveBeenCalled();
  });
});

describe('LowStockNotificationHandler — inventory.transferred trigger', () => {
  let handler: LowStockNotificationHandler;
  let service: { notifyLowStock: jest.Mock };
  let prisma: { stock: { findFirst: jest.Mock } };

  const transferredEvent = () =>
    new InventoryTransferredEvent({
      productId: 'prod-1',
      companyId: 'comp-1',
      fromWarehouseId: 'wh-from',
      toWarehouseId: 'wh-to',
      quantity: 5,
      transferredBy: 'user-1',
    });

  beforeEach(() => {
    service = { notifyLowStock: jest.fn().mockResolvedValue(1) };
    prisma = { stock: { findFirst: jest.fn() } };
    handler = new LowStockNotificationHandler(
      service as unknown as NotificationsService,
      prisma as unknown as PrismaService,
    );
  });

  it('both warehouses checked; only the low-stock one is notified', async () => {
    prisma.stock.findFirst
      .mockResolvedValueOnce({ quantity: 3 }) // from → low
      .mockResolvedValueOnce({ quantity: 12 }); // to → ok

    await handler.handle(transferredEvent());

    expect(prisma.stock.findFirst).toHaveBeenCalledTimes(2);
    expect(service.notifyLowStock).toHaveBeenCalledTimes(1);
    expect(service.notifyLowStock).toHaveBeenCalledWith(
      'comp-1',
      'prod-1',
      'wh-from',
      3,
      undefined,
    );
  });

  it('both warehouses low → two notifications (distinct per-warehouse dedupe keys)', async () => {
    prisma.stock.findFirst
      .mockResolvedValueOnce({ quantity: 1 })
      .mockResolvedValueOnce({ quantity: 2 });

    await handler.handle(transferredEvent());
    expect(service.notifyLowStock).toHaveBeenCalledTimes(2);
    const calls = service.notifyLowStock.mock.calls;
    expect(calls[0][2]).toBe('wh-from');
    expect(calls[1][2]).toBe('wh-to');
  });
});
