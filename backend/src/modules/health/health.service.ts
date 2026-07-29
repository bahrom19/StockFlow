import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma';
import { MetricsService } from '../../common/observability/metrics.service';
import { RedisService } from '../../infrastructure/cache/redis.service';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latency: number;
  message?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
    private readonly configService: ConfigService,
  ) {
    this.startTime = Date.now();
  }

  /** Liveness probe — is the process alive? */
  async liveness(): Promise<HealthStatus> {
    return {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: [
        {
          name: 'process',
          status: 'ok',
          latency: 0,
        },
      ],
    };
  }

  /** Readiness probe — can the application serve requests? */
  async readiness(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];

    // Check PostgreSQL connectivity
    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);

    // Check Redis connectivity
    const redisCheck = await this.checkRedis();
    checks.push(redisCheck);

    const allOk = checks.every((c) => c.status === 'ok');
    const anyDown = checks.some((c) => c.status === 'down');

    return {
      status: anyDown ? 'down' : allOk ? 'ok' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }

  /** Full system health with all dependencies */
  async fullHealth(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];

    checks.push(await this.checkDatabase());
    checks.push(await this.checkRedis());
    checks.push(this.checkMemory());

    const allOk = checks.every((c) => c.status === 'ok');
    const anyDown = checks.some((c) => c.status === 'down');

    return {
      status: anyDown ? 'down' : allOk ? 'ok' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'postgresql',
        status: 'ok',
        latency: Date.now() - start,
      };
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : undefined,
      );
      return {
        name: 'postgresql',
        status: 'down',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();

    if (!this.redis.enabled || !this.redis.getClient()) {
      return {
        name: 'redis',
        status: 'degraded',
        latency: Date.now() - start,
        message: 'Redis disabled — no REDIS_URL configured',
      };
    }

    try {
      const healthy = await this.redis.ping();
      if (healthy) {
        return {
          name: 'redis',
          status: 'ok',
          latency: Date.now() - start,
        };
      }
      return {
        name: 'redis',
        status: 'degraded',
        latency: Date.now() - start,
        message: 'Redis ping failed — running without cache',
      };
    } catch (error) {
      this.logger.error(
        'Redis health check failed',
        error instanceof Error ? error.stack : undefined,
      );
      return {
        name: 'redis',
        status: 'degraded',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private checkMemory(): HealthCheck {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const usageRatio = mem.heapUsed / mem.heapTotal;

    return {
      name: 'memory',
      status: usageRatio > 0.9 ? 'degraded' : 'ok',
      latency: 0,
      message: `${heapUsedMB}MB / ${heapTotalMB}MB (${(usageRatio * 100).toFixed(1)}%)`,
    };
  }
}
