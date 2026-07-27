import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { RolesRepository } from '../repositories/roles.repository';

/**
 * Guard that checks if the authenticated user has the required permissions
 * (set via @RequirePermission decorator) through their assigned roles.
 *
 * Works together with JwtAuthGuard — must be applied after it so that
 * `request.user` is populated with the JwtPayload (which already contains
 * freshly-loaded role names from JwtStrategy).
 *
 * Uses a single focused query via RolesRepository to load permission codes
 * for the user's roles, avoiding the pagination pitfall and unnecessary
 * count queries.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesRepository: RolesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      string | string[] | undefined
    >(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // No permissions required — allow access
    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | {
          userId: string;
          companyId: string;
          roles: string[];
        }
      | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Reuse the role names already loaded by JwtStrategy
    const roleNames = user.roles;

    if (roleNames.length === 0) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Single focused query via repository
    const permissionCodes =
      await this.rolesRepository.findPermissionCodesByRoleNames(
        roleNames,
        user.companyId,
      );

    const userPermissionCodes = new Set(permissionCodes);

    // Check if user has all required permissions
    const required = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    const hasAllPermissions = required.every((perm) =>
      userPermissionCodes.has(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
