import { DomainEvent } from './domain-event.interface';
import { EventHandler } from './event-handler.interface';
import { PublishOptions } from './publish-options.interface';

/**
 * Default execution priority for event handlers that do not specify one.
 *
 * G16-E: handlers are ordered by priority ascending (lower runs earlier);
 * equal priorities keep registration order (stable). The default bucket
 * preserves the historical "registration order" behaviour for every event
 * whose handlers do not opt into an explicit priority.
 */
export const DEFAULT_EVENT_HANDLER_PRIORITY = 100;

/**
 * G16-E: explicit ordering options for a subscription.
 */
export interface SubscribeOptions {
  /**
   * Execution priority of the handler for this event.
   *
   * Lower numbers run earlier. Handlers with equal priority execute in
   * registration order (stable sort). Omit to use
   * {@link DEFAULT_EVENT_HANDLER_PRIORITY} (100).
   *
   * Used to encode hard inter-handler data dependencies — e.g. on
   * `sale.completed` the Inventory handler must create the FIFO CostLayers
   * before the Finance handler reads them for COGS
   * (Inventory 10 → Finance 20 → Notifications 30).
   */
  priority?: number;
}

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
   * Handlers run sequentially (awaited in order): ascending priority,
   * stable within equal priority. An error from any handler propagates
   * to the publisher so the caller can roll back.
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
   *
   * Multiple handlers may be registered for the same event; they are
   * executed in ascending {@link SubscribeOptions.priority} order, ties
   * broken by registration order (G16-E). Priorities only reorder
   * execution — a duplicate subscription still fires once per
   * subscription.
   */
  subscribe(
    eventName: string,
    handler: EventHandler,
    options?: SubscribeOptions,
  ): void;
}
