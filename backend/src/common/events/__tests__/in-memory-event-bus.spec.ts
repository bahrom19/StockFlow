import { InMemoryEventBus } from '../in-memory-event-bus';
import { DEFAULT_EVENT_HANDLER_PRIORITY } from '../event-bus.interface';
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
  // PRIORITY ORDERING (G16-E)
  // ─────────────────────────────────────────────
  it('should default to priority 100', () => {
    expect(DEFAULT_EVENT_HANDLER_PRIORITY).toBe(100);
  });

  it('should execute handlers in ascending priority regardless of registration order', async () => {
    const order: string[] = [];
    const finance: EventHandler = {
      handle: jest.fn().mockImplementation(async () => {
        order.push('finance');
      }),
    };
    const notifications: EventHandler = {
      handle: jest.fn().mockImplementation(async () => {
        order.push('notifications');
      }),
    };
    const inventory: EventHandler = {
      handle: jest.fn().mockImplementation(async () => {
        order.push('inventory');
      }),
    };
    // Worst-case topology registration order: finance first, inventory last.
    bus.subscribe('test.event', finance, { priority: 20 });
    bus.subscribe('test.event', notifications, { priority: 30 });
    bus.subscribe('test.event', inventory, { priority: 10 });

    await bus.publish(new TestEvent({ value: 'priorities' }));

    expect(order).toEqual(['inventory', 'finance', 'notifications']);
  });

  it('should keep registration order for handlers with equal priority (stable)', async () => {
    const order: number[] = [];
    const make = (n: number): EventHandler => ({
      handle: jest.fn().mockImplementation(async () => {
        order.push(n);
      }),
    });
    bus.subscribe('test.event', make(1), { priority: 50 });
    bus.subscribe('test.event', make(2), { priority: 50 });
    bus.subscribe('test.event', make(3), { priority: 50 });

    await bus.publish(new TestEvent({ value: 'stable' }));

    expect(order).toEqual([1, 2, 3]);
  });

  it('should treat the default priority as the historical registration-order bucket', async () => {
    const order: string[] = [];
    const make = (name: string): EventHandler => ({
      handle: jest.fn().mockImplementation(async () => {
        order.push(name);
      }),
    });
    // Mix: no options, explicit 100, no options — all share bucket 100.
    bus.subscribe('test.event', make('first'));
    bus.subscribe('test.event', make('second'), { priority: 100 });
    bus.subscribe('test.event', make('third'));

    await bus.publish(new TestEvent({ value: 'default-bucket' }));

    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('should order mixed explicit and default priorities ascending (10 → 20 → 30 → 100)', async () => {
    const order: string[] = [];
    const make = (name: string): EventHandler => ({
      handle: jest.fn().mockImplementation(async () => {
        order.push(name);
      }),
    });
    bus.subscribe('test.event', make('default'), { priority: 100 });
    bus.subscribe('test.event', make('inventory'), { priority: 10 });
    bus.subscribe('test.event', make('notifications'), { priority: 30 });
    bus.subscribe('test.event', make('finance'), { priority: 20 });

    await bus.publish(new TestEvent({ value: 'mixed' }));

    expect(order).toEqual(['inventory', 'finance', 'notifications', 'default']);
  });

  it('should fire duplicate subscriptions once per subscription when priorities are set', async () => {
    const handler: EventHandler = { handle: jest.fn() };
    bus.subscribe('test.event', handler, { priority: 10 });
    bus.subscribe('test.event', handler, { priority: 10 });

    await bus.publish(new TestEvent({ value: 'duplicate-priority' }));

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
