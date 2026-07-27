import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { MetricsService } from './metrics.service';

interface RequestWithUser extends Request {
  requestId?: string;
  user?: {
    sub?: string;
    id?: string;
    companyId?: string;
    [key: string]: unknown;
  };
}

/**
 * Interceptor that instruments every HTTP request with Prometheus metrics.
 * Captures:
 * - Request count (by method, path, status)
 * - Request duration (histogram)
 * - In-flight requests
 * - Request ID propagation
 * - Structured logging with timing
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only instrument HTTP requests
    if (!request || !response) {
      return next.handle();
    }

    const method = request.method ?? 'UNKNOWN';
    const path = this.normalizePath(request.route?.path ?? request.url ?? '/');
    const startTime = Date.now();

    // Track in-flight requests
    this.metrics.httpRequestsInFlight.inc({ method });

    // Ensure request ID
    if (!request.requestId) {
      const requestId = uuidv4();
      request.requestId = requestId;
      response.setHeader('x-request-id', requestId);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const status = String(response.statusCode ?? 200);

          this.metrics.httpRequestTotal.inc({ method, path, status });
          this.metrics.httpRequestDuration.observe(
            { method, path, status },
            duration,
          );
          this.metrics.httpRequestsInFlight.dec({ method });

          // Structured log entry
          this.logger.log(
            JSON.stringify({
              requestId: request.requestId,
              method,
              path: request.url,
              status,
              duration,
              userId: request.user?.sub ?? request.user?.id ?? undefined,
              companyId: request.user?.companyId ?? undefined,
              timestamp: new Date().toISOString(),
            }),
          );

          // Detect slow requests (>5s)
          if (duration > 5000) {
            this.logger.warn(
              `Slow request: ${method} ${request.url} (${duration}ms)`,
            );
          }
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          const status = String(
            (error as unknown as Record<string, unknown>).status ?? 500,
          );

          this.metrics.httpRequestTotal.inc({ method, path, status });
          this.metrics.httpRequestDuration.observe(
            { method, path, status },
            duration,
          );
          this.metrics.httpRequestsInFlight.dec({ method });
          this.metrics.errorTotal.inc({
            type: error.name ?? 'UnknownError',
            module: 'http',
          });

          this.logger.error(
            JSON.stringify({
              requestId: request.requestId,
              method,
              path: request.url,
              status,
              duration,
              error: error.message,
              userId: request.user?.sub ?? request.user?.id ?? undefined,
              companyId: request.user?.companyId ?? undefined,
              timestamp: new Date().toISOString(),
            }),
          );
        },
      }),
    );
  }

  /**
   * Normalize dynamic route segments to generic placeholders.
   * E.g. /api/users/123 → /api/users/:id
   */
  private normalizePath(path: string): string {
    return path
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:uuid',
      )
      .replace(/\/\d+/g, '/:id');
  }
}
