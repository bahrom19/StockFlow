import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

/**
 * Why a lock acquisition did not happen (G16-L-2C).
 *
 * This is a CLOSED vocabulary written verbatim to JobRun.skipReason. It never
 * contains a raw Redis error message, connection string, or any other internal
 * detail — those are logged by RedisService and never leave it.
 *
 * There is deliberately NO 'LOCK_DISABLED' member: when Redis is disabled in
 * development, acquireLock() returns a synthetic token and the job RUNS. A
 * synthetic token means "execution proceeded", never "execution was skipped".
 */
export type LockSkipReason =
  | 'LOCK_CONTENDED'
  | 'REDIS_UNAVAILABLE'
  | 'REDIS_ERROR';

/** Discriminated result of a distributed lock acquisition. */
export type LockAcquisitionResult =
  | { acquired: true; token: string; synthetic: boolean }
  | { acquired: false; reason: LockSkipReason };

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null = null;
  readonly enabled: boolean;
  private readonly failOpenOnError: boolean;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('redis.url', '');
    const lockConfig = this.configService.get<{ failOpenOnError?: boolean }>(
      'redis.lock',
    );
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
   *
   * Returns a discriminated result so callers can distinguish WHY an execution
   * did not run — required to record an honest JobRun SKIPPED row.
   *
   * Behaviour is unchanged from the previous string|null contract:
   *   - Redis configured and free        -> acquired, real token
   *   - Redis configured and held        -> not acquired, LOCK_CONTENDED
   *   - Redis client absent (dev/no URL) -> acquired, SYNTHETIC token (runs unlocked)
   *   - Redis configured but errors      -> fail-closed REDIS_ERROR, unless
   *                                         REDIS_LOCK_FAIL_OPEN_ON_ERROR=true
   *                                         (then acquired, synthetic token)
   *
   * `synthetic: true` always means the job proceeds WITHOUT real mutual
   * exclusion and must never be reported as SKIPPED.
   */
  async acquireLock(
    lockKey: string,
    ttlSeconds: number,
  ): Promise<LockAcquisitionResult> {
    if (!this.client) {
      this.logger.debug(
        'Redis disabled — acquiring lock without Redis (fail-open for dev mode)',
      );
      // Not a skip: execution proceeds, so this is an acquisition.
      return { acquired: true, token: randomUUID(), synthetic: true };
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
        return { acquired: true, token, synthetic: false };
      }

      // Lock contention — Redis is healthy but lock is held by another process
      this.logger.debug(`Lock contention for ${lockKey}`);
      return { acquired: false, reason: 'LOCK_CONTENDED' };
    } catch (error) {
      // Redis failure — connection error, timeout, etc. The raw error is logged
      // here and deliberately NOT propagated into JobRun.skipReason.
      this.logger.error(
        `Redis acquireLock failed for ${lockKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      if (this.failOpenOnError) {
        return { acquired: true, token: randomUUID(), synthetic: true };
      }
      // Fail-closed either way. 'end' means ioredis exhausted its retry budget
      // and the connection is permanently gone (REDIS_UNAVAILABLE); any other
      // failure is treated as a transient Redis error (REDIS_ERROR). Both prevent
      // execution; they differ only in how an operator reads the alert.
      const permanentlyDown = this.client.status === 'end';
      return {
        acquired: false,
        reason: permanentlyDown ? 'REDIS_UNAVAILABLE' : 'REDIS_ERROR',
      };
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
