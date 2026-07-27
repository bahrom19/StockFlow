import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInterceptor } from '../../common/observability/cache.interceptor';

@Global()
@Module({
  providers: [CacheService, CacheInterceptor],
  exports: [CacheService, CacheInterceptor],
})
export class CacheModule {}
