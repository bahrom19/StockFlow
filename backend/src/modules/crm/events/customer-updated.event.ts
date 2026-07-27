import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface CustomerUpdatedPayload {
  customerId: string;
  companyId: string;
  changes: Record<string, any>;
  updatedBy: string | null;
}

export class CustomerUpdatedEvent implements DomainEvent<CustomerUpdatedPayload> {
  readonly eventName = 'customer.updated';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: CustomerUpdatedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
