import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

type CacheValue = string | number | boolean | Record<string, unknown> | null;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private readonly defaultTTL: number;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis(
      this.configService.get<string>('redis.url', 'redis://localhost:6379'),
      {
        retryStrategy: (times: number) => {
          if (times > 10) {
            this.logger.error('Redis connection failed after 10 retries');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      },
    );
    this.defaultTTL = this.configService.get<number>('redis.defaultTTL', 300); // 5 min

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  /** Get a value from cache */
  async get<T extends CacheValue>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(
        `Cache get error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /** Set a value in cache with TTL (seconds) */
  async set(
    key: string,
    value: CacheValue,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds ?? this.defaultTTL;
      await this.client.setex(key, ttl, serialized);
    } catch (error) {
      this.logger.warn(
        `Cache set error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /** Delete a cache key */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `Cache del error for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /** Delete all keys matching a pattern (e.g., "products:*") */
  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(
        `Cache delPattern error for ${pattern}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get-or-compute with cache stampede protection.
   * Uses a probabilistic early expiration (XFetch algorithm).
   */
  async getOrCompute<T extends CacheValue>(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds?: number,
    beta = 1.0,
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      // Check if item is about to expire (probabilistic early expiration)
      const remainingTTL = await this.client.ttl(key);

      if (remainingTTL > 0) {
        const delta = (ttlSeconds ?? this.defaultTTL) - remainingTTL;
        const probability = delta / (beta * remainingTTL);

        if (Math.random() > probability) {
          return cached;
        }
      }
    }

    // Compute and cache
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /** Ping Redis */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /** Flush all cache (use with caution) */
  async flushAll(): Promise<void> {
    try {
      await this.client.flushall();
      this.logger.warn('Cache flushed entirely');
    } catch (error) {
      this.logger.error(
        `Cache flush error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /** Build a cache key with namespace prefix */
  static buildKey(namespace: string, ...parts: (string | number)[]): string {
    return [namespace, ...parts].join(':');
  }

  /** Predefined cache namespaces */
  static NAMESPACES = {
    RESPONSE: 'response',
    QUERY: 'query',
    SESSION: 'session',
    DATA_LOADER: 'dataloader',
    AGGREGATION: 'agg',
  } as const;
}
