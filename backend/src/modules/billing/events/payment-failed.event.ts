import { DomainEvent } from '../../../common/events';
import { PaymentFailedPayload } from '../interfaces/billing-event.interface';
import { randomUUID } from 'crypto';

export class PaymentFailedEvent implements DomainEvent<PaymentFailedPayload> {
  readonly eventName = 'billing.payment.failed';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PaymentFailedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
