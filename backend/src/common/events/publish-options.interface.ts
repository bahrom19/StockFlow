/**
 * Contextual options passed alongside every {@code publish()} call.
 *
 * {@code context} is a free-form bag that the in-process implementation
 * passes through to every registered handler. It is designed for:
 * - Prisma TransactionClient — handlers execute inside the
 *   originating business transaction
 * - Correlation / causation IDs for distributed tracing
 *
 * Future outbox / message-bus implementations MAY ignore the context
 * and instead serialise the event to a durable store.
 */

export interface PublishOptions {
  readonly context?: Record<string, unknown>;
}
