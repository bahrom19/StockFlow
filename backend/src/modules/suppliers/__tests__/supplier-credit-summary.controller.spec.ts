import { SupplierCreditSummaryController } from '../controllers/supplier-credit-summary.controller';
import { SupplierCreditSummaryService } from '../services/supplier-credit-summary.service';
import { REQUIRED_PERMISSIONS_KEY } from '../../rbac/decorators/require-permission.decorator';

// G9-D1: RBAC + delegation for the read-only credit-summary endpoint.
// Scenario 14 (unauthorized role rejected) is enforced by the RolesGuard via
// the `required_permissions` metadata — here we verify the metadata and the
// controller's tenant-safe delegation.
describe('SupplierCreditSummaryController', () => {
  const companyId = 'comp-1';
  const supplierId = 'supplier-1';

  function handlerPermission(): string | string[] {
    const target = SupplierCreditSummaryController.prototype.getCreditSummary;
    return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, target);
  }

  it('requires suppliers:read permission (unauthorized roles are rejected by RolesGuard)', () => {
    expect(handlerPermission()).toBe('suppliers:read');
  });

  it('delegates to the service with the supplierId and the JWT companyId (tenant from token, not body)', async () => {
    const expected = { supplierId, outstandingAP: '0', currency: 'KZT' };
    const serviceMock = { getCreditSummary: jest.fn().mockResolvedValue(expected) };
    const controller = new SupplierCreditSummaryController(
      serviceMock as unknown as SupplierCreditSummaryService,
    );

    const result = await controller.getCreditSummary(supplierId, {
      companyId,
    } as any);

    expect(serviceMock.getCreditSummary).toHaveBeenCalledWith(
      supplierId,
      companyId,
    );
    expect(result).toBe(expected);
  });
});