import { DomainEvent } from '../../../common/events';
import { PurchaseOrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Generic purchase-order status-change event (Notifications V1 — N3).
 *
 * Published for EVERY real status transition, additively to the existing
 * finance events (`purchase.order.created`, `purchase.order.approved`),
 * which remain untouched.
 *
 * Receipt-driven transitions (PARTIALLY_RECEIVED / RECEIVED via
 * updateStatusAfterReceipt) have no acting user, therefore `changedBy`
 * is nullable.
 */
export interface PurchaseOrderStatusChangedPayload {
  purchaseOrderId: string;
  companyId: string;
  supplierId: string;
  orderNumber: string;
  previousStatus: PurchaseOrderStatus;
  newStatus: PurchaseOrderStatus;
  changedBy: string | null;
  rowVersion: number;
}

export class PurchaseOrderStatusChangedEvent implements DomainEvent<PurchaseOrderStatusChangedPayload> {
  readonly eventName = 'purchase.order.status.changed';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PurchaseOrderStatusChangedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
