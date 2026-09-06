import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/**
 * AI-specific throttle decorator.
 *
 * Applies per-user rate limiting using authenticated userId from JWT.
 * Limits: 10/min + 50/hour per user.
 *
 * The global ThrottlerGuard handles the actual rate limiting.
 * This decorator overrides the key generation to use userId instead of IP.
 */
export const AI_THROTTLE_KEY = 'ai_throttle_config';

export interface AIThrottleConfig {
  minuteLimit: number;
  hourLimit: number;
}

/**
 * Extract userId from the request's authenticated JWT payload.
 * Falls back to IP if userId is not available (shouldn't happen for authenticated routes).
 */
function getUserIdFromRequest(context: any): string {
  const request = context.switchToHttp().getRequest();
  // JwtAuthGuard attaches user to request
  const user = request.user;
  if (user?.userId) {
    return `user:${user.userId}`;
  }
  // Fallback to IP (shouldn't happen for authenticated AI routes)
  return `ip:${request.ip}`;
}

/**
 * Decorator for AI-specific rate limiting.
 *
 * Usage:
 * ```typescript
 * @AIThrottle()
 * @Post('chat')
 * async chat(...) { ... }
 * ```
 *
 * Limits:
 * - 10 requests per minute per authenticated user
 * - 50 requests per hour per authenticated user
 */
export function AIThrottle() {
  return applyDecorators(
    SetMetadata(AI_THROTTLE_KEY, {
      minuteLimit: 10,
      hourLimit: 50,
    } as AIThrottleConfig),
    Throttle({
      'ai-minute': {
        ttl: 60000,
        limit: 10,
        generateKey: (context: any) => getUserIdFromRequest(context),
      },
      'ai-hour': {
        ttl: 3600000,
        limit: 50,
        generateKey: (context: any) => getUserIdFromRequest(context),
      },
    }),
  );
}
