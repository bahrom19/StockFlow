import { DomainEvent } from '../../../common/events';
import { SubscriptionExpiredPayload } from '../interfaces/billing-event.interface';
import { randomUUID } from 'crypto';

export class SubscriptionExpiredEvent implements DomainEvent<SubscriptionExpiredPayload> {
  readonly eventName = 'billing.subscription.expired';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: SubscriptionExpiredPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
