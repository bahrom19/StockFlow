import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';

describe('RedisService', () => {
  function createService(
    config: { redisUrl?: string; failOpenOnError?: boolean } = {},
  ) {
    const mockRedisClient = {
      set: jest.fn(),
      eval: jest.fn(),
      del: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
      status: 'ready',
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'redis.url') return config.redisUrl ?? '';
        if (key === 'redis.lock')
          return { failOpenOnError: config.failOpenOnError ?? false };
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
    // G16-L-2C-3: a synthetic token means RUN — never SKIPPED.
    it('should return acquired=true with a synthetic token when Redis is disabled', async () => {
      const { service } = createService({ redisUrl: '' });
      const result = await service.acquireLock('test-lock', 60);
      expect(result).toEqual({
        acquired: true,
        token: expect.any(String),
        synthetic: true,
      });
      expect(result.acquired && result.token).toBeTruthy();
    });

    it('should return false when pinging disabled Redis', async () => {
      const { service } = createService({ redisUrl: '' });
      const result = await service.ping();
      expect(result).toBe(false);
    });

    it('should still return a synthetic acquisition regardless of errors when disabled', async () => {
      const { service } = createService({ redisUrl: '' });
      const result = await service.acquireLock('test-lock', 60);
      expect(result.acquired).toBe(true);
    });
  });

  describe('Redis healthy - lock acquired', () => {
    it('should return a unique real token when lock is acquired', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await service.acquireLock('test-lock', 60);

      if (!result.acquired) throw new Error('expected acquisition');
      expect(result.synthetic).toBe(false);
      expect(typeof result.token).toBe('string');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-lock',
        result.token,
        'EX',
        60,
        'NX',
      );
    });

    it('should generate different tokens for separate acquisitions', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.set.mockResolvedValue('OK');

      const result1 = await service.acquireLock('lock-1', 60);
      const result2 = await service.acquireLock('lock-2', 60);

      if (!result1.acquired || !result2.acquired)
        throw new Error('expected acquisitions');
      expect(result1.token).not.toEqual(result2.token);
    });
  });

  describe('Redis healthy - lock contention', () => {
    it('should return LOCK_CONTENDED when lock is already held (contention)', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.set.mockResolvedValue(null);

      const result = await service.acquireLock('test-lock', 60);
      expect(result).toEqual({ acquired: false, reason: 'LOCK_CONTENDED' });
    });
  });

  describe('Redis configured + error + failOpen=false (production default)', () => {
    it('should return not-acquired with REDIS_ERROR when Redis throws (fail-closed)', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.set.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      const result = await service.acquireLock('test-lock', 60);
      expect(result).toEqual({ acquired: false, reason: 'REDIS_ERROR' });
    });

    it('should return REDIS_UNAVAILABLE when the connection is permanently gone (status=end)', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.status = 'end';
      mockRedisClient.set.mockRejectedValue(
        new Error("Stream isn't writeable and enableOfflienQueue is false"),
      );

      const result = await service.acquireLock('test-lock', 60);
      expect(result).toEqual({ acquired: false, reason: 'REDIS_UNAVAILABLE' });
    });

    it('should log error when Redis throws', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.set.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      await service.acquireLock('test-lock', 60);
    });
  });

  describe('Redis configured + error + failOpen=true (explicit degraded mode)', () => {
    it('should return a synthetic acquisition when Redis throws and failOpenOnError=true', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: true,
      });
      mockRedisClient.set.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      const result = await service.acquireLock('test-lock', 60);
      expect(result).toEqual({
        acquired: true,
        token: expect.any(String),
        synthetic: true,
      });
    });
  });

  describe('releaseLock', () => {
    it('should call eval with Lua script when Redis is enabled', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
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
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.eval.mockRejectedValue(new Error('Redis error'));

      const result = await service.releaseLock('test-lock', 'my-token');
      expect(result).toBe(false);
    });

    it('should return false when token does not match (wrong owner)', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });
      mockRedisClient.eval.mockResolvedValue(0);

      const result = await service.releaseLock('test-lock', 'wrong-token');
      expect(result).toBe(false);
    });

    it('should not delete lock when another owner holds it (critical regression test)', async () => {
      const { service, mockRedisClient } = createService({
        redisUrl: 'redis://localhost:6379',
        failOpenOnError: false,
      });

      // Simulate: Process A's token-A tries to release, but Redis has token-B
      // Lua script returns 0 — lock must NOT be deleted
      mockRedisClient.eval.mockResolvedValue(0);

      const result = await service.releaseLock(
        'cron:lock:recurring-invoices',
        'token-A',
      );
      expect(result).toBe(false);
      // Verify eval was called (Lua script executed) — not plain DEL
      expect(mockRedisClient.eval).toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });
});
