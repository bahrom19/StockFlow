import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface PurchaseOrderCreatedPayload {
  purchaseOrderId: string;
  companyId: string;
  supplierId: string;
  orderNumber: string;
  orderDate: Date;
  expectedDate: Date | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  currency: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: string;
    total: string;
  }>;
}

export class PurchaseOrderCreatedEvent implements DomainEvent<PurchaseOrderCreatedPayload> {
  readonly eventName = 'purchase.order.created';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PurchaseOrderCreatedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
