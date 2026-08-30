import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';

/**
 * DB-backed idempotency infrastructure (Phase F1).
 *
 * `@Global` like the other infrastructure modules (PrismaModule, CacheModule)
 * so any feature module can inject `IdempotencyService` without importing
 * this module explicitly. No business operation is wired to it yet — it is
 * pure infrastructure.
 */
@Global()
@Module({
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
