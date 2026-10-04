import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PLATFORM_OPERATOR_KEY } from '../../modules/rbac/decorators/require-platform-operator.decorator';

/**
 * G16-N-4 P0-A — platform operator guard for GLOBAL resource mutations.
 *
 * Design constraints this guard deliberately upholds:
 *
 *   * It is a NO-OP unless `@RequirePlatformOperator()` metadata is present,
 *     so it can be registered on a controller without affecting any route
 *     that is not a global-resource mutation.
 *   * Platform authority is derived ONLY from the immutable environment
 *     allowlist (`PLATFORM_OPERATOR_USER_IDS`) and the authenticated
 *     principal's `userId`.
 *   * It NEVER consults RolePermission / Role / Company rows, never falls back
 *     to tenant permissions, and never uses `email` or `companyId`. Tenant
 *     RBAC therefore cannot grant, inherit or forge platform authority.
 *   * It is ADDITIVE: `RolesGuard` still runs afterwards and still enforces
 *     the pre-existing tenant permission. A platform operator without that
 *     permission is denied.
 *
 * Fail closed. Every abnormal condition denies; there is no permissive branch
 * other than "route is not platform-protected".
 */
@Injectable()
export class PlatformOperatorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(
      REQUIRE_PLATFORM_OPERATOR_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) return true;

    const user = context.switchToHttp().getRequest().user as
      | { userId?: string }
      | undefined;

    if (!user?.userId) {
      throw new ForbiddenException('Platform operator authorization required');
    }

    const operatorUserIds = this.readAllowlist();

    if (operatorUserIds.length === 0) {
      throw new ForbiddenException(
        'Platform operator authorization is not configured',
      );
    }

    if (!operatorUserIds.includes(user.userId.toLowerCase())) {
      throw new ForbiddenException('Platform operator authorization required');
    }

    return true;
  }

  /**
   * Read the allowlist defensively: a missing namespace, a missing key or a
   * malformed value all collapse to an empty set, which denies every
   * platform-protected write.
   */
  private readAllowlist(): string[] {
    const configured = this.configService.get<string[]>(
      'platform.operatorUserIds',
    );

    if (!Array.isArray(configured)) return [];

    return configured
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim().toLowerCase())
      .filter((id) => id.length > 0);
  }
}
