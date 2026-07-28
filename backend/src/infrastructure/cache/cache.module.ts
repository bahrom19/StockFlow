import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';
import { CacheInterceptor } from '../../common/observability/cache.interceptor';

@Global()
@Module({
  providers: [CacheService, RedisService, CacheInterceptor],
  exports: [CacheService, RedisService, CacheInterceptor],
})
export class CacheModule {}
