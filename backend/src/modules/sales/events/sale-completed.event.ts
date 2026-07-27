import { DomainEvent } from '../../../common/events';
import { SaleCompletedEventPayload } from '../interfaces/sale-event.interface';
import { randomUUID } from 'crypto';

/**
 * Fired when a Sale transitions to COMPLETED status.
 *
 * Payload contains every value the Sale held at the moment of
 * completion — item snapshots, payment breakdown, monetary totals.
 */
export class SaleCompletedEvent implements DomainEvent<SaleCompletedEventPayload> {
  readonly eventName = 'sale.completed';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: SaleCompletedEventPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
