import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to require specific permission(s) on a route handler.
 * Used together with the RolesGuard.
 *
 * @example
 * ```typescript
 * @RequirePermission('products:create')
 * async create(@Body() dto: CreateProductDto) { ... }
 * ```
 *
 * @example
 * ```typescript
 * @RequirePermission(['products:create', 'products:update'])
 * async upsert(@Body() dto: UpsertProductDto) { ... }
 * ```
 */
export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';

export const RequirePermission = (
  permissions: string | string[],
): ReturnType<typeof SetMetadata<string | string[], string | string[]>> =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
