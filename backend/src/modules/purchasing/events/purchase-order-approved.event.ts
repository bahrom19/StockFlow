import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface PurchaseOrderApprovedPayload {
  purchaseOrderId: string;
  companyId: string;
  supplierId: string;
  orderNumber: string;
  orderDate: Date;
  expectedDate: Date | null;
  approvedBy: string;
  approvedAt: Date;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: string;
    total: string;
  }>;
}

export class PurchaseOrderApprovedEvent implements DomainEvent<PurchaseOrderApprovedPayload> {
  readonly eventName = 'purchase.order.approved';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PurchaseOrderApprovedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
