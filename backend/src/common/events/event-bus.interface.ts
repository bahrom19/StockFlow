import { DomainEvent } from './domain-event.interface';
import { EventHandler } from './event-handler.interface';
import { PublishOptions } from './publish-options.interface';

/**
 * In-process domain event bus.
 *
 * Responsibilities:
 * 1. Route events to registered handlers (sync, within the publisher's
 *    transaction when a context is provided)
 * 2. Keep a simple surface so the concrete implementation can be
 *    swapped for an outbox-based or message-bus bridge without
 *    changing any business code
 *
 * @example SalesService (inside a Prisma $transaction)
 * ```ts
 * await this.eventBus.publish(
 *   new SaleCompletedEvent(payload),
 *   { context: { transactionClient: tx } },
 * );
 * ```
 */
export interface EventBus {
  /**
   * Publish a domain event to all registered handlers.
   *
   * @param event   The domain event to publish
   * @param options Optional infrastructure context
   */
  publish<T extends DomainEvent>(
    event: T,
    options?: PublishOptions,
  ): Promise<void>;

  /**
   * Register a handler for a specific event name.
   * Multiple handlers may be registered for the same event;
   * they are executed in registration order.
   */
  subscribe(eventName: string, handler: EventHandler): void;
}
