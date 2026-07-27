import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent, EventHandler } from '../../../common/events';
import {
  SubscriptionCreatedEvent,
  SubscriptionChangedEvent,
  SubscriptionCancelledEvent,
  SubscriptionExpiredEvent,
  PaymentSucceededEvent,
  PaymentFailedEvent,
  InvoiceGeneratedEvent,
} from './index';

type BillingEvent =
  | SubscriptionCreatedEvent
  | SubscriptionChangedEvent
  | SubscriptionCancelledEvent
  | SubscriptionExpiredEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | InvoiceGeneratedEvent;

/**
 * Logs every billing domain event to the application log.
 * Registered in BillingModule. Subscribes to all billing events
 * and writes structured log entries for observability.
 */
@Injectable()
export class BillingAuditLoggerHandler implements EventHandler<DomainEvent> {
  private readonly logger = new Logger(BillingAuditLoggerHandler.name);

  async handle(event: BillingEvent, _context?: Record<string, unknown>): Promise<void> {
    const { eventName, eventId, payload } = event;

    this.logger.log(`Billing event: ${eventName}`, {
      eventName,
      eventId,
      ...payload,
    });
  }
}
