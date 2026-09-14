import { NotFoundException } from '@nestjs/common';
import { SupplierExposureService } from '../services/supplier-exposure.service';

/**
 * G9-D3 service unit tests — observable behavior of the read-only exposure
 * service: D1-style tenant-safe supplier lookup, base-currency headline
 * selection, defensive zero-value fallback, Decimal-safe string passthrough,
 * byCurrency grouping, and no-mutation semantics.
 */
describe('SupplierExposureService — open-PO exposure (G9-D3)', () => {
  const companyId = 'company-1';
  const supplierId = 'supplier-1';

  let service: SupplierExposureService;
  let mockSuppliersRepo: { findById: jest.Mock };
  let mockExposureRepo: { getOpenPoExposureAggregates: jest.Mock };
  let mockCompaniesService: { getBaseCurrency: jest.Mock };

  beforeEach(() => {
    mockSuppliersRepo = { findById: jest.fn() };
    mockExposureRepo = { getOpenPoExposureAggregates: jest.fn().mockResolvedValue([]) };
    mockCompaniesService = { getBaseCurrency: jest.fn().mockResolvedValue('KZT') };
    service = new SupplierExposureService(
      mockSuppliersRepo as any,
      mockExposureRepo as any,
      mockCompaniesService as any,
    );
  });

  const row = (over: Partial<Record<string, unknown>> = {}) => ({
    supplierId,
    currency: 'KZT',
    openPoCount: 1,
    committedOpenPo: '1000.0000',
    uninvoicedOpenPo: '1000.0000',
    ...over,
  });

  // 1. no open PO
  it('returns zeroed exposure when the supplier has no open POs', async () => {
    mockSuppliersRepo.findById.mockResolvedValue({ id: supplierId });
    mockExposureRepo.getOpenPoExposureAggregates.mockResolvedValue([]);

    const result = await service.getOpenPoExposure(supplierId, companyId);

    expect(result).toEqual({
      supplierId,
      currency: 'KZT',
      uninvoicedOpenPo: '0',
      committedOpenPo: '0',
      openPoCount: 0,
      byCurrency: [],
    });
  });

  // 2–7. single/multi PO aggregates pass through (base-currency headline)
  it('returns the base-currency group as the headline for one APPROVED PO without invoice', async () => {
    mockSuppliersRepo.findById.mockResolvedValue({ id: supplierId });
    mockExposureRepo.getOpenPoExposureAggregates.mockResolvedValue([row()]);

    const result = await service.getOpenPoExposure(supplierId, companyId);

    expect(result.uninvoicedOpenPo).toBe('1000.0000');
    expect(result.committedOpenPo).toBe('1000.0000');
    expect(result.openPoCount).toBe(1);
    expect(result.currency).toBe('KZT');
  });

  it('maps multi-PO aggregate rows without touching the numbers (status mix APPROVED/ORDERED/PARTIALLY_RECEIVED/RECEIVED)', async () => {
    mockSuppliersRepo.findById.mockResolvedValue({ id: supplierId });
    mockExposureRepo.getOpenPoExposureAggregates.mockResolvedValue([
      row({
        openPoCount: 4,
        committedOpenPo: '4000.0000',
        uninvoicedOpenPo: '1500.0000',
      }),
    ]);

    const result = await service.getOpenPoExposure(supplierId, companyId);

    expect(result.openPoCount).toBe(4);
    expect(result.committedOpenPo).toBe('4000.0000');
    expect(result.uninvoicedOpenPo).toBe('1500.0000');
  });

  it('keeps Decimal-safe string passthrough (precision preserved, no float arithmetic)', async () => {
    mockSuppliersRepo.findById.mockResolvedValue({ id: supplierId });
    mockExposureRepo.getOpenPoExposureAggregates.mockResolvedValue([
      row({
        committedOpenPo: '12345678901234.5678',
        uninvoicedOpenPo: '98765432109876.5432',
      }),
    ]);

    const result = await service.getOpenPoExposure(supplierId, companyId);

    expect(result.committedOpenPo).toBe('12345678901234.5678');
    expect(result.uninvoicedOpenPo).toBe('98765432109876.5432');
  });

  it('provides the defensive byCurrency breakdown alongside the headline', async () => {
    mockSuppliersRepo.findById.mockResolvedValue({ id: supplierId });
    mockExposureRepo.getOpenPoExposureAggregates.mockResolvedValue([
      row({
        currency: 'KZT',
        openPoCount: 3,
        committedOpenPo: '1500000.0000',
        uninvoicedOpenPo: '800000.0000',
      }),
    ]);

    const result = await service.getOpenPoExposure(supplierId, companyId);

    expect(result.byCurrency).toEqual([
      {
        currency: 'KZT',
        openPoCount: 3,
        committedOpenPo: '1500000.0000',
        uninvoicedOpenPo: '800000.0000',
      },
    ]);
    // Headline comes from the base-currency group.
    expect(result.currency).toBe('KZT');
    expect(result.uninvoicedOpenPo).toBe('800000.0000');
  });

  it('does NOT mix a non-base currency group into the base-currency headline', async () => {
    mockSuppliersRepo.findById.mockResolvedValue({ id: supplierId });
    mockCompaniesService.getBaseCurrency.mockResolvedValue('KZT');
    mockExposureRepo.getOpenPoExposureAggregates.mockResolvedValue([
      row({ currency: 'KZT', committedOpenPo: '1000.0000', uninvoicedOpenPo: '500.0000' }),
      row({ currency: 'USD', committedOpenPo: '700.0000', uninvoicedOpenPo: '300.0000' }),
    ]);

    const result = await service.getOpenPoExposure(supplierId, companyId);

    // Only the KZT group contributes to the headline — no arithmetic mixing.
    expect(result.uninvoicedOpenPo).toBe('500.0000');
    expect(result.committedOpenPo).toBe('1000.0000');
    expect(result.openPoCount).toBe(1);
    expect(result.byCurrency).toHaveLength(2);
  });

  // 17/18. tenant isolation + foreign supplier
  it('scopes the supplier lookup to the JWT companyId (tenant-safe, D1 pattern)', async () => {
    mockSuppliersRepo.findById.mockResolvedValue({ id: supplierId });

    await service.getOpenPoExposure(supplierId, companyId);

    expect(mockSuppliersRepo.findById).toHaveBeenCalledWith(supplierId, companyId);
    expect(mockExposureRepo.getOpenPoExposureAggregates).toHaveBeenCalledWith(
      supplierId,
      companyId,
    );
  });

  it('throws NotFound for a foreign/missing supplier and never reaches the aggregation', async () => {
    mockSuppliersRepo.findById.mockResolvedValue(null);

    await expect(
      service.getOpenPoExposure(supplierId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(mockExposureRepo.getOpenPoExposureAggregates).not.toHaveBeenCalled();
  });

  it('is read-only: no mutation methods are invoked on any dependency', async () => {
    mockSuppliersRepo.findById.mockResolvedValue({ id: supplierId });

    await service.getOpenPoExposure(supplierId, companyId);

    // Only reads — findById, aggregate query, base currency lookup.
    expect(mockSuppliersRepo.findById).toHaveBeenCalledTimes(1);
    expect(mockExposureRepo.getOpenPoExposureAggregates).toHaveBeenCalledTimes(1);
    expect(mockCompaniesService.getBaseCurrency).toHaveBeenCalledWith(companyId);
  });
});
