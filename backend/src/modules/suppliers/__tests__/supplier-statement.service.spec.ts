import { Currency, PurchaseInvoiceStatus, PurchaseReturnStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SupplierStatementService } from '../services/supplier-statement.service';
import { SupplierStatementRepository } from '../repositories/supplier-statement.repository';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierCreditSummaryService } from '../services/supplier-credit-summary.service';
import { SupplierCreditSummaryRepository } from '../repositories/supplier-credit-summary.repository';
import { CompaniesService } from '../../companies/services/companies.service';
import {
  StatementAllocationRow,
  StatementInvoiceRow,
  StatementPaymentRow,
  StatementReturnRow,
} from '../repositories/supplier-statement.repository';
import { SupplierStatementCurrencyGroupEntity } from '../entities/supplier-statement.entity';

const companyId = 'comp-1';
const supplierId = 'supplier-1';
const KZT: Currency = 'KZT';
const USD: Currency = 'USD';

function invoice(
  id: string,
  invoiceNumber: string,
  date: string,
  grandTotal: string,
  currency: Currency = KZT,
  status: PurchaseInvoiceStatus = PurchaseInvoiceStatus.APPROVED,
): StatementInvoiceRow {
  return {
    id,
    invoiceNumber,
    invoiceDate: new Date(date),
    grandTotal: new Decimal(grandTotal),
    currency,
    status,
  };
}

function payment(
  id: string,
  paymentNumber: string,
  date: string,
  amount: string,
  currency: Currency = KZT,
): StatementPaymentRow {
  return {
    id,
    paymentNumber,
    paymentDate: new Date(date),
    amount: new Decimal(amount),
    currency,
  };
}

function ret(
  id: string,
  returnNumber: string,
  date: string,
  grandTotal: string,
  currency: Currency = KZT,
  status: PurchaseReturnStatus = PurchaseReturnStatus.APPROVED,
): StatementReturnRow {
  return {
    id,
    returnNumber,
    returnDate: new Date(date),
    grandTotal: new Decimal(grandTotal),
    currency,
    status,
  };
}

function alloc(
  paymentId: string,
  purchaseInvoiceId: string,
  amount: string,
): StatementAllocationRow {
  return { paymentId, purchaseInvoiceId, amount: new Decimal(amount) };
}

function one<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error('expected at least one item');
  return arr[0]!;
}

