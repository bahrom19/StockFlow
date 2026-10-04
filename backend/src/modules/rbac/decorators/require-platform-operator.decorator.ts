import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PLATFORM_OPERATOR_KEY = 'require_platform_operator';

/**
 * G16-N-4 P0-A — marks a route as a GLOBAL resource mutation.
 *
 * The route keeps its existing `@RequirePermission(...)` tenant permission.
 * `PlatformOperatorGuard` adds a second, independent requirement: the
 * authenticated principal's user id must appear in the immutable
 * `PLATFORM_OPERATOR_USER_IDS` allowlist. The two checks are additive —
 * satisfying one never satisfies the other.
 */
export const RequirePlatformOperator = () =>
  SetMetadata(REQUIRE_PLATFORM_OPERATOR_KEY, true);
