import { DomainEvent } from '../../../common/events';
import { SubscriptionChangedPayload } from '../interfaces/billing-event.interface';
import { randomUUID } from 'crypto';

export class SubscriptionChangedEvent implements DomainEvent<SubscriptionChangedPayload> {
  readonly eventName = 'billing.subscription.changed';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: SubscriptionChangedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
