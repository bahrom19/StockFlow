import { InMemoryEventBus } from '../in-memory-event-bus';
import {
  DEFAULT_EVENT_HANDLER_PRIORITY,
  EventBus,
} from '../event-bus.interface';
import { DomainEvent } from '../domain-event.interface';
import { EventHandler } from '../event-handler.interface';
import { InventoryModule } from '../../../modules/inventory/inventory.module';
import { FinanceModule } from '../../../modules/finance/finance.module';
import { NotificationsModule } from '../../../modules/notifications/notifications.module';

/**
 * G16-E — D9 wiring tests.
 *
 * 1. Module `onModuleInit` registers `sale.completed` with the approved
 *    priorities: Inventory 10 → Finance 20 → Notifications 30; every other
 *    subscription keeps the default priority (registration order).
 * 2. Replaying those subscriptions into a real InMemoryEventBus in the
 *    worst-case (historically wrong) registration order still executes
 *    Inventory → Finance → Notifications, proving execution order is
 *    priority-driven, not registration/module-topology-driven.
 */
describe('sale.completed handler priority wiring (G16-E, D9)', () => {
  const saleCompletedHandlers = () => ({
    inventory: { handle: jest.fn() },
    finance: { handle: jest.fn() },
    notifications: { handle: jest.fn() },
    // decoys for non-priority subscriptions
    other: { handle: jest.fn() },
  });

  describe('module subscription options', () => {
    it('InventoryModule subscribes sale.completed with priority 10 (others default)', () => {
      const subscribe = jest.fn();
      const bus = { subscribe, publish: jest.fn() } as unknown as EventBus;
      const h = saleCompletedHandlers();

      new InventoryModule(
        bus,
        h.inventory as never,
        h.other as never,
        h.other as never,
        h.other as never,
        h.other as never,
      ).onModuleInit();

      const saleCompleted = subscribe.mock.calls.filter(
        (c) => c[0] === 'sale.completed',
      );
      expect(saleCompleted).toHaveLength(1);
      expect(saleCompleted[0][1]).toBe(h.inventory);
      expect(saleCompleted[0][2]).toEqual({ priority: 10 });

      const others = subscribe.mock.calls.filter(
        (c) => c[0] !== 'sale.completed',
      );
      expect(others.length).toBeGreaterThan(0);
      for (const call of others) {
        expect(call[2]).toBeUndefined();
      }
    });

    it('FinanceModule subscribes sale.completed with priority 20 (others default)', () => {
      const subscribe = jest.fn();
      const bus = { subscribe, publish: jest.fn() } as unknown as EventBus;
      const h = saleCompletedHandlers();

      new FinanceModule(
        bus,
        h.finance as never,
        h.other as never,
        h.other as never,
      ).onModuleInit();

      const saleCompleted = subscribe.mock.calls.filter(
        (c) => c[0] === 'sale.completed',
      );
      expect(saleCompleted).toHaveLength(1);
      expect(saleCompleted[0][1]).toBe(h.finance);
      expect(saleCompleted[0][2]).toEqual({ priority: 20 });

      const others = subscribe.mock.calls.filter(
        (c) => c[0] !== 'sale.completed',
      );
      expect(others.length).toBeGreaterThan(0);
      for (const call of others) {
        expect(call[2]).toBeUndefined();
      }
    });

    it('NotificationsModule subscribes sale.completed with priority 30 (others default)', () => {
      const subscribe = jest.fn();
      const bus = { subscribe, publish: jest.fn() } as unknown as EventBus;
      const h = saleCompletedHandlers();

      new NotificationsModule(
        bus,
        h.notifications as never,
        h.other as never,
      ).onModuleInit();

      const saleCompleted = subscribe.mock.calls.filter(
        (c) => c[0] === 'sale.completed',
      );
      expect(saleCompleted).toHaveLength(1);
      expect(saleCompleted[0][1]).toBe(h.notifications);
      expect(saleCompleted[0][2]).toEqual({ priority: 30 });

      const others = subscribe.mock.calls.filter(
        (c) => c[0] !== 'sale.completed',
      );
      expect(others.length).toBeGreaterThan(0);
      for (const call of others) {
        expect(call[2]).toBeUndefined();
      }
    });
  });

  describe('execution order through a real bus', () => {
    class SaleCompletedProbe implements DomainEvent<Record<string, never>> {
      readonly eventName = 'sale.completed';
      readonly eventId = 'probe-evt';
      readonly occurredOn = new Date();
      readonly payload: Record<string, never> = {};
    }

    it('runs Inventory → Finance → Notifications even with worst-case registration order', async () => {
      const bus = new InMemoryEventBus();
      const order: string[] = [];
      const make = (name: string): EventHandler => ({
        handle: jest.fn().mockImplementation(async () => {
          order.push(name);
        }),
      });
      const finance = make('finance');
      const notifications = make('notifications');
      const inventory = make('inventory');

      // Historically wrong registration order (Finance subscribed first).
      bus.subscribe('sale.completed', finance, { priority: 20 });
      bus.subscribe('sale.completed', notifications, { priority: 30 });
      bus.subscribe('sale.completed', inventory, { priority: 10 });

      await bus.publish(new SaleCompletedProbe());

      expect(order).toEqual(['inventory', 'finance', 'notifications']);
      expect(DEFAULT_EVENT_HANDLER_PRIORITY).toBe(100);
    });

    it('runs default-priority handlers in registration order after prioritized ones', async () => {
      const bus = new InMemoryEventBus();
      const order: string[] = [];
      const make = (name: string): EventHandler => ({
        handle: jest.fn().mockImplementation(async () => {
          order.push(name);
        }),
      });

      bus.subscribe('sale.completed', make('default-a'));
      bus.subscribe('sale.completed', make('inventory'), { priority: 10 });
      bus.subscribe('sale.completed', make('default-b'));
      bus.subscribe('sale.completed', make('finance'), { priority: 20 });

      await bus.publish(new SaleCompletedProbe());

      expect(order).toEqual(['inventory', 'finance', 'default-a', 'default-b']);
    });
  });
});
