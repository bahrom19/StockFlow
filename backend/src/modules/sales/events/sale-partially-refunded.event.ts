import { DomainEvent } from '../../../common/events';
import { SalePartiallyRefundedEventPayload } from '../interfaces/sale-event.interface';
import { randomUUID } from 'crypto';

/**
 * G11-E E3 — fired when a partial refund (or a final refund after previous
 * partials) has been durably recorded as SalesRefund/SalesRefundItem facts.
 *
 * Payload items mirror the canonical SalesRefundItem rows: the refunded
 * quantity and its materialized historical `fifoCost` — never the original
 * SaleItem quantities. The legacy single-shot full refund from COMPLETED
 * keeps using the unchanged `SaleRefundedEvent` (`sale.refunded`); the two
 * inventory events are mutually exclusive per refund operation.
 */
export class SalePartiallyRefundedEvent
  implements DomainEvent<SalePartiallyRefundedEventPayload>
{
  readonly eventName = 'sale.partially_refunded';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: SalePartiallyRefundedEventPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
