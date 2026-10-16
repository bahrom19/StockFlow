import { ThrottlerOptions } from '@nestjs/throttler';
import { isAiThrottleRoute } from '../../modules/ai/decorators/ai-throttle.decorator';

/**
 * Throttler buckets applied to every route.
 *
 * The guard evaluates each registered throttler against every request, so a
 * bucket declared here is not scoped to a single endpoint unless it declares
 * `skipIf`. Keep this list free of module-side effects so it can be imported
 * by tests without loading the whole application graph.
 *
 * General-purpose buckets (`short`, `medium`, `long`) are intentionally left
 * unscoped: they are the baseline abuse protection for every API endpoint.
 */
export const THROTTLER_DEFINITIONS: ThrottlerOptions[] = [
  {
    name: 'short',
    ttl: 1000,
    limit: 10,
  },
  {
    name: 'medium',
    ttl: 10000,
    limit: 50,
  },
  {
    name: 'long',
    ttl: 60000,
    limit: 200,
  },
  // AI-specific rate limits (per-user, applied via @AIThrottle decorator).
  // Scoped to AI routes: without skipIf these buckets also capped ordinary
  // endpoints at 10 req/min per IP.
  {
    name: 'ai-minute',
    ttl: 60000, // 1 minute
    limit: 10, // 10 requests per minute per user
    skipIf: (context) => !isAiThrottleRoute(context),
  },
  {
    name: 'ai-hour',
    ttl: 3600000, // 1 hour
    limit: 50, // 50 requests per hour per user
    skipIf: (context) => !isAiThrottleRoute(context),
  },
];
