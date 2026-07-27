import { DomainEvent } from '../../../common/events';
import { InvoiceGeneratedPayload } from '../interfaces/billing-event.interface';
import { randomUUID } from 'crypto';

export class InvoiceGeneratedEvent implements DomainEvent<InvoiceGeneratedPayload> {
  readonly eventName = 'billing.invoice.generated';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: InvoiceGeneratedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