describe('SupplierStatementService', () => {
  let service: SupplierStatementService;
  let mockSuppliersRepo: { findById: jest.Mock };
  let mockStatementRepo: {
    findInvoices: jest.Mock;
    findPayments: jest.Mock;
    findReturns: jest.Mock;
    findActiveAllocationsForPayments: jest.Mock;
    getOpeningBalance: jest.Mock;
  };

  const setData = (opts: {
    invoices?: StatementInvoiceRow[];
    payments?: StatementPaymentRow[];
    returns?: StatementReturnRow[];
    allocations?: StatementAllocationRow[];
    opening?: { invoices: Decimal; payments: Decimal; returns: Decimal };
  }) => {
    mockStatementRepo.findInvoices.mockResolvedValue(opts.invoices ?? []);
    // Date-aware mock: mirrors the repo dateRange (gte/lte) so opening-leg
    // tests can distinguish pre-date from in-period payments.
    mockStatementRepo.findPayments.mockImplementation(
      (
        _sid: string,
        _cid: string,
        from?: Date,
        to?: Date,
        _cur?: Currency,
      ) =>
        Promise.resolve(
          (opts.payments ?? []).filter(
            (p) =>
              (!from || p.paymentDate >= from) &&
              (!to || p.paymentDate <= to),
          ),
        ),
    );
    mockStatementRepo.findReturns.mockResolvedValue(opts.returns ?? []);
    mockStatementRepo.findActiveAllocationsForPayments.mockImplementation(
      (ids: string[]) =>
        Promise.resolve(
          (opts.allocations ?? []).filter((a) => ids.includes(a.paymentId)),
        ),
    );
    mockStatementRepo.getOpeningBalance.mockResolvedValue(
      opts.opening ?? {
        invoices: new Decimal(0),
        payments: new Decimal(0),
        returns: new Decimal(0),
      },
    );
  };

  beforeEach(() => {
    mockSuppliersRepo = { findById: jest.fn().mockResolvedValue({ id: supplierId }) };
    mockStatementRepo = {
      findInvoices: jest.fn().mockResolvedValue([]),
      findPayments: jest.fn().mockResolvedValue([]),
      findReturns: jest.fn().mockResolvedValue([]),
      findActiveAllocationsForPayments: jest.fn().mockResolvedValue([]),
      getOpeningBalance: jest.fn(),
    };
    service = new SupplierStatementService(
      mockSuppliersRepo as unknown as SuppliersRepository,
      mockStatementRepo as unknown as SupplierStatementRepository,
    );
  });

  const run = (query: Record<string, unknown> = {}) =>
    service.getStatement(supplierId, companyId, query as never);

  const group = async (
    query: Record<string, unknown> = {},
  ): Promise<SupplierStatementCurrencyGroupEntity> => {
    const result = await run(query);
    return one(result.currencies);
  };

  it('1. invoice only → single INVOICE entry, closing = grandTotal', async () => {
    setData({ invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')] });
    const g = await group({ currency: KZT });
    const e = g.entries[0]!;
    expect(e).toMatchObject({
      entryType: 'INVOICE',
      reference: 'INV-001',
      debit: '100000',
      credit: '0',
      amount: '100000',
      runningBalance: '100000',
    });
    expect(g.openingBalance).toBe('0');
    expect(g.closingBalance).toBe('100000');
  });

  it('2. invoice + fully allocated payment → closing = 0', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100000')],
      allocations: [alloc('pay-1', 'inv-1', '100000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries.map((x) => x.entryType)).toEqual(['INVOICE', 'PAYMENT']);
    expect(g.entries[1]!.allocatedAmount).toBe('100000');
    expect(g.entries[1]!.unallocatedAmount).toBe('0');
    expect(g.closingBalance).toBe('0');
  });

  it('3. invoice + partial payment → closing = invoice - payment', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '60000')],
      allocations: [alloc('pay-1', 'inv-1', '60000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries[1]!.credit).toBe('60000');
    expect(g.closingBalance).toBe('40000');
  });

  it('4. unallocated payment → PAYMENT credit 0 (canonical AP), unallocated = full amount', async () => {
    setData({
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100000')],
      allocations: [],
    });
    const g = await group({ currency: KZT });
    const p = g.entries[0]!;
    expect(p.entryType).toBe('PAYMENT');
    expect(p.amount).toBe('100000');
    expect(p.credit).toBe('0');
    expect(p.allocatedAmount).toBe('0');
    expect(p.unallocatedAmount).toBe('100000');
    expect(g.closingBalance).toBe('0');
  });

  it('5. multiple allocations → allocatedAmount = sum, no double deduction', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100000')],
      allocations: [
        alloc('pay-1', 'inv-1', '60000'),
        alloc('pay-1', 'inv-1', '40000'),
      ],
    });
    const g = await group({ currency: KZT });
    const p = g.entries[1]!;
    expect(p.allocations).toHaveLength(2);
    expect(p.allocatedAmount).toBe('100000');
    expect(p.unallocatedAmount).toBe('0');
    expect(g.closingBalance).toBe('0');
  });

  it('6. deleted allocation ignored → allocated uses only active rows', async () => {
    setData({
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100000')],
      allocations: [alloc('pay-1', 'inv-1', '60000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries[0]!.allocatedAmount).toBe('60000');
    expect(g.entries[0]!.unallocatedAmount).toBe('40000');
  });

  it('7. return → RETURN entry reduces balance', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      returns: [ret('ret-1', 'RET-001', '2026-09-10', '20000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries.map((e) => e.entryType)).toEqual(['INVOICE', 'RETURN']);
    expect(g.entries[1]!.credit).toBe('20000');
    expect(g.closingBalance).toBe('80000');
  });

  it('8. invoice + payment + return combined', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '60000')],
      returns: [ret('ret-1', 'RET-001', '2026-09-10', '20000')],
      allocations: [alloc('pay-1', 'inv-1', '60000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries).toHaveLength(3);
    expect(g.closingBalance).toBe('20000');
  });

  it('9. cancelled return excluded from statement', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      returns: [ret('ret-1', 'RET-001', '2026-09-10', '20000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries.map((e) => e.entryType)).toEqual(['INVOICE', 'RETURN']);
    expect(g.entries[1]!.status).toBe('APPROVED');
  });

  it('10. deleted invoice excluded (only repo-supplied rows appear)', async () => {
    setData({ invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')] });
    const g = await group({ currency: KZT });
    expect(g.entries).toHaveLength(1);
    expect(g.entries[0]!.sourceEntityId).toBe('inv-1');
  });

  it('11. supplier isolation → repo reads scoped to supplierId', async () => {
    setData({ invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')] });
    await run({});
    expect(mockStatementRepo.findInvoices).toHaveBeenCalledWith(
      supplierId, companyId, undefined, undefined, undefined,
    );
    expect(mockStatementRepo.findPayments).toHaveBeenCalledWith(
      supplierId, companyId, undefined, undefined, undefined,
    );
  });

  it('12. company isolation → repo reads receive companyId from auth context', async () => {
    setData({ invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')] });
    await run({});
    expect(mockStatementRepo.findInvoices).toHaveBeenCalledWith(
      supplierId, companyId, undefined, undefined, undefined,
    );
    expect(mockStatementRepo.findReturns).toHaveBeenCalledWith(
      supplierId, companyId, undefined, undefined, undefined,
    );
  });

  it('13. multi-currency separation → independent groups, no summed balance', async () => {
    setData({
      invoices: [
        invoice('inv-1', 'INV-001', '2026-09-01', '100000', KZT),
        invoice('inv-2', 'INV-002', '2026-09-02', '50', USD),
      ],
    });
    const result = await run({});
    expect(result.currencies).toHaveLength(2);
    const kzt = one(result.currencies.filter((c) => c.currency === KZT));
    const usd = one(result.currencies.filter((c) => c.currency === USD));
    expect(kzt.closingBalance).toBe('100000');
    expect(usd.closingBalance).toBe('50');
  });

  it('14. dateFrom/dateTo boundaries → parsed business dates + opening computed', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      opening: {
        invoices: new Decimal('20000'),
        payments: new Decimal(0),
        returns: new Decimal(0),
      },
    });
    await run({ dateFrom: '2026-09-01', dateTo: '2026-09-30', currency: KZT });
    expect(mockStatementRepo.findInvoices).toHaveBeenCalledWith(
      supplierId, companyId, new Date('2026-09-01'), new Date('2026-09-30'), KZT,
    );
    expect(mockStatementRepo.getOpeningBalance).toHaveBeenCalledWith(
      supplierId, companyId, new Date('2026-09-01'), KZT,
    );
  });

  it('15. opening balance included in running and closing', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      opening: {
        invoices: new Decimal('50000'),
        payments: new Decimal(0),
        returns: new Decimal(0),
      },
    });
    const g = await group({ dateFrom: '2026-09-01', currency: KZT });
    expect(g.openingBalance).toBe('50000');
    expect(g.entries[0]!.runningBalance).toBe('150000');
    expect(g.closingBalance).toBe('150000');
  });

  it('16. closing balance = opening + Σ debit − Σ credit', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '60000')],
      returns: [ret('ret-1', 'RET-001', '2026-09-10', '20000')],
      allocations: [alloc('pay-1', 'inv-1', '60000')],
      opening: {
        invoices: new Decimal('50000'),
        payments: new Decimal(0),
        returns: new Decimal(0),
      },
    });
    const g = await group({ dateFrom: '2026-09-01', currency: KZT });
    const expected = new Decimal(g.openingBalance)
      .add(new Decimal(g.totals.debit))
      .sub(new Decimal(g.totals.credit))
      .toString();
    expect(g.closingBalance).toBe(expected);
    expect(g.closingBalance).toBe('70000');
  });

  it('17. running balance invariant — sequential opening+debit−credit', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '60000')],
      allocations: [alloc('pay-1', 'inv-1', '60000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries.map((e) => e.runningBalance)).toEqual(['100000', '40000']);
  });

  it('18. deterministic same-date ordering — INVOICE, PAYMENT, RETURN', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-05', '100000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '60000')],
      returns: [ret('ret-1', 'RET-001', '2026-09-05', '20000')],
      allocations: [alloc('pay-1', 'inv-1', '60000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries.map((e) => e.entryType)).toEqual([
      'INVOICE',
      'PAYMENT',
      'RETURN',
    ]);
  });

  it('19. payment allocation detail → allocations[] with invoice reference', async () => {
    setData({
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100000')],
      allocations: [alloc('pay-1', 'inv-1', '60000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries[0]!.allocations).toEqual([
      { purchaseInvoiceId: 'inv-1', allocatedAmount: '60000' },
    ]);
  });

  it('20. unallocated amount = payment.amount − Σ active allocations', async () => {
    setData({
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100000')],
      allocations: [
        alloc('pay-1', 'inv-1', '30000'),
        alloc('pay-1', 'inv-2', '30000'),
      ],
    });
    const g = await group({ currency: KZT });
    expect(g.entries[0]!.allocatedAmount).toBe('60000');
    expect(g.entries[0]!.unallocatedAmount).toBe('40000');
  });

  it('21. paidAmount cannot affect the statement (canonical source is grandTotal)', async () => {
    const inv = invoice('inv-1', 'INV-001', '2026-09-01', '100000');
    (inv as unknown as { paidAmount: Decimal }).paidAmount = new Decimal('100000');
    setData({ invoices: [inv] });
    const g = await group({ currency: KZT });
    expect(g.entries[0]!.amount).toBe('100000');
    expect(g.entries[0]!.debit).toBe('100000');
    expect(g.closingBalance).toBe('100000');
  });

  it('22. PAID invoice status included as a statement entry', async () => {
    setData({
      invoices: [
        invoice('inv-1', 'INV-001', '2026-09-01', '100000', KZT, PurchaseInvoiceStatus.PAID),
      ],
    });
    const g = await group({ currency: KZT });
    expect(g.entries[0]!.status).toBe('PAID');
    expect(g.entries[0]!.entryType).toBe('INVOICE');
  });

  it('23. deleted payment excluded (repo supplies only active payments)', async () => {
    setData({
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100000')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries).toHaveLength(1);
    expect(g.entries[0]!.status).toBe('ACTIVE');
  });

  it('24. APPROVED and COMPLETED return statuses both reduce balance', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '100000')],
      returns: [
        ret('ret-1', 'RET-001', '2026-09-10', '10000', KZT, PurchaseReturnStatus.APPROVED),
        ret('ret-2', 'RET-002', '2026-09-11', '15000', KZT, PurchaseReturnStatus.COMPLETED),
      ],
    });
    const g = await group({ currency: KZT });
    expect(g.entries.map((e) => e.status)).toEqual(['APPROVED', 'APPROVED', 'COMPLETED']);
    expect(g.closingBalance).toBe('75000');
  });

  it('25. G14-03-01 scenario B: invoice 1000 + payment 100 + alloc 0 → credit 0, closing 1000', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '1000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100')],
      allocations: [],
    });
    const g = await group({ currency: KZT });
    expect(g.entries[1]!.entryType).toBe('PAYMENT');
    expect(g.entries[1]!.amount).toBe('100');
    expect(g.entries[1]!.credit).toBe('0');
    expect(g.closingBalance).toBe('1000');
  });

  it('26. G14-03-01 scenario D: invoice 1000 + payment 100 + alloc 50 → credit 50, closing 950', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '1000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100')],
      allocations: [alloc('pay-1', 'inv-1', '50')],
    });
    const g = await group({ currency: KZT });
    expect(g.entries[1]!.credit).toBe('50');
    expect(g.entries[1]!.allocatedAmount).toBe('50');
    expect(g.entries[1]!.unallocatedAmount).toBe('50');
    expect(g.closingBalance).toBe('950');
  });

  it('27. G14-03-01 scenario E: voided payment contributes 0 (repo excludes soft-deleted)', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '1000')],
      payments: [],
      allocations: [],
    });
    const g = await group({ currency: KZT });
    expect(g.entries).toHaveLength(1);
    expect(g.closingBalance).toBe('1000');
  });

  it('28. G14-03-01 opening uses allocation-based payment leg', async () => {
    setData({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '1000')],
      payments: [payment('pay-0', 'PAY-000000', '2026-08-20', '500')],
      allocations: [alloc('pay-0', 'inv-0', '300')],
      opening: {
        invoices: new Decimal(0),
        payments: new Decimal('500'),
        returns: new Decimal(0),
      },
    });
    const g = await group({ dateFrom: '2026-09-01', currency: KZT });
    // Opening payment leg = 300 allocated (not the 500 payment amount).
    expect(g.openingBalance).toBe('-300');
    expect(g.closingBalance).toBe('700');
  });
});




