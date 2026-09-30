import { Global, Module } from '@nestjs/common';
import { MetricsBootstrapService } from './metrics-bootstrap.service';
import { MetricsService } from './metrics.service';
import { JobRunService } from './job-run.service';

@Global()
@Module({
  providers: [MetricsService, MetricsBootstrapService, JobRunService],
  exports: [MetricsService, JobRunService],
})
export class ObservabilityModule {}
