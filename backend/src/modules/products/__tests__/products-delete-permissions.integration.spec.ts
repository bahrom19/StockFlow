import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RolesRepository } from '../../rbac/repositories/roles.repository';
import { ProductsController } from '../controllers/products.controller';
import { ProductsService } from '../services/products.service';

/**
 * SEC-02 — authorization on `DELETE /products/:id`.
 *
 * The route is guarded by `@UseGuards(JwtAuthGuard, RolesGuard)` +
 * `@RequirePermission('products:delete')`. This spec pins the end-to-end
 * authorization behaviour of that wiring with the REAL RolesGuard backed by a
 * mocked RolesRepository (the same layer the guard uses in production),
 * following the finance integration-test precedent
 * (fiscal-year-close-routes.integration.spec.ts).
 *
 * It asserts:
 *   - a caller whose roles resolve `products:delete` is authorized (200);
 *   - an authenticated caller without it is denied (403, fail-closed);
 *   - a zero-permission role is denied (403);
 *   - an unauthenticated request is denied (401);
 *   - the service is never reached on any denial.
 *
 * Cross-tenant deletion (404) is covered at the service layer in
 * products.service.spec.ts, where the tenant scoping actually lives.
 */

let currentUser: {
  userId: string;
  companyId: string;
  roles: string[];
} | null = { userId: 'user-1', companyId: 'comp-A', roles: ['Admin'] };

/** Auth guard override: injects the current test user, or 401 when signed out. */
const authGuard = {
  canActivate: (ctx: ExecutionContext) => {
    if (!currentUser) {
      // Mirrors JwtAuthGuard/passport rejecting an unauthenticated request.
      throw new UnauthorizedException();
    }
    ctx.switchToHttp().getRequest().user = currentUser;
    return true;
  },
};

describe('DELETE /products/:id — products:delete authorization (SEC-02)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const productsService = {
    softDelete: jest.fn(),
  };
  const rolesRepository = {
    findPermissionCodesByRoleNames: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: RolesRepository, useValue: rolesRepository },
        // Real guard, with the mocked repository injected.
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { userId: 'user-1', companyId: 'comp-A', roles: ['Admin'] };
    productsService.softDelete.mockResolvedValue({ id: 'prod-1' });
  });

  const deleteProduct = () =>
    fetch(`${baseUrl}/products/prod-1`, { method: 'DELETE' });

  it('authorizes a caller whose roles resolve products:delete', async () => {
    rolesRepository.findPermissionCodesByRoleNames.mockResolvedValue([
      'products:read',
      'products:delete',
    ]);

    const res = await deleteProduct();

    expect(res.status).toBe(200);
    expect(productsService.softDelete).toHaveBeenCalledWith('prod-1', {
      userId: 'user-1',
      companyId: 'comp-A',
      roles: ['Admin'],
    });
  });

  it('denies an authenticated caller without products:delete (403, fail closed)', async () => {
    rolesRepository.findPermissionCodesByRoleNames.mockResolvedValue([
      'products:read',
      'products:update',
    ]);

    const res = await deleteProduct();

    expect(res.status).toBe(403);
    expect(productsService.softDelete).not.toHaveBeenCalled();
  });

  it('denies a zero-permission role (403)', async () => {
    currentUser = { userId: 'user-2', companyId: 'comp-A', roles: ['Viewer'] };
    rolesRepository.findPermissionCodesByRoleNames.mockResolvedValue([]);

    const res = await deleteProduct();

    expect(res.status).toBe(403);
    expect(productsService.softDelete).not.toHaveBeenCalled();
  });

  it('denies an unauthenticated request (401)', async () => {
    currentUser = null;

    const res = await deleteProduct();

    expect(res.status).toBe(401);
    expect(rolesRepository.findPermissionCodesByRoleNames).not.toHaveBeenCalled();
    expect(productsService.softDelete).not.toHaveBeenCalled();
  });
});
