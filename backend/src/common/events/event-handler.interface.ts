import { DomainEvent } from './domain-event.interface';
import { PublishOptions } from './publish-options.interface';

/**
 * Handler for a single type of domain event.
 *
 * Implementations must:
 * - Register with the EventBus via {@code EventBus.subscribe()}
 * - Be idempotent (same event delivered twice → same result)
 * - Handle errors gracefully — never throw from handlers in production
 *
 * The optional {@code context} parameter carries infrastructure metadata
 * such as the current Prisma transaction client so handlers can
 * execute inside the originating database transaction.
 */
export interface EventHandler<T extends DomainEvent = DomainEvent> {
  /**
   * Handle one event occurrence.
   *
   * @param event   The published domain event
   * @param context Optional infrastructure context (transaction client, etc.)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- infrastructure context, not accidental any
  handle(event: T, context?: Record<string, any>): Promise<void>;
}