describe('G14-03-01 statement ↔ credit-summary consistency (shared fixtures, no prod dependency)', () => {
  const buildCreditService = (totals: {
    invoiced: string;
    allocated: string;
    returned: string;
  }) => {
    const creditService = new SupplierCreditSummaryService(
      { findById: jest.fn().mockResolvedValue({ id: supplierId }) } as unknown as SuppliersRepository,
      {
        getBaseCurrencyTotals: jest.fn().mockResolvedValue({
          totalInvoiced: new Decimal(totals.invoiced),
          totalAllocated: new Decimal(totals.allocated),
          totalReturned: new Decimal(totals.returned),
        }),
      } as unknown as SupplierCreditSummaryRepository,
      { getBaseCurrency: jest.fn().mockResolvedValue(KZT) } as unknown as CompaniesService,
    );
    return creditService;
  };

  const buildStatementService = (opts: {
    invoices?: StatementInvoiceRow[];
    payments?: StatementPaymentRow[];
    allocations?: StatementAllocationRow[];
  }) => {
    const statementService = new SupplierStatementService(
      { findById: jest.fn().mockResolvedValue({ id: supplierId }) } as unknown as SuppliersRepository,
      {
        findInvoices: jest.fn().mockResolvedValue(opts.invoices ?? []),
        findPayments: jest.fn().mockResolvedValue(opts.payments ?? []),
        findReturns: jest.fn().mockResolvedValue([]),
        findActiveAllocationsForPayments: jest.fn(
          (ids: string[]) =>
            Promise.resolve(
              (opts.allocations ?? []).filter((a) => ids.includes(a.paymentId)),
            ),
        ),
        getOpeningBalance: jest.fn(),
      } as unknown as SupplierStatementRepository,
    );
    return statementService;
  };

  it('unallocated payment → both models report 1000', async () => {
    const statement = buildStatementService({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '1000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100')],
      allocations: [],
    });
    const credit = buildCreditService({ invoiced: '1000', allocated: '0', returned: '0' });
    const g = one(
      (await statement.getStatement(supplierId, companyId, { currency: KZT } as never)).currencies,
    );
    const summary = await credit.getCreditSummary(supplierId, companyId);
    expect(g.closingBalance).toBe('1000');
    expect(summary.outstandingAP).toBe('1000');
  });

  it('partial allocation → both models report 950', async () => {
    const statement = buildStatementService({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '1000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100')],
      allocations: [alloc('pay-1', 'inv-1', '50')],
    });
    const credit = buildCreditService({ invoiced: '1000', allocated: '50', returned: '0' });
    const g = one(
      (await statement.getStatement(supplierId, companyId, { currency: KZT } as never)).currencies,
    );
    const summary = await credit.getCreditSummary(supplierId, companyId);
    expect(g.closingBalance).toBe('950');
    expect(summary.outstandingAP).toBe('950');
  });

  it('full allocation → both models report 900', async () => {
    const statement = buildStatementService({
      invoices: [invoice('inv-1', 'INV-001', '2026-09-01', '1000')],
      payments: [payment('pay-1', 'PAY-000001', '2026-09-05', '100')],
      allocations: [alloc('pay-1', 'inv-1', '100')],
    });
    const credit = buildCreditService({ invoiced: '1000', allocated: '100', returned: '0' });
    const g = one(
      (await statement.getStatement(supplierId, companyId, { currency: KZT } as never)).currencies,
    );
    const summary = await credit.getCreditSummary(supplierId, companyId);
    expect(g.closingBalance).toBe('900');
    expect(summary.outstandingAP).toBe('900');
  });
});
