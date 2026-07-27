import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import promClient from 'prom-client';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Central Prometheus metrics service.
 * Tracks HTTP requests, database queries, active users, and system resources.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: Registry;
  private readonly stopDefaultMetrics: ReturnType<typeof collectDefaultMetrics>;

  /** HTTP request counter by method, path, and status */
  readonly httpRequestTotal: Counter<string>;

  /** HTTP request duration histogram (buckets: ms) */
  readonly httpRequestDuration: Histogram<string>;

  /** HTTP request in-flight gauge */
  readonly httpRequestsInFlight: Gauge<string>;

  /** Prisma query counter */
  readonly prismaQueryTotal: Counter<string>;

  /** Prisma query duration histogram */
  readonly prismaQueryDuration: Histogram<string>;

  /** Prisma slow query counter (threshold configurable) */
  readonly prismaSlowQueryTotal: Counter<string>;

  /** Active WebSocket connections */
  readonly activeConnections: Gauge<string>;

  /** Database connection pool status */
  readonly dbPoolSize: Gauge<string>;

  /** Memory usage (bytes) */
  readonly memoryUsage: Gauge<string>;

  /** Business event counter */
  readonly eventTotal: Counter<string>;

  /** Business event duration */
  readonly eventDuration: Histogram<string>;

  /** Error counter by exception type */
  readonly errorTotal: Counter<string>;

  private readonly memoryInterval: ReturnType<typeof setInterval>;

  constructor(configService: ConfigService) {
    const appName = configService.get<string>('app.name', 'stockflow-backend');

    this.registry = new Registry();
    this.registry.setDefaultLabels({
      app: appName,
      environment: configService.get<string>('app.nodeEnv', 'development'),
    });

    // Collect default Node.js metrics (event loop lag, GC, etc.)
    this.stopDefaultMetrics = collectDefaultMetrics({
      register: this.registry,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 5],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      registers: [this.registry],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently in flight',
      labelNames: ['method'],
      registers: [this.registry],
    });

    this.prismaQueryTotal = new Counter({
      name: 'prisma_queries_total',
      help: 'Total number of Prisma queries',
      labelNames: ['model', 'action'],
      registers: [this.registry],
    });

    this.prismaQueryDuration = new Histogram({
      name: 'prisma_query_duration_ms',
      help: 'Prisma query duration in milliseconds',
      labelNames: ['model', 'action'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    this.prismaSlowQueryTotal = new Counter({
      name: 'prisma_slow_queries_total',
      help: 'Total number of slow Prisma queries (over threshold)',
      labelNames: ['model', 'action', 'duration_ms'],
      registers: [this.registry],
    });

    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.dbPoolSize = new Gauge({
      name: 'db_pool_size',
      help: 'Database connection pool size',
      labelNames: ['state'],
      registers: [this.registry],
    });

    this.memoryUsage = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Process memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.eventTotal = new Counter({
      name: 'events_total',
      help: 'Total number of business events published',
      labelNames: ['event_name', 'status'],
      registers: [this.registry],
    });

    this.eventDuration = new Histogram({
      name: 'event_duration_ms',
      help: 'Event handler duration in milliseconds',
      labelNames: ['event_name', 'handler'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    this.errorTotal = new Counter({
      name: 'errors_total',
      help: 'Total number of application errors',
      labelNames: ['type', 'module'],
      registers: [this.registry],
    });

    // Start periodic memory collection
    this.memoryInterval = setInterval(() => this.collectMemoryMetrics(), 15000);
  }

  /** Return all metrics in Prometheus exposition format */
  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Return content type for prometheus scraping */
  contentType(): string {
    return this.registry.contentType;
  }

  /** Record memory usage metrics */
  private collectMemoryMetrics(): void {
    const mem = process.memoryUsage();
    this.memoryUsage.set({ type: 'rss' }, mem.rss);
    this.memoryUsage.set({ type: 'heapTotal' }, mem.heapTotal);
    this.memoryUsage.set({ type: 'heapUsed' }, mem.heapUsed);
    this.memoryUsage.set({ type: 'external' }, mem.external);
  }

  /** Track a Prisma query execution */
  recordQuery(model: string, action: string, durationMs: number): void {
    this.prismaQueryTotal.inc({ model, action });
    this.prismaQueryDuration.observe({ model, action }, durationMs);

    // Detect slow queries (>500ms)
    if (durationMs > 500) {
      this.prismaSlowQueryTotal.inc({
        model,
        action,
        duration_ms: String(Math.round(durationMs)),
      });
      this.logger.warn(
        `Slow query: ${model}.${action} took ${durationMs.toFixed(2)}ms`,
      );
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.memoryInterval);
    this.registry.clear();
  }
}
