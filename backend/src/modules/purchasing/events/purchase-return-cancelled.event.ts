import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface PurchaseReturnCancelledPayload {
  purchaseReturnId: string;
  companyId: string;
  supplierId: string;
  warehouseId: string;
  returnNumber: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export class PurchaseReturnCancelledEvent implements DomainEvent<PurchaseReturnCancelledPayload> {
  readonly eventName = 'purchase.return.cancelled';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PurchaseReturnCancelledPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
