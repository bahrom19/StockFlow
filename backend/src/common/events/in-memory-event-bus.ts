import { Injectable } from '@nestjs/common';
import { EventBus } from './event-bus.interface';
import { PublishOptions } from './publish-options.interface';
import { DomainEvent } from './domain-event.interface';
import { EventHandler } from './event-handler.interface';

/**
 * Lightweight in-process domain event bus.
 *
 * Behaviour:
 * - Handlers execute **synchronously** in registration order.
 * - If a {@code PublishOptions.context} is provided (e.g. a Prisma
 *   TransactionClient), every handler receives it so the business
 *   code can run inside the originating database transaction.
 * - Errors propagate — one failing handler bubbles up to the
 *   publisher so the caller can decide whether to roll back.
 *   Handlers that should never throw (e.g. audit, notification)
 *   MUST catch exceptions internally.
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
  private readonly handlers = new Map<string, EventHandler[]>();

  async publish<T extends DomainEvent>(
    event: T,
    options?: PublishOptions,
  ): Promise<void> {
    const handlers = this.handlers.get(event.eventName) ?? [];

    for (const handler of handlers) {
      await handler.handle(event, options?.context);
    }
  }

  subscribe(eventName: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventName) ?? [];
    existing.push(handler);
    this.handlers.set(eventName, existing);
  }
}
