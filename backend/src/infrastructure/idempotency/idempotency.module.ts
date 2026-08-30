import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma';
import { IdempotencyService } from './idempotency.service';

/**
 * DB-backed idempotency infrastructure (Phase F1).
 *
 * `@Global` like the other infrastructure modules (PrismaModule, CacheModule)
 * so any feature module can inject `IdempotencyService` without importing
 * this module explicitly. No business operation is wired to it yet — it is
 * pure infrastructure.
 *
 * `PrismaModule` is imported here (rather than relying on the host app's root
 * import) so `IdempotencyService` can always resolve `PrismaService` —
 * including inside isolated `Test.createTestingModule` contexts that import a
 * feature module without re-importing `PrismaModule`.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
