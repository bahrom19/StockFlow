import { SupplierExposureController } from '../controllers/supplier-exposure.controller';
import { SupplierExposureService } from '../services/supplier-exposure.service';
import { REQUIRED_PERMISSIONS_KEY } from '../../rbac/decorators/require-permission.decorator';

// G9-D3: RBAC + delegation for the read-only open-po-exposure endpoint
// (same pattern as the G9-D1 credit-summary controller spec). Unauthorized
// roles are rejected by the RolesGuard via the `required_permissions`
// metadata — here we verify the metadata and the controller's tenant-safe
// delegation.
describe('SupplierExposureController', () => {
  const companyId = 'comp-1';
  const supplierId = 'supplier-1';

  function handlerPermission(): string | string[] {
    const target = SupplierExposureController.prototype.getOpenPoExposure;
    return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, target);
  }

  it('requires suppliers:read permission (unauthorized roles are rejected by RolesGuard)', () => {
    expect(handlerPermission()).toBe('suppliers:read');
  });

  it('delegates to the service with the supplierId and the JWT companyId (tenant from token, not body)', async () => {
    const expected = {
      supplierId,
      currency: 'KZT',
      uninvoicedOpenPo: '0',
      committedOpenPo: '0',
      openPoCount: 0,
      byCurrency: [],
    };
    const serviceMock = { getOpenPoExposure: jest.fn().mockResolvedValue(expected) };
    const controller = new SupplierExposureController(
      serviceMock as unknown as SupplierExposureService,
    );

    const result = await controller.getOpenPoExposure(supplierId, {
      companyId,
    } as any);

    expect(serviceMock.getOpenPoExposure).toHaveBeenCalledWith(
      supplierId,
      companyId,
    );
    expect(result).toBe(expected);
  });
});
