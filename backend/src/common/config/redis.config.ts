import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string;
  lock?: {
    failOpenOnError?: boolean;
  };
}

export const redisConfig = registerAs(
  'redis',
  (): RedisConfig => ({
    url: process.env.REDIS_URL ?? '',
    lock: {
      failOpenOnError: process.env.REDIS_LOCK_FAIL_OPEN_ON_ERROR === 'true',
    },
  }),
);
