import { DomainEvent } from '../../../common/events';
import { PurchaseOrderStatusChangedEvent } from '../../purchasing/events/purchase-order-status-changed.event';
import { PurchaseOrderStatusNotificationHandler } from '../handlers/purchase-order-status-notification.handler';
import { NotificationsService } from '../notifications.service';

describe('PurchaseOrderStatusNotificationHandler — targeting & never-throw', () => {
  let handler: PurchaseOrderStatusNotificationHandler;
  let service: { notifyPurchaseOrderStatusChanged: jest.Mock };

  const event = (changedBy: string | null) =>
    new PurchaseOrderStatusChangedEvent({
      purchaseOrderId: 'po-1',
      companyId: 'comp-1',
      supplierId: 'sup-1',
      orderNumber: 'PO-001',
      previousStatus: 'PENDING' as never,
      newStatus: 'APPROVED' as never,
      changedBy,
      rowVersion: 3,
    });

  beforeEach(() => {
    service = { notifyPurchaseOrderStatusChanged: jest.fn().mockResolvedValue(2) };
    handler = new PurchaseOrderStatusNotificationHandler(
      service as unknown as NotificationsService,
    );
  });

  it('forwards the payload (with tx) to the service', async () => {
    const tx = {} as never;
    await handler.handle(event('user-1'), {
      transactionClient: tx,
    } as Record<string, unknown>);

    expect(service.notifyPurchaseOrderStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseOrderId: 'po-1',
        companyId: 'comp-1',
        changedBy: 'user-1',
        rowVersion: 3,
      }),
      tx,
    );
  });

  it('ignores unrelated events', async () => {
    await handler.handle({
      eventName: 'sale.completed',
      eventId: 'e-2',
      occurredOn: new Date(),
      payload: {},
    } as unknown as DomainEvent);
    expect(service.notifyPurchaseOrderStatusChanged).not.toHaveBeenCalled();
  });

  it('service failure is caught — handler never throws (business tx protected)', async () => {
    service.notifyPurchaseOrderStatusChanged.mockRejectedValue(
      new Error('db down'),
    );
    await expect(handler.handle(event(null))).resolves.toBeUndefined();
    expect(service.notifyPurchaseOrderStatusChanged).toHaveBeenCalledTimes(1);
  });
});
