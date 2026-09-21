import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { ObservabilityModule } from '../../common/observability/observability.module';
import { MaintenanceCronService } from './maintenance-cron.service';

@Global()
@Module({
  imports: [PrismaModule, CacheModule, ObservabilityModule],
  providers: [MaintenanceCronService],
  exports: [],
})
export class MaintenanceModule {}