import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface PurchaseReceivedPayload {
  purchaseOrderId: string;
  companyId: string;
  warehouseId: string;
  receivedBy: string;
  receiptNumber: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: string;
    batchNumber?: string;
    expiryDate?: string;
  }>;
}

export class PurchaseReceivedEvent implements DomainEvent<PurchaseReceivedPayload> {
  readonly eventName = 'purchase.received';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PurchaseReceivedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
