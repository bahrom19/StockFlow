import { Injectable } from '@nestjs/common';
import {
  DEFAULT_EVENT_HANDLER_PRIORITY,
  EventBus,
  SubscribeOptions,
} from './event-bus.interface';
import { PublishOptions } from './publish-options.interface';
import { DomainEvent } from './domain-event.interface';
import { EventHandler } from './event-handler.interface';

/**
 * Lightweight in-process domain event bus.
 *
 * Behaviour:
 * - Handlers execute **synchronously**, awaited sequentially in
 *   ascending priority order (lower priority value runs earlier);
 *   equal priorities keep registration order (stable sort) — G16-E.
 *   Events without explicit priorities behave exactly as before:
 *   registration order.
 * - If a {@code PublishOptions.context} is provided (e.g. a Prisma
 *   TransactionClient), every handler receives it so the business
 *   code can run inside the originating database transaction.
 * - Errors propagate — one failing handler bubbles up to the
 *   publisher so the caller can decide whether to roll back.
 *   Handlers that should never throw (e.g. audit, notification)
 *   MUST catch exceptions internally.
 * - Subscriptions are idempotent: registering the same handler instance
 *   twice for the same event registers it once (G16-N-4 P2 idempotency).
 *
 * This implementation is a deliberate starting point:
 * - It is compatible with an Outbox pattern — swap the bus
 *   implementation and write events to the outbox table instead.
 * - It is compatible with RabbitMQ / Kafka — swap the
 *   implementation to serialise the event and publish to a
 *   message broker.
 *
 * No business code needs to change when the implementation is swapped.
 */
@Injectable()
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, StoredHandler[]>();

  async publish<T extends DomainEvent>(
    event: T,
    options?: PublishOptions,
  ): Promise<void> {
    const stored = this.handlers.get(event.eventName) ?? [];

    // G16-E: deterministic execution order — priority ascending, then
    // registration index, so equal priorities are always stable regardless
    // of the engine's sort implementation.
    const ordered = stored
      .map((entry, registrationIndex) => ({ entry, registrationIndex }))
      .sort(
        (a, b) =>
          a.entry.priority - b.entry.priority ||
          a.registrationIndex - b.registrationIndex,
      );

    for (const { entry } of ordered) {
      await entry.handler.handle(event, options?.context);
    }
  }

  subscribe(
    eventName: string,
    handler: EventHandler,
    options?: SubscribeOptions,
  ): void {
    const existing = this.handlers.get(eventName) ?? [];

    // G16-N-4 P2 idempotency: subscribing the SAME handler instance twice
    // for the SAME event is a no-op. Before this guard a duplicate
    // registration ran the handler twice per publish, so a module wired up
    // twice (or any future dynamic-module refactor that re-ran
    // `onModuleInit`) would double every side effect — stock decrements,
    // FIFO consumption, JournalEntry rows and AccountBalance increments.
    // The blast radius was unbounded; the trigger was cheap and accidental.
    //
    // Identity is the handler INSTANCE (reference equality), scoped to one
    // event name. Distinct handlers are unaffected; priorities are never
    // re-evaluated for an already-registered handler, because a second
    // registration of the same instance cannot express a new intent — it
    // can only be an accident.
    if (existing.some((entry) => entry.handler === handler)) {
      return;
    }

    existing.push({
      handler,
      priority: options?.priority ?? DEFAULT_EVENT_HANDLER_PRIORITY,
    });
    this.handlers.set(eventName, existing);
  }
}

interface StoredHandler {
  handler: EventHandler;
  priority: number;
}
