import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Interface matching MetricsService.recordQuery to avoid circular dependency.
 */
export interface QueryMetricsCollector {
  recordQuery(model: string, action: string, durationMs: number): void;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /** Injected after construction to break circular dependency */
  private metricsCollector: QueryMetricsCollector | null = null;

  /**
   * Set the metrics collector (called by ObservabilityModule after
   * both PrismaService and MetricsService are available).
   */
  setMetricsCollector(collector: QueryMetricsCollector): void {
    this.metricsCollector = collector;
  }

  async onModuleInit(): Promise<void> {
    // Attach query event listener for monitoring.
    // Prisma v6 $on('query') event shape: { query, params, duration, timestamp }
    this.$on('query' as never, (event: unknown) => {
      const evt = event as { duration?: number; query?: string };
      const duration = Number(evt.duration) || 0;

      // Report query metrics to MetricsService
      this.metricsCollector?.recordQuery('prisma', 'query', duration);

      // Log slow queries (>500ms)
      if (duration > 500) {
        const truncatedQuery = (evt.query ?? '').slice(0, 200);
        this.logger.warn(`Slow query [${duration}ms]: ${truncatedQuery}`);
      }
    });

    await this.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }
}
