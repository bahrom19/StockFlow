import { Currency } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { SupplierCreditSummaryService } from '../services/supplier-credit-summary.service';
import { SupplierCreditSummaryRepository } from '../repositories/supplier-credit-summary.repository';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { CompaniesService } from '../../companies/services/companies.service';

// G9-D1: Supplier Credit Summary (read-only, base currency only).
const companyId = 'comp-1';
const supplierId = 'supplier-1';
const KZT: Currency = 'KZT';
const USD: Currency = 'USD';

function supplierFixture(creditLimit: Decimal | null) {
  return {
    id: supplierId,
    companyId,
    companyName: 'Alpha Supply',
    bin: null,
    email: null,
    phone: null,
    website: null,
    notes: null,
    isActive: true,
    defaultDueDays: null,
    creditLimit,
    rowVersion: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  } as any;
}

describe('SupplierCreditSummaryService', () => {
  let service: SupplierCreditSummaryService;
  let suppliersRepo: { findById: jest.Mock };
  let companiesService: { getBaseCurrency: jest.Mock };
  let invoiceAggregate: jest.Mock;
  let allocationAggregate: jest.Mock;
  let returnAggregate: jest.Mock;

  beforeEach(() => {
    invoiceAggregate = jest
      .fn()
      .mockResolvedValue({ _sum: { grandTotal: new Decimal(0) } });
    allocationAggregate = jest
      .fn()
      .mockResolvedValue({ _sum: { amount: new Decimal(0) } });
    returnAggregate = jest
      .fn()
      .mockResolvedValue({ _sum: { grandTotal: new Decimal(0) } });

    const prismaService = {
      purchaseInvoice: { aggregate: invoiceAggregate },
      supplierPaymentAllocation: { aggregate: allocationAggregate },
      purchaseReturn: { aggregate: returnAggregate },
    } as any;

    suppliersRepo = {
      findById: jest.fn().mockResolvedValue(supplierFixture(null)),
    };
    companiesService = { getBaseCurrency: jest.fn().mockResolvedValue(KZT) };

    const creditSummaryRepo = new SupplierCreditSummaryRepository(prismaService);
    service = new SupplierCreditSummaryService(
      suppliersRepo as unknown as SuppliersRepository,
      creditSummaryRepo,
      companiesService as unknown as CompaniesService,
    );
  });

  // Aggregate stub helpers — totals are per-scenario.
  function setTotals(opts: {
    invoiced?: string;
    allocated?: string;
    returned?: string;
  }) {
    invoiceAggregate.mockResolvedValue({
      _sum: { grandTotal: new Decimal(opts.invoiced ?? 0) },
    });
    allocationAggregate.mockResolvedValue({
      _sum: { amount: new Decimal(opts.allocated ?? 0) },
    });
    returnAggregate.mockResolvedValue({
      _sum: { grandTotal: new Decimal(opts.returned ?? 0) },
    });
  }

  // ── 1. creditLimit = null ──────────────────────────────────
  it('returns null availableCredit/utilization for a null credit limit but still returns outstandingAP', async () => {
    suppliersRepo.findById.mockResolvedValue(supplierFixture(null));
    setTotals({ invoiced: '500000', allocated: '200000', returned: '50000' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.creditLimit).toBeNull();
    expect(result.availableCredit).toBeNull();
    expect(result.utilizationPercent).toBeNull();
    expect(result.outstandingAP).toBe('250000');
    expect(result.currency).toBe(KZT);
  });

  // ── 2. creditLimit = 0 ─────────────────────────────────────
  it('treats creditLimit = 0 as an explicit zero limit: availableCredit goes negative, utilization stays null (no division by zero)', async () => {
    suppliersRepo.findById.mockResolvedValue(supplierFixture(new Decimal('0')));
    setTotals({ invoiced: '300000', allocated: '100000' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.creditLimit).toBe('0');
    expect(result.outstandingAP).toBe('200000');
    expect(result.availableCredit).toBe('-200000');
    expect(result.utilizationPercent).toBeNull();
  });

  // ── 3. creditLimit > outstandingAP ─────────────────────────
  it('returns positive availableCredit and utilization below 100 when limit exceeds outstanding', async () => {
    suppliersRepo.findById.mockResolvedValue(
      supplierFixture(new Decimal('1000000')),
    );
    setTotals({ invoiced: '500000', allocated: '200000', returned: '50000' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.availableCredit).toBe('750000');
    expect(result.utilizationPercent).toBe('25.00');
  });

  // ── 4. creditLimit = outstandingAP (boundary, NOT exceeded) ─
  it('returns 0 availableCredit and exactly 100.00 utilization at the boundary — not treated as over-limit', async () => {
    suppliersRepo.findById.mockResolvedValue(
      supplierFixture(new Decimal('250000')),
    );
    setTotals({ invoiced: '500000', allocated: '200000', returned: '50000' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.outstandingAP).toBe('250000');
    expect(result.availableCredit).toBe('0');
    expect(result.utilizationPercent).toBe('100.00');
  });

  // ── 5. creditLimit < outstandingAP (over-limit is NOT an error) ─
  it('allows negative availableCredit when outstanding exceeds the limit without throwing or blocking', async () => {
    suppliersRepo.findById.mockResolvedValue(
      supplierFixture(new Decimal('100000')),
    );
    setTotals({ invoiced: '500000', allocated: '200000', returned: '50000' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.availableCredit).toBe('-150000');
    expect(result.utilizationPercent).toBe('250.00');
  });

  // ── 6. outstandingAP = 0 ───────────────────────────────────
  it('returns zero outstanding with full credit available when nothing is outstanding', async () => {
    suppliersRepo.findById.mockResolvedValue(
      supplierFixture(new Decimal('500000')),
    );
    setTotals({ invoiced: '0', allocated: '0', returned: '0' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.outstandingAP).toBe('0');
    expect(result.availableCredit).toBe('500000');
    expect(result.utilizationPercent).toBe('0.00');
  });

  // ── 7/8. returns: approved reduce, draft/cancelled do not ──
  it('includes only APPROVED/COMPLETED base-currency returns in the AP formula', async () => {
    suppliersRepo.findById.mockResolvedValue(
      supplierFixture(new Decimal('500000')),
    );
    setTotals({ invoiced: '500000', allocated: '0', returned: '100000' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(returnAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          supplierId,
          companyId,
          deletedAt: null,
          currency: KZT,
          status: { in: ['APPROVED', 'COMPLETED'] },
          // G15-02-B P2-04: voided COMPLETED returns must not reduce AP.
          isCancelled: false,
        }),
      }),
    );
    // Draft/cancelled returns never appear in the status filter → they do
    // not reduce AP. 500000 − 0 − 100000 = 400000.
    expect(result.outstandingAP).toBe('400000');
  });

  // ── 9. allocated payment reduces supplier outstanding ──────
  it('subtracts active allocation amounts (canonical payment coverage) from outstanding', async () => {
    suppliersRepo.findById.mockResolvedValue(supplierFixture(null));
    setTotals({ invoiced: '560', allocated: '160' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(allocationAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          supplierId,
          companyId,
          deletedAt: null,
        }),
      }),
    );
    expect(result.outstandingAP).toBe('400');
  });

  // ── 10. unallocated payment follows canonical supplier semantics ──
  it('does not reduce outstanding for unallocated payments (no allocation rows → canonical coverage adds 0)', async () => {
    suppliersRepo.findById.mockResolvedValue(supplierFixture(null));
    // An unallocated payment has no SupplierPaymentAllocation rows — the
    // allocation aggregate stays 0 even though a payment exists.
    setTotals({ invoiced: '560', allocated: '0' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.outstandingAP).toBe('560');
  });

  // ── 11. non-base-currency invoice excluded ─────────────────
  it('excludes non-base-currency invoices and returns from the base-currency summary', async () => {
    suppliersRepo.findById.mockResolvedValue(
      supplierFixture(new Decimal('1000000')),
    );
    setTotals({ invoiced: '250000', allocated: '0', returned: '0' });

    await service.getCreditSummary(supplierId, companyId);

    expect(invoiceAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ currency: KZT }),
      }),
    );
    expect(returnAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ currency: KZT }),
      }),
    );
    // Allocations are restricted to base-currency invoices.
    expect(allocationAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { purchaseInvoice: { currency: KZT } },
            { purchaseInvoiceId: null },
          ],
        }),
      }),
    );
  });

  it('uses the company base currency as returned by CompaniesService (not a hard-coded value)', async () => {
    suppliersRepo.findById.mockResolvedValue(supplierFixture(null));
    companiesService.getBaseCurrency.mockResolvedValue(USD);
    setTotals({ invoiced: '100' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(invoiceAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ currency: USD }),
      }),
    );
    expect(result.currency).toBe(USD);
  });

  // ── 12. tenant isolation ───────────────────────────────────
  it('scopes every aggregate and the supplier lookup to the authenticated company', async () => {
    suppliersRepo.findById.mockResolvedValue(
      supplierFixture(new Decimal('1000')),
    );
    setTotals({ invoiced: '100' });

    await service.getCreditSummary(supplierId, companyId);

    expect(suppliersRepo.findById).toHaveBeenCalledWith(supplierId, companyId);
    for (const agg of [invoiceAggregate, allocationAggregate, returnAggregate]) {
      expect(agg).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId, supplierId }),
        }),
      );
    }
  });

  // ── 13. deleted supplier unavailable ───────────────────────
  it('throws NotFound for a missing or soft-deleted supplier', async () => {
    suppliersRepo.findById.mockResolvedValue(null);

    await expect(
      service.getCreditSummary(supplierId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(invoiceAggregate).not.toHaveBeenCalled();
  });

  // ── 16. no division-by-zero (zero limit + zero outstanding) ──
  it('never divides by zero for a zero outstanding with a zero limit', async () => {
    suppliersRepo.findById.mockResolvedValue(supplierFixture(new Decimal('0')));
    setTotals({ invoiced: '0', allocated: '0', returned: '0' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.outstandingAP).toBe('0');
    expect(result.availableCredit).toBe('0');
    expect(result.utilizationPercent).toBeNull();
  });

  // ── 15. Decimal serialization ──────────────────────────────
  it('serializes monetary Decimals as exact strings', async () => {
    suppliersRepo.findById.mockResolvedValue(
      supplierFixture(new Decimal('1234567.8900')),
    );
    setTotals({
      invoiced: '12345.6789',
      allocated: '2345.6789',
      returned: '1000.0000',
    });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.creditLimit).toBe('1234567.89');
    // Decimal.toString() drops insignificant trailing zeros (same convention
    // as the existing finance summary serialization).
    expect(result.outstandingAP).toBe('9000');
    expect(typeof result.outstandingAP).toBe('string');
    expect(typeof result.creditLimit).toBe('string');
    // Utilization: 9000 / 1234567.89 * 100 → 2dp Decimal rounding.
    expect(result.utilizationPercent).toBe('0.73');
  });

  // ── utilization uses exact Decimal arithmetic ──────────────
  it('computes utilization with Decimal precision (e.g. 1/3 of limit → 33.33, not JS float artifacts)', async () => {
    suppliersRepo.findById.mockResolvedValue(
      supplierFixture(new Decimal('300')),
    );
    setTotals({ invoiced: '100' });

    const result = await service.getCreditSummary(supplierId, companyId);

    expect(result.utilizationPercent).toBe('33.33');
  });
});