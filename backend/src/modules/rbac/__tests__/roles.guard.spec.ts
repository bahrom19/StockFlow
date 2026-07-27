import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../guards/roles.guard';
import { RolesRepository } from '../repositories/roles.repository';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockRolesRepo: jest.Mocked<RolesRepository>;
  let mockContext: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    mockRolesRepo = {
      findPermissionCodesByRoleNames: jest.fn(),
    } as unknown as jest.Mocked<RolesRepository>;

    guard = new RolesGuard(mockReflector, mockRolesRepo);
  });

  function createContext(user?: any): any {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
  }

  // ─────────────────────────────────────────────
  // NO PERMISSION REQUIRED
  // ─────────────────────────────────────────────
  it('should allow access when no permissions are required', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    const result = await guard.canActivate(createContext());
    expect(result).toBe(true);
  });

  // ─────────────────────────────────────────────
  // AUTHENTICATION REQUIRED
  // ─────────────────────────────────────────────
  it('should throw ForbiddenException when user is not authenticated', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('sales:read');
    await expect(guard.canActivate(createContext(undefined))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw ForbiddenException when authentication required message', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('sales:read');
    await expect(guard.canActivate(createContext(undefined))).rejects.toThrow(
      'Authentication required',
    );
  });

  // ─────────────────────────────────────────────
  // SINGLE PERMISSION CHECK
  // ─────────────────────────────────────────────
  it('should allow access when user has the required permission', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('sales:read');
    mockRolesRepo.findPermissionCodesByRoleNames.mockResolvedValue([
      'sales:read',
      'products:read',
    ]);

    const result = await guard.canActivate(
      createContext({
        userId: 'user-1',
        companyId: 'comp-1',
        roles: ['Admin'],
      }),
    );
    expect(result).toBe(true);
  });

  it('should deny access when user lacks the required permission', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('sales:create');
    mockRolesRepo.findPermissionCodesByRoleNames.mockResolvedValue([
      'sales:read',
      'products:read',
    ]);

    await expect(
      guard.canActivate(
        createContext({
          userId: 'user-1',
          companyId: 'comp-1',
          roles: ['Viewer'],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should deny access when user has no roles', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('sales:read');
    mockRolesRepo.findPermissionCodesByRoleNames.mockResolvedValue([]);

    await expect(
      guard.canActivate(
        createContext({ userId: 'user-1', companyId: 'comp-1', roles: [] }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─────────────────────────────────────────────
  // MULTIPLE PERMISSIONS (AND logic)
  // ─────────────────────────────────────────────
  it('should require ALL permissions when multiple are specified', async () => {
    mockReflector.getAllAndOverride.mockReturnValue([
      'sales:read',
      'sales:create',
    ]);
    mockRolesRepo.findPermissionCodesByRoleNames.mockResolvedValue([
      'sales:read',
    ]);

    await expect(
      guard.canActivate(
        createContext({
          userId: 'user-1',
          companyId: 'comp-1',
          roles: ['Editor'],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow when user has all required permissions', async () => {
    mockReflector.getAllAndOverride.mockReturnValue([
      'sales:read',
      'sales:create',
    ]);
    mockRolesRepo.findPermissionCodesByRoleNames.mockResolvedValue([
      'sales:read',
      'sales:create',
      'products:read',
    ]);

    const result = await guard.canActivate(
      createContext({
        userId: 'user-1',
        companyId: 'comp-1',
        roles: ['Admin'],
      }),
    );
    expect(result).toBe(true);
  });

  // ─────────────────────────────────────────────
  // COMPANY ISOLATION
  // ─────────────────────────────────────────────
  it('should pass companyId to permissions query', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('sales:read');
    mockRolesRepo.findPermissionCodesByRoleNames.mockResolvedValue([
      'sales:read',
    ]);

    await guard.canActivate(
      createContext({
        userId: 'user-1',
        companyId: 'specific-company',
        roles: ['Admin'],
      }),
    );
    expect(mockRolesRepo.findPermissionCodesByRoleNames).toHaveBeenCalledWith(
      ['Admin'],
      'specific-company',
    );
  });

  // ─────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────
  it('should handle role names already loaded by JwtStrategy', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('inventory:read');
    mockRolesRepo.findPermissionCodesByRoleNames.mockResolvedValue([
      'inventory:read',
    ]);

    const result = await guard.canActivate(
      createContext({
        userId: 'user-1',
        companyId: 'comp-1',
        roles: ['WarehouseManager', 'Viewer'],
      }),
    );
    expect(result).toBe(true);
    expect(mockRolesRepo.findPermissionCodesByRoleNames).toHaveBeenCalledWith(
      ['WarehouseManager', 'Viewer'],
      'comp-1',
    );
  });

  it('should return insufficient permissions for empty permission set', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('sales:read');
    mockRolesRepo.findPermissionCodesByRoleNames.mockResolvedValue([]);

    const user = { userId: 'user-1', companyId: 'comp-1', roles: ['Guest'] };
    await expect(guard.canActivate(createContext(user))).rejects.toThrow(
      'Insufficient permissions',
    );
  });
});
