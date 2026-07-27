import { DomainEvent } from '../../../common/events';
import { PaymentSucceededPayload } from '../interfaces/billing-event.interface';
import { randomUUID } from 'crypto';

export class PaymentSucceededEvent implements DomainEvent<PaymentSucceededPayload> {
  readonly eventName = 'billing.payment.succeeded';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PaymentSucceededPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
