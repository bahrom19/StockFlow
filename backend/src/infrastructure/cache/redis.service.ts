import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

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
   * Lua script for atomic ownership-safe lock release.
   * Compares the stored value with the provided token before deleting.
   * Returns 1 if deleted, 0 if token mismatch or key missing.
   */
  private static readonly RELEASE_LUA = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;

  /**
   * Acquire a distributed lock using Redis SET NX EX.
   * Returns a unique ownership token if acquired, null otherwise.
   * The token is stored as the Redis value for safe compare-and-delete release.
   * When Redis is disabled, returns a synthetic token (runs without lock).
   * When Redis is configured but fails, returns null (fail-closed) unless
   * REDIS_LOCK_FAIL_OPEN_ON_ERROR=true is set.
   */
  async acquireLock(lockKey: string, ttlSeconds: number): Promise<string | null> {
    if (!this.client) {
      this.logger.debug(
        'Redis disabled — acquiring lock without Redis (fail-open for dev mode)',
      );
      return randomUUID();
    }

    try {
      const token = randomUUID();
      const result = await this.client.set(
        lockKey,
        token,
        'EX',
        ttlSeconds,
        'NX',
      );

      if (result === 'OK') {
        return token;
      }

      // Lock contention — Redis is healthy but lock is held by another process
      this.logger.debug(`Lock contention for ${lockKey}`);
      return null;
    } catch (error) {
      // Redis failure — connection error, timeout, etc.
      this.logger.error(
        `Redis acquireLock failed for ${lockKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.failOpenOnError ? randomUUID() : null;
    }
  }

  /**
   * Release a distributed lock using atomic compare-and-delete (Lua script).
   * Only deletes the key if the stored value matches the owner token.
   * Safe to call when Redis is disabled — no-op.
   * Returns true if the lock was released, false otherwise.
   */
  async releaseLock(lockKey: string, ownerToken: string): Promise<boolean> {
    if (!this.client) {
      return true;
    }

    try {
      const result = await this.client.eval(
        RedisService.RELEASE_LUA,
        1,
        lockKey,
        ownerToken,
      );
      return result === 1;
    } catch (error) {
      this.logger.warn(
        `Redis releaseLock error for ${lockKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}
