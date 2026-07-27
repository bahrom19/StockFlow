import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface CustomerDeletedPayload {
  customerId: string;
  companyId: string;
  deletedBy: string | null;
}

export class CustomerDeletedEvent implements DomainEvent<CustomerDeletedPayload> {
  readonly eventName = 'customer.deleted';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: CustomerDeletedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
