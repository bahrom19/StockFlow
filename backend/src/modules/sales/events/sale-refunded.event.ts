import { DomainEvent } from '../../../common/events';
import { SaleRefundedEventPayload } from '../interfaces/sale-event.interface';
import { randomUUID } from 'crypto';

/**
 * Fired when a Sale transitions to REFUNDED status.
 */
export class SaleRefundedEvent implements DomainEvent<SaleRefundedEventPayload> {
  readonly eventName = 'sale.refunded';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: SaleRefundedEventPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
