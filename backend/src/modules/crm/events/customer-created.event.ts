import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface CustomerCreatedPayload {
  customerId: string;
  companyId: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  groupId: string | null;
  createdBy: string | null;
}

export class CustomerCreatedEvent implements DomainEvent<CustomerCreatedPayload> {
  readonly eventName = 'customer.created';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: CustomerCreatedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
