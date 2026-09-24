import { Reflector } from '@nestjs/core';
import { ProductsController } from '../controllers/products.controller';
import { REQUIRED_PERMISSIONS_KEY } from '../../rbac/decorators/require-permission.decorator';

/**
 * G15-05-D regression — product endpoints enforce existing RBAC permissions.
 *
 * POST /products requires `products:create`, PATCH /products/:id requires
 * `products:update` (both seeded permissions; no new permission introduced).
 * RolesGuard itself is covered by rbac specs; here we assert the metadata
 * wiring on the controller.
 */
describe('ProductsController — RBAC metadata (G15-05-D)', () => {
  const reflector = new Reflector();

  const required = (method: keyof ProductsController) =>
    reflector.getAllAndOverride<string | string[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [
        ProductsController.prototype[method],
        ProductsController,
      ] as any,
    );

  it('POST /products requires products:create', () => {
    expect(required('create')).toBe('products:create');
  });

  it('PATCH /products/:id requires products:update', () => {
    expect(required('update')).toBe('products:update');
  });
});
