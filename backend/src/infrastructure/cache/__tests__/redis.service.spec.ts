import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';

describe('RedisService', () => {
  function createService(config: { redisUrl?: string; failOpenOnError?: boolean } = {}) {
    const mockRedisClient = {
      set: jest.fn(),
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
      (service as any).client = {
        set: jest.fn(),
        del: jest.fn(),
        ping: jest.fn(),
        quit: jest.fn(),
        on: jest.fn(),
      };
    } else {
      (service as any).client = null;
      (service as any).enabled = false;
    }
    return { service };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Redis disabled (no REDIS_URL)', () => {
    it('should return true when Redis is disabled (no REDIS_URL)', async () => {
      const { service } = createService({ redisUrl: '' });
      const result = await service.acquireLock('test-lock', 60);
      expect(result).toBe(true);
    });

    it('should return false when pinging disabled Redis', async () => {
      const { service } = createService({ redisUrl: '' });
      const result = await service.ping();
      expect(result).toBe(false);
    });

    it('should return true for acquireLock even with error when disabled', async () => {
      const { service } = createService({ redisUrl: '' });
      const result = await service.acquireLock('test-lock', 60);
      expect(result).toBe(true);
    });
  });

  describe('Redis healthy - lock acquired', () => {
    it('should return true when lock is acquired', async () => {
      const { service } = createService({ 
        redisUrl: 'redis://localhost:6379', 
        failOpenOnError: false 
      });
      (service as any).client = { set: jest.fn().mockResolvedValue('OK'), del: jest.fn(), ping: jest.fn(), quit: jest.fn(), on: jest.fn() };
      const result = await service.acquireLock('test-lock', 60);
      expect(result).toBe(true);
    });
  });

  describe('Redis healthy - lock contention', () => {
    it('should return false when lock is already held (contention)', async () => {
      const { service } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      (service as any).client = { set: jest.fn().mockResolvedValue(null), del: jest.fn(), ping: jest.fn(), quit: jest.fn(), on: jest.fn() };
      const result = await service.acquireLock('test-lock', 60);
      expect(result).toBe(false);
    });
  });

  describe('Redis configured + error + failOpen=false (production default)', () => {
    it('should return false when Redis throws error and failOpenOnError=false', async () => {
      const { service } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      (service as any).client = { set: jest.fn().mockRejectedValue(new Error('Redis connection failed')), del: jest.fn(), ping: jest.fn(), quit: jest.fn(), on: jest.fn() };
      const result = await service.acquireLock('test-lock', 60);
      expect(result).toBe(false);
    });

    it('should log error when Redis throws', async () => {
      const { service } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      (service as any).client = { set: jest.fn().mockRejectedValue(new Error('Redis connection failed')), del: jest.fn(), ping: jest.fn(), quit: jest.fn(), on: jest.fn() };
      
      await service.acquireLock('test-lock', 60);
    });
  });

  describe('Redis configured + error + failOpen=true (explicit degraded mode)', () => {
    it('should return true when Redis throws and failOpenOnError=true', async () => {
      const { service } = createService({ 
        redisUrl: 'redis://localhost:6379', 
        failOpenOnError: true 
      });
      (service as any).client = { set: jest.fn().mockRejectedValue(new Error('Redis connection failed')), del: jest.fn(), ping: jest.fn(), quit: jest.fn(), on: jest.fn() };
      const result = await service.acquireLock('test-lock', 60);
      expect(result).toBe(true);
    });
  });

  describe('releaseLock', () => {
    it('should call del when Redis is enabled', async () => {
      const mockRedisClient = { set: jest.fn(), del: jest.fn(), ping: jest.fn(), quit: jest.fn(), on: jest.fn() };
      const { service } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      (service as any).client = mockRedisClient;
      
      await service.releaseLock('test-lock');
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-lock');
    });

    it('should not call del when Redis is disabled', async () => {
      const { service } = createService({ redisUrl: '' });
      (service as any).client = null;
      (service as any).enabled = false;
      
      await service.releaseLock('test-lock');
    });

    it('should not throw when del throws', async () => {
      const { service } = createService({ redisUrl: 'redis://localhost:6379', failOpenOnError: false });
      (service as any).client = { set: jest.fn(), del: jest.fn().mockRejectedValue(new Error('Redis error')), ping: jest.fn(), quit: jest.fn(), on: jest.fn() };
      
      await expect(service.releaseLock('test-lock')).resolves.toBeUndefined();
    });
  });
});