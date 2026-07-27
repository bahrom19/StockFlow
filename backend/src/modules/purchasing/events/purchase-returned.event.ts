import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface PurchaseReturnedPayload {
  purchaseReturnId: string;
  companyId: string;
  supplierId: string;
  warehouseId: string;
  returnNumber: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: string;
    total: string;
  }>;
}

export class PurchaseReturnedEvent implements DomainEvent<PurchaseReturnedPayload> {
  readonly eventName = 'purchase.returned';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PurchaseReturnedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
