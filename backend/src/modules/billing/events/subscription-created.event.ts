import { DomainEvent } from '../../../common/events';
import { SubscriptionCreatedPayload } from '../interfaces/billing-event.interface';
import { randomUUID } from 'crypto';

export class SubscriptionCreatedEvent implements DomainEvent<SubscriptionCreatedPayload> {
  readonly eventName = 'billing.subscription.created';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: SubscriptionCreatedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
