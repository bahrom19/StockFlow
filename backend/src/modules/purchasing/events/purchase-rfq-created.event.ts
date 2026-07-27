import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface PurchaseRFQCreatedPayload {
  rfqId: string;
  companyId: string;
  rfqNumber: string;
  rfqDate: Date;
  expectedDate: Date | null;
  createdBy: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export class PurchaseRFQCreatedEvent implements DomainEvent<PurchaseRFQCreatedPayload> {
  readonly eventName = 'purchase.rfq.created';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PurchaseRFQCreatedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
