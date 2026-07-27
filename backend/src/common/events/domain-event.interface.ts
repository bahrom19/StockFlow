/**
 * Base interface for every domain event in StockFlow.
 *
 * All events carry:
 * - eventName — unique identifier used for routing (e.g. "sale.completed")
 * - eventId   — unique UUID per occurrence
 * - occurredOn — UTC timestamp
 *
 * The generic {@code payload} field holds the type-safe business data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic event payload, not accidental any
export interface DomainEvent<T = any> {
  readonly eventName: string;
  readonly eventId: string;
  readonly occurredOn: Date;

  /**
   * Business payload — the data that changed.
   * Type is determined by the concrete event class.
   */
  readonly payload: T;
}
