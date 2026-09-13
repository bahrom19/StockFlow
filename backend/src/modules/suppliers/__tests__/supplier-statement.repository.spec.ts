import { Currency, PurchaseInvoiceStatus, PurchaseReturnStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SupplierStatementRepository } from '../repositories/supplier-statement.repository';

const companyId = 'comp-1';
const supplierId = 'supplier-1';
const KZT: Currency = 'KZT';

describe('SupplierStatementRepository', () => {
  let repo: SupplierStatementRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      purchaseInvoice: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn() },
      supplierPayment: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn() },
      purchaseReturn: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn() },
      supplierPaymentAllocation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    repo = new SupplierStatementRepository(mockPrisma);
  });

  it('findInvoices scopes by tenant, excludes soft-deleted, and limits to APPROVED/PAID', async () => {
    await repo.findInvoices(supplierId, companyId, undefined, undefined, undefined);
    const where = mockPrisma.purchaseInvoice.findMany.mock.calls[0][0].where;
    expect(where.supplierId).toBe(supplierId);
    expect(where.companyId).toBe(companyId);
    expect(where.deletedAt).toBeNull();
    expect(where.status).toEqual({
      in: [PurchaseInvoiceStatus.APPROVED, PurchaseInvoiceStatus.PAID],
    });
  });

  it('findInvoices applies date range and currency filter when provided', async () => {
    const from = new Date('2026-09-01');
    const to = new Date('2026-09-30');
    await repo.findInvoices(supplierId, companyId, from, to, KZT);
    const where = mockPrisma.purchaseInvoice.findMany.mock.calls[0][0].where;
    expect(where.invoiceDate).toEqual({ gte: from, lte: to });
    expect(where.currency).toBe(KZT);
  });

  it('findPayments scopes by tenant and excludes soft-deleted', async () => {
    await repo.findPayments(supplierId, companyId, undefined, undefined, undefined);
    const where = mockPrisma.supplierPayment.findMany.mock.calls[0][0].where;
    expect(where.supplierId).toBe(supplierId);
    expect(where.companyId).toBe(companyId);
    expect(where.deletedAt).toBeNull();
    expect(where.paymentDate).toBeUndefined();
  });

  it('findReturns limits to APPROVED/COMPLETED and excludes soft-deleted', async () => {
    await repo.findReturns(supplierId, companyId, undefined, undefined, undefined);
    const where = mockPrisma.purchaseReturn.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({
      in: [PurchaseReturnStatus.APPROVED, PurchaseReturnStatus.COMPLETED],
    });
    expect(where.deletedAt).toBeNull();
    expect(where.companyId).toBe(companyId);
    expect(where.supplierId).toBe(supplierId);
  });

  it('findActiveAllocationsForPayments returns [] for empty payment list', async () => {
    const result = await repo.findActiveAllocationsForPayments([], supplierId, companyId);
    expect(result).toEqual([]);
    expect(mockPrisma.supplierPaymentAllocation.findMany).not.toHaveBeenCalled();
  });

  it('findActiveAllocationsForPayments batches by paymentId set, tenant-scoped, active only', async () => {
    await repo.findActiveAllocationsForPayments(['pay-1', 'pay-2'], supplierId, companyId);
    const where = mockPrisma.supplierPaymentAllocation.findMany.mock.calls[0][0].where;
    expect(where.paymentId).toEqual({ in: ['pay-1', 'pay-2'] });
    expect(where.supplierId).toBe(supplierId);
    expect(where.companyId).toBe(companyId);
    expect(where.deletedAt).toBeNull();
  });

  it('getOpeningBalance aggregates movements strictly before date with tenant + status filters', async () => {
    const before = new Date('2026-09-01');
    mockPrisma.purchaseInvoice.aggregate.mockResolvedValue({ _sum: { grandTotal: new Decimal('100000') } });
    mockPrisma.supplierPayment.aggregate.mockResolvedValue({ _sum: { amount: new Decimal('60000') } });
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({ _sum: { grandTotal: new Decimal('10000') } });

    const opening = await repo.getOpeningBalance(supplierId, companyId, before, KZT);

    const invWhere = mockPrisma.purchaseInvoice.aggregate.mock.calls[0][0].where;
    expect(invWhere.invoiceDate).toEqual({ lt: before });
    expect(invWhere.status.in).toEqual([PurchaseInvoiceStatus.APPROVED, PurchaseInvoiceStatus.PAID]);
    expect(invWhere.currency).toBe(KZT);
    expect(invWhere.companyId).toBe(companyId);

    const payWhere = mockPrisma.supplierPayment.aggregate.mock.calls[0][0].where;
    expect(payWhere.paymentDate).toEqual({ lt: before });
    expect(payWhere.deletedAt).toBeNull();

    const retWhere = mockPrisma.purchaseReturn.aggregate.mock.calls[0][0].where;
    expect(retWhere.returnDate).toEqual({ lt: before });
    expect(retWhere.status.in).toEqual([PurchaseReturnStatus.APPROVED, PurchaseReturnStatus.COMPLETED]);

    expect(opening.invoices.toString()).toBe('100000');
    expect(opening.payments.toString()).toBe('60000');
    expect(opening.returns.toString()).toBe('10000');
  });

  it('getOpeningBalance defaults sums to 0 when no rows', async () => {
    const before = new Date('2026-09-01');
    mockPrisma.purchaseInvoice.aggregate.mockResolvedValue({ _sum: { grandTotal: null } });
    mockPrisma.supplierPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({ _sum: { grandTotal: null } });

    const opening = await repo.getOpeningBalance(supplierId, companyId, before);
    expect(opening.invoices.toString()).toBe('0');
    expect(opening.payments.toString()).toBe('0');
    expect(opening.returns.toString()).toBe('0');
  });
});
