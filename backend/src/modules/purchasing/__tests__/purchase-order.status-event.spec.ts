import { PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';
import { EventBus } from '../../../common/events';
import { PrismaService } from '../../../common/prisma';
import { PurchaseOrderStatusChangedEvent } from '../events/purchase-order-status-changed.event';
import { CompaniesService } from '../../companies/services/companies.service';

/**
 * N3 — the generic status event is published ADDITIVELY: the existing
 * finance event (purchase.order.approved) and AuditLog stay untouched.
 */
describe('PurchaseOrderService — purchase.order.status.changed publishing', () => {
  const order = {
    id: 'po-1',
    orderNumber: 'PO-001',
    status: PurchaseOrderStatus.PENDING,
    companyId: 'comp-1',
    supplierId: 'sup-1',
    orderDate: new Date('2026-09-01'),
    expectedDate: null,
    subtotal: '10000',
    discountAmount: '0',
    taxAmount: '0',
    grandTotal: '10000',
    paidAmount: '0',
    currency: 'KZT',
    notes: null,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    rowVersion: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    items: [],
  };

  const makeService = () => {
    const purchaseOrderRepository = {
      findById: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockImplementation(async (_id, data) => ({
        ...order,
        ...data,
      })),
    };
    const prismaService = {
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          purchaseOrderItem: { findMany: jest.fn().mockResolvedValue([]) },
        }),
      ),
    };
    const auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    const documentSequenceService = { nextNumber: jest.fn() };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const companiesService = { getBaseCurrency: jest.fn().mockResolvedValue('KZT') };
    const service = new PurchaseOrderService(
      purchaseOrderRepository as unknown as PurchaseOrderRepository,
      prismaService as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      documentSequenceService as unknown as DocumentSequenceService,
      eventBus as unknown as EventBus,
      companiesService as unknown as import('../../companies/services/companies.service').CompaniesService,
    );
    return { service, purchaseOrderRepository, eventBus };
  };

  const statusEventFrom = (eventBus: { publish: jest.Mock }) =>
    eventBus.publish.mock.calls
      .map((c) => c[0])
      .find(
        (e) => e.eventName === 'purchase.order.status.changed',
      ) as PurchaseOrderStatusChangedEvent | undefined;

  it('transitionStatus publishes the generic event with full transition payload', async () => {
    const { service, eventBus } = makeService();

    await service.transitionStatus(
      'po-1',
      PurchaseOrderStatus.APPROVED,
      'user-1',
      'comp-1',
    );

    const statusEvent = statusEventFrom(eventBus);
    expect(statusEvent).toBeDefined();
    expect(statusEvent!.payload).toEqual({
      purchaseOrderId: 'po-1',
      companyId: 'comp-1',
      supplierId: 'sup-1',
      orderNumber: 'PO-001',
      previousStatus: PurchaseOrderStatus.PENDING,
      newStatus: PurchaseOrderStatus.APPROVED,
      changedBy: 'user-1',
      rowVersion: 3,
    });
  });

  it('existing purchase.order.approved event is still published (additive, not replacement)', async () => {
    const { service, eventBus } = makeService();

    await service.transitionStatus(
      'po-1',
      PurchaseOrderStatus.APPROVED,
      'user-1',
      'comp-1',
    );

    const eventNames = eventBus.publish.mock.calls.map(
      (c) => (c[0] as { eventName: string }).eventName,
    );
    expect(eventNames).toContain('purchase.order.approved');
    expect(eventNames).toContain('purchase.order.status.changed');
  });

  it('publish failure never breaks the PO lifecycle (caught + logged)', async () => {
    const { service, eventBus } = makeService();
    // Only the NEW generic event fails; the unwrapped legacy approved event
    // keeps its existing (unwrapped) semantics untouched.
    eventBus.publish.mockImplementation((e: { eventName: string }) =>
      e.eventName === 'purchase.order.status.changed'
        ? Promise.reject(new Error('event bus down'))
        : Promise.resolve(),
    );

    await expect(
      service.transitionStatus(
        'po-1',
        PurchaseOrderStatus.APPROVED,
        'user-1',
        'comp-1',
      ),
    ).resolves.toMatchObject({ status: PurchaseOrderStatus.APPROVED });
  });
});

describe('PurchaseOrderService — receipt-driven status events (changedBy: null)', () => {
  const baseOrder = {
    id: 'po-1',
    orderNumber: 'PO-001',
    status: PurchaseOrderStatus.ORDERED,
    companyId: 'comp-1',
    supplierId: 'sup-1',
    orderDate: new Date('2026-09-01'),
    expectedDate: null,
    subtotal: '10000',
    discountAmount: '0',
    taxAmount: '0',
    grandTotal: '10000',
    paidAmount: '0',
    currency: 'KZT',
    notes: null,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    rowVersion: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    items: [],
  };

  const makeService = (items: Array<{ quantity: number; receivedQuantity: number }>) => {
    const purchaseOrderRepository = {
      findById: jest.fn().mockResolvedValue(baseOrder),
      update: jest.fn().mockImplementation(async (_id, data) => ({
        ...baseOrder,
        ...data,
      })),
    };
    const prismaService = {
      $transaction: jest.fn(),
    };
    const auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const companiesService = { getBaseCurrency: jest.fn().mockResolvedValue('KZT') };
    const service = new PurchaseOrderService(
      purchaseOrderRepository as unknown as PurchaseOrderRepository,
      prismaService as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      {} as unknown as DocumentSequenceService,
      eventBus as unknown as EventBus,
      companiesService as unknown as import('../../companies/services/companies.service').CompaniesService,
    );
    const tx = {
      purchaseOrderItem: { findMany: jest.fn().mockResolvedValue(items) },
    };
    return { service, eventBus, tx };
  };

  const statusEventFrom = (eventBus: { publish: jest.Mock }) =>
    eventBus.publish.mock.calls
      .map((c) => c[0])
      .find(
        (e) => e.eventName === 'purchase.order.status.changed',
      ) as PurchaseOrderStatusChangedEvent | undefined;

  it('full receipt → RECEIVED event with changedBy null and post-update rowVersion', async () => {
    const { service, eventBus, tx } = makeService([
      { quantity: 5, receivedQuantity: 5 },
    ]);

    await service.updateStatusAfterReceipt('po-1', 'comp-1', tx as never);

    const statusEvent = statusEventFrom(eventBus);
    expect(statusEvent!.payload).toMatchObject({
      purchaseOrderId: 'po-1',
      previousStatus: PurchaseOrderStatus.ORDERED,
      newStatus: PurchaseOrderStatus.RECEIVED,
      changedBy: null,
      rowVersion: 8, // pre-update 7 + increment: 1 = 8
    });
  });

  it('partial receipt → PARTIALLY_RECEIVED event with post-update rowVersion', async () => {
    const { service, eventBus, tx } = makeService([
      { quantity: 5, receivedQuantity: 2 },
    ]);

    await service.updateStatusAfterReceipt('po-1', 'comp-1', tx as never);

    const statusEvent = statusEventFrom(eventBus);
    expect(statusEvent!.payload).toMatchObject({
      purchaseOrderId: 'po-1',
      previousStatus: PurchaseOrderStatus.ORDERED,
      newStatus: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      changedBy: null,
      rowVersion: 8, // pre-update 7 + increment: 1 = 8
    });
  });

  it('no received quantity → no status change → no event', async () => {
    const { service, eventBus, tx } = makeService([
      { quantity: 5, receivedQuantity: 0 },
    ]);

    await service.updateStatusAfterReceipt('po-1', 'comp-1', tx as never);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
