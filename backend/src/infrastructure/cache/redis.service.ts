import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null = null;
  readonly enabled: boolean;
  private readonly failOpenOnError: boolean;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('redis.url', '');
    const lockConfig = this.configService.get<{ failOpenOnError?: boolean }>('redis.lock');
    this.failOpenOnError = lockConfig?.failOpenOnError ?? false;

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
        connectTimeout: 10000,
        enableReadyCheck: false,
      });

      // Error handler — prevents ANY unhandled error events
      this.client.on('error', (err: Error) => {
        this.logger.error(`Redis error: ${err.message}`);
      });

      // Connection lifecycle
      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
      });

      this.client.on('ready', () => {
        this.logger.verbose('Redis ready');
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

  /**
   * Acquire a distributed lock using Redis SET NX EX.
   * Returns true if the lock was acquired, false otherwise.
   * When Redis is disabled, returns true (runs without lock).
   * When Redis is configured but fails, returns false (fail-closed) unless
   * REDIS_LOCK_FAIL_OPEN_ON_ERROR=true is set.
   */
  async acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) {
      this.logger.debug(
        'Redis disabled — acquiring lock without Redis (fail-open for dev mode)',
      );
      return true;
    }

    try {
      const result = await this.client.set(
        lockKey,
        '1',
        'EX',
        ttlSeconds,
        'NX',
      );

      if (result === 'OK') {
        return true;
      }

      // Lock contention — Redis is healthy but lock is held by another process
      this.logger.debug(`Lock contention for ${lockKey}`);
      return false;
    } catch (error) {
      // Redis failure — connection error, timeout, etc.
      this.logger.error(
        `Redis acquireLock failed for ${lockKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.failOpenOnError;
    }
  }

  /**
   * Release a distributed lock by deleting the key.
   * Safe to call when Redis is disabled — no-op.
   */
  async releaseLock(lockKey: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.del(lockKey);
    } catch (error) {
      this.logger.warn(
        `Redis releaseLock error for ${lockKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
