import { Global, Module } from '@nestjs/common';
import { EVENT_BUS } from './event-bus.token';
import { InMemoryEventBus } from './in-memory-event-bus';

/**
 * Global module that provides the application-wide EventBus.
 *
 * To swap the implementation:
 * 1. Create a new class that implements EventBus (e.g. OutboxEventBus)
 * 2. Change {@code useClass} below
 * 3. No business code changes needed
 */
@Global()
@Module({
  providers: [
    {
      provide: EVENT_BUS,
      useClass: InMemoryEventBus,
    },
  ],
  exports: [EVENT_BUS],
})
export class EventBusModule {}
