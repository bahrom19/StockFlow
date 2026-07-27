import { Global, Module } from '@nestjs/common';
import { MetricsBootstrapService } from './metrics-bootstrap.service';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [MetricsService, MetricsBootstrapService],
  exports: [MetricsService],
})
export class ObservabilityModule {}
