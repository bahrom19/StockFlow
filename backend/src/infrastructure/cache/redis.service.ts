import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null = null;
  readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('redis.url', '');

    if (!url) {
      this.logger.warn('Redis disabled — no REDIS_URL configured');
      this.enabled = false;
      return;
    }

    this.enabled = true;

    try {
      this.client = new Redis(url, {
        retryStrategy: (times: number) => {
          if (times > 10) {
            this.logger.error(
              'Redis connection failed after 10 retries — giving up',
            );
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on('error', (err: Error) => {
        this.logger.error(`Redis connection error: ${err.message}`);
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
      });
    } catch (error) {
      this.logger.error(
        `Failed to create Redis client: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.enabled = false;
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  /** Return the Redis client, or null if Redis is disabled/failed */
  getClient(): Redis | null {
    return this.client;
  }

  /** Ping Redis. Returns false when Redis is disabled or unreachable. */
  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
