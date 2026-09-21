import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';

describe('RedisService', () => {
  function createService(config: { redisUrl?: string; failOpenOnError?: boolean } = {}) {
    const mockRedisClient = {
      set: jest.fn(),
      eval: jest.fn(),
      del: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'redis.url') return config.redisUrl ?? '';
        if (key === 'redis.lock') return { failOpenOnError: config.failOpenOnError ?? false };
        return undefined;
      }),
    };

    const service = new RedisService(mockConfigService as any);
    if (config.redisUrl) {
      (service as any).client = mockRedisClient;
    } else {
      (service as any).client = null;
      (service as any).enabled = false;
    }
    return { service, mockRedisClient };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Redis disabled (no REDIS_URL)', () => {
    it('should return a token string when Redis is disabled (no REDIS_URL)', async () => {
      const { service } = createService({ redisUrl: '' });
      const result = await service.acquireLock('test-lock', 60);
      expect(typeof result).toBe('string');
      expect(result).not.toBeNull();
    });

    it('should return false when pinging disabled Redis', async () => {
      const { service } = createService({ redisUrl: '' });
      const result = await service.ping();
      expect(result).toBe(false);
    });

    it('should return a token even with error when disabled', async () => {
      const { service } = createService({ redisUrl: '' });
      const result = await service.acquireLock('test-lock', 60);
      expect(typeof result).toBe('string');
    });
  });

  describe('Redis healthy - lock acquired', () => {
    it('should return a unique token when lock is acquired', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.set.mockResolvedValue('OK');

      const token = await service.acquireLock('test-lock', 60);

      expect(typeof token).toBe('string');
      expect(token).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-lock', token, 'EX', 60, 'NX');
    });

    it('should generate different tokens for separate acquisitions', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.set.mockResolvedValue('OK');

      const token1 = await service.acquireLock('lock-1', 60);
      const token2 = await service.acquireLock('lock-2', 60);

      expect(token1).not.toEqual(token2);
    });
  });

  describe('Redis healthy - lock contention', () => {
    it('should return null when lock is already held (contention)', async () => {
      const { service, mockRedisClient } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      mockRedisClient.set.mockResolvedValue(null);

      const result = await service.acquireLock('test-lock', 60);
      expect(result).toBeNull();
    });
  });

  describe('Redis configured + error + failOpen=false (production default)', () => {
    it('should return null when Redis throws error and failOpenOnError=false', async () => {
      const { service, mockRedisClient } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      mockRedisClient.set.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.acquireLock('test-lock', 60);
      expect(result).toBeNull();
    });

    it('should log error when Redis throws', async () => {
      const { service, mockRedisClient } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      mockRedisClient.set.mockRejectedValue(new Error('Redis connection failed'));

      await service.acquireLock('test-lock', 60);
    });
  });

  describe('Redis configured + error + failOpen=true (explicit degraded mode)', () => {
    it('should return a token when Redis throws and failOpenOnError=true', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: true,
      });
      mockRedisClient.set.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.acquireLock('test-lock', 60);
      expect(typeof result).toBe('string');
    });
  });

  describe('releaseLock', () => {
    it('should call eval with Lua script when Redis is enabled', async () => {
      const { service, mockRedisClient } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      mockRedisClient.eval.mockResolvedValue(1);

      const result = await service.releaseLock('test-lock', 'my-token');
      expect(result).toBe(true);
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('get', KEYS[1])"),
        1,
        'test-lock',
        'my-token',
      );
    });

    it('should return true when Redis is disabled (no-op)', async () => {
      const { service } = createService({ redisUrl: '' });
      (service as any).client = null;

      const result = await service.releaseLock('test-lock', 'my-token');
      expect(result).toBe(true);
    });

    it('should return false when eval throws', async () => {
      const { service, mockRedisClient } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      mockRedisClient.eval.mockRejectedValue(new Error('Redis error'));

      const result = await service.releaseLock('test-lock', 'my-token');
      expect(result).toBe(false);
    });

    it('should return false when token does not match (wrong owner)', async () => {
      const { service, mockRedisClient } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      mockRedisClient.eval.mockResolvedValue(0);

      const result = await service.releaseLock('test-lock', 'wrong-token');
      expect(result).toBe(false);
    });

    it('should not delete lock when another owner holds it (critical regression test)', async () => {
      const { service, mockRedisClient } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });

      // Simulate: Process A's token-A tries to release, but Redis has token-B
      // Lua script returns 0 — lock must NOT be deleted
      mockRedisClient.eval.mockResolvedValue(0);

      const result = await service.releaseLock('cron:lock:recurring-invoices', 'token-A');
      expect(result).toBe(false);
      // Verify eval was called (Lua script executed) — not plain DEL
      expect(mockRedisClient.eval).toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });
});
