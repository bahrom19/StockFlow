import { InMemoryEventBus } from '../in-memory-event-bus';
import { DomainEvent } from '../domain-event.interface';
import { EventHandler } from '../event-handler.interface';

class TestEvent implements DomainEvent<{ value: string }> {
  readonly eventName = 'test.event';
  readonly eventId: string;
  readonly occurredOn: Date;
  constructor(readonly payload: { value: string }) {
    this.eventId = 'evt-' + Math.random().toString(36).slice(2);
    this.occurredOn = new Date();
  }
}

class AnotherEvent implements DomainEvent<{ count: number }> {
  readonly eventName = 'another.event';
  readonly eventId: string;
  readonly occurredOn: Date;
  constructor(readonly payload: { count: number }) {
    this.eventId = 'evt-' + Math.random().toString(36).slice(2);
    this.occurredOn = new Date();
  }
}

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  // ─────────────────────────────────────────────
  // PUBLISH / SUBSCRIBE
  // ─────────────────────────────────────────────
  it('should deliver event to registered handler', async () => {
    const handler: EventHandler = { handle: jest.fn() };
    bus.subscribe('test.event', handler);

    const event = new TestEvent({ value: 'hello' });
    await bus.publish(event);

    expect(handler.handle).toHaveBeenCalledWith(event, undefined);
  });

  it('should deliver event to multiple handlers in registration order', async () => {
    const order: number[] = [];
    const handler1: EventHandler = {
      handle: jest.fn().mockImplementation(() => {
        order.push(1);
      }),
    };
    const handler2: EventHandler = {
      handle: jest.fn().mockImplementation(() => {
        order.push(2);
      }),
    };
    bus.subscribe('test.event', handler1);
    bus.subscribe('test.event', handler2);

    await bus.publish(new TestEvent({ value: 'ordered' }));

    expect(order).toEqual([1, 2]);
  });

  it('should not deliver event to handlers subscribed to different events', async () => {
    const handler: EventHandler = { handle: jest.fn() };
    bus.subscribe('test.event', handler);

    await bus.publish(new AnotherEvent({ count: 42 }));

    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('should do nothing when no handlers are registered for an event', async () => {
    await expect(
      bus.publish(new TestEvent({ value: 'orphan' })),
    ).resolves.toBeUndefined();
  });

  // ─────────────────────────────────────────────
  // CONTEXT PROPAGATION
  // ─────────────────────────────────────────────
  it('should pass context to handler when provided', async () => {
    const handler: EventHandler = { handle: jest.fn() };
    bus.subscribe('test.event', handler);

    const context = { transactionClient: { $name: 'mock-tx' } };
    await bus.publish(new TestEvent({ value: 'tx-test' }), { context });

    expect(handler.handle).toHaveBeenCalledWith(expect.any(TestEvent), context);
  });

  it('should pass undefined context when not provided', async () => {
    const handler: EventHandler = { handle: jest.fn() };
    bus.subscribe('test.event', handler);

    await bus.publish(new TestEvent({ value: 'no-context' }));

    expect(handler.handle).toHaveBeenCalledWith(
      expect.any(TestEvent),
      undefined,
    );
  });

  // ─────────────────────────────────────────────
  // ERROR HANDLING
  // ─────────────────────────────────────────────
  it('should propagate errors from handlers', async () => {
    const failingHandler: EventHandler = {
      handle: jest.fn().mockRejectedValue(new Error('Handler failed')),
    };
    bus.subscribe('test.event', failingHandler);

    await expect(bus.publish(new TestEvent({ value: 'fail' }))).rejects.toThrow(
      'Handler failed',
    );
  });

  // ─────────────────────────────────────────────
  // IDEMPOTENT SUBSCRIPTION
  // ─────────────────────────────────────────────
  it('should allow subscribing the same handler multiple times', async () => {
    const handler: EventHandler = { handle: jest.fn() };
    bus.subscribe('test.event', handler);
    bus.subscribe('test.event', handler); // Duplicate subscription

    await bus.publish(new TestEvent({ value: 'duplicate' }));

    // Should be called twice (both subscriptions fire)
    expect(handler.handle).toHaveBeenCalledTimes(2);
  });

  // ─────────────────────────────────────────────
  // MULTIPLE EVENTS
  // ─────────────────────────────────────────────
  it('should handle multiple event types', async () => {
    const testHandler: EventHandler = { handle: jest.fn() };
    const anotherHandler: EventHandler = { handle: jest.fn() };
    bus.subscribe('test.event', testHandler);
    bus.subscribe('another.event', anotherHandler);

    await bus.publish(new TestEvent({ value: 'multi1' }));
    await bus.publish(new AnotherEvent({ count: 1 }));

    expect(testHandler.handle).toHaveBeenCalledTimes(1);
    expect(anotherHandler.handle).toHaveBeenCalledTimes(1);
  });
});
