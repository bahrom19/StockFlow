import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';

/**
 * Wires PrismaService to MetricsService after all modules are initialized.
 * This avoids circular dependency between PrismaModule and ObservabilityModule.
 */
@Injectable()
export class MetricsBootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    // Connect Prisma query metrics to Prometheus
    this.prisma.setMetricsCollector({
      recordQuery: (model, action, durationMs) => {
        this.metrics.recordQuery(model, action, durationMs);
      },
    });
  }
}
