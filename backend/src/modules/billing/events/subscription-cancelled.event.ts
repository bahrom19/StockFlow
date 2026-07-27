import { DomainEvent } from '../../../common/events';
import { SubscriptionCancelledPayload } from '../interfaces/billing-event.interface';
import { randomUUID } from 'crypto';

export class SubscriptionCancelledEvent implements DomainEvent<SubscriptionCancelledPayload> {
  readonly eventName = 'billing.subscription.cancelled';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: SubscriptionCancelledPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
