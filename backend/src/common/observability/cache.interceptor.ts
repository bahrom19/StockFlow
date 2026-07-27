import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, of, tap } from 'rxjs';
import { CacheService } from '../../infrastructure/cache/cache.service';

/**
 * Interceptor that caches HTTP GET responses using Redis.
 * Skips caching for authenticated/user-specific requests by default.
 *
 * Usage:
 * - Apply globally for GET endpoints
 * - Use @CacheControl decorator to customize TTL per endpoint
 * - Invalidate via CacheService.del(key) on mutations
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  // Endpoints that should NOT be cached
  private readonly excludePaths = [
    '/api/health',
    '/api/health/live',
    '/api/health/ready',
    '/api/health/metrics',
    '/api/auth',
  ];

  // Methods that are safe to cache
  private readonly cacheableMethods = ['GET'];

  constructor(private readonly cacheService: CacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    // Only cache GET requests
    if (!this.cacheableMethods.includes(request.method)) {
      return next.handle();
    }

    // Skip excluded paths
    if (this.excludePaths.some((p) => request.url?.startsWith(p))) {
      return next.handle();
    }

    // Skip authenticated (user-specific) requests — cache only public data
    if (request.user || request.headers.authorization) {
      return next.handle();
    }

    const cacheKey = CacheService.buildKey('response', request.url ?? '/');

    return new Observable((observer) => {
      this.cacheService
        .get<Record<string, unknown>>(cacheKey)
        .then((cached) => {
          if (cached !== null) {
            observer.next(cached);
            observer.complete();
            return;
          }

          next.handle().subscribe({
            next: (data) => {
              if (data !== undefined) {
                this.cacheService
                  .set(cacheKey, data as Record<string, unknown>, 60)
                  .catch((err: Error) =>
                    this.logger.warn(`Cache set failed: ${err.message}`),
                  );
              }
              observer.next(data);
            },
            error: (err: Error) => {
              observer.error(err);
            },
            complete: () => {
              observer.complete();
            },
          });
        })
        .catch((err: Error) => {
          this.logger.warn(`Cache get failed: ${err.message}`);
          next.handle().subscribe({
            next: (data) => observer.next(data),
            error: (err2: Error) => observer.error(err2),
            complete: () => observer.complete(),
          });
        });
    });
  }
}
