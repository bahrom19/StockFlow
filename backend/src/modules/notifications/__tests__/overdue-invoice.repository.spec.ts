import { OverdueInvoiceRepository } from '../repositories/overdue-invoice.repository';

/**
 * Unit tests for the company-wide overdue purchase-invoice read model.
 *
 * The repository is a thin raw-SQL reader (same pattern as the analytics
 * service). These tests verify the observable contract:
 *  - parameterization (companyId, startOfToday passed as query parameters);
 *  - row mapping (OverdueInvoiceRow shape);
 *  - SQL construction contract: canonical G9-B1 allocation-based outstanding
 *    (NOT paidAmount), overdue boundary daysOverdue >= 1, undated exclusion.
 *
 * The SQL string contract tests document the required PostgreSQL semantics —
 * they do not execute against a real database (no live-PostgreSQL test
 * infrastructure exists in this module's test architecture).
 */
describe('OverdueInvoiceRepository — canonical allocation source & overdue boundary (G9-B2.2)', () => {
  const companyId = 'company-1';
  const startOfToday = new Date('2026-09-13T00:00:00.000Z');
  let repo: OverdueInvoiceRepository;
  let mockPrisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    mockPrisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    repo = new OverdueInvoiceRepository(mockPrisma as any);
  });

  const getLastSql = (): string => {
    const arg = mockPrisma.$queryRaw.mock.calls.at(-1)?.[0];
    expect(arg).toBeDefined();
    // Tagged template: raw chunks + ${} parameter slots
    return arg.join('${param}');
  };

  const runWith = (rows: unknown[]) => {
    mockPrisma.$queryRaw.mockResolvedValueOnce(rows);
    return repo.findOverdueInvoices(companyId, startOfToday);
  };

  it('maps invoiceId, supplierName, outstanding and daysOverdue from query rows', async () => {
    const result = await runWith([
      {
        invoiceId: 'inv-1',
        companyId,
        invoiceNumber: 'INV-001',
        supplierId: 'sup-1',
        supplierName: 'Supplier One',
        dueDate: new Date('2026-09-11T00:00:00.000Z'),
        currency: 'KZT',
        outstanding: '40000.0000',
        daysOverdue: 2,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      invoiceId: 'inv-1',
      supplierName: 'Supplier One',
      outstanding: '40000.0000',
      daysOverdue: 2,
    });
  });

  it('passes companyId and startOfToday as query parameters', async () => {
    await runWith([]);

    const [sqlArg, ...params] = mockPrisma.$queryRaw.mock.calls.at(-1)!;
    const joined = (sqlArg as unknown[]).join('${param}');
    expect(joined).toContain('"companyId" = ${param}');
    // startOfToday interpolates twice (daysOverdue projection + overdue
    // boundary predicate), companyId once in WHERE → 3 parameters total
    expect(params).toEqual([startOfToday, companyId, startOfToday]);
  });

  it('aggregates SupplierPaymentAllocation with deletedAt IS NULL (canonical G9-B1 source)', () => {
    void repo.findOverdueInvoices(companyId, startOfToday);
    const sql = getLastSql();

    expect(sql).toContain('"SupplierPaymentAllocation"');
    expect(sql).toMatch(/WHERE\s+"deletedAt" IS NULL/);
    expect(sql).toContain('SUM(amount) AS "allocatedAmount"');
    expect(sql).toContain('COALESCE(spa."allocatedAmount", 0)');
  });

  it('does NOT use paidAmount as the canonical outstanding source', () => {
    void repo.findOverdueInvoices(companyId, startOfToday);
    const sql = getLastSql();

    expect(sql).not.toContain('"paidAmount"');
  });

  it('computes outstanding as grandTotal minus allocated amounts', () => {
    void repo.findOverdueInvoices(companyId, startOfToday);
    const sql = getLastSql();

    expect(sql).toContain(
      '(pi."grandTotal" - COALESCE(spa."allocatedAmount", 0))::text AS "outstanding"',
    );
    expect(sql).toContain(
      '(pi."grandTotal" - COALESCE(spa."allocatedAmount", 0)) > 0',
    );
  });

  it('excludes undated invoices and keeps APPROVED/PAID + soft-delete filters', () => {
    void repo.findOverdueInvoices(companyId, startOfToday);
    const sql = getLastSql();

    expect(sql).toContain('pi."dueDate" IS NOT NULL');
    expect(sql).toMatch(/pi\."status" IN \('APPROVED', 'PAID'\)/);
    expect(sql).toMatch(/pi\."deletedAt" IS NULL/);
  });

  it('applies overdue boundary daysOverdue >= 1 (aging semantics)', () => {
    void repo.findOverdueInvoices(companyId, startOfToday);
    const sql = getLastSql();

    // Boundary predicate mirrors SupplierAnalyticsService daysOverdue > 0
    expect(sql).toMatch(
      /FLOOR\(\s*EXTRACT\(EPOCH FROM \(\$\{param\}::timestamp - pi\."dueDate"\)\) \/ 86400\s*\)::int >= 1/,
    );
    // daysOverdue projection itself is preserved
    expect(sql).toContain('AS "daysOverdue"');
  });

  it('keeps existing result ordering by dueDate ASC', () => {
    void repo.findOverdueInvoices(companyId, startOfToday);
    const sql = getLastSql();

    expect(sql).toContain('ORDER BY pi."dueDate" ASC');
  });

  // ── Documented regression scenarios (SQL semantics) ─────────────────────

  it('scenario A: paidAmount drift high (paid 100k, allocated 60k) → outstanding 40000, candidate', async () => {
    // legacy paidAmount overstates coverage; allocation is canonical
    const rows = [
      { invoiceId: 'inv-A', outstanding: '40000.0000', daysOverdue: 3 },
    ];
    const result = await runWith(rows);
    expect(result[0]!.outstanding).toBe('40000.0000');
  });

  it('scenario B: allocated 100k (paidAmount 60k drift) → outstanding 0, NOT a candidate', () => {
    // Query pre-filters outstanding > 0; allocation covers the invoice fully,
    // so the DB would not return a row even though paidAmount < grandTotal.
    void repo.findOverdueInvoices(companyId, startOfToday);
    const sql = getLastSql();
    expect(sql).toContain('(pi."grandTotal" - COALESCE(spa."allocatedAmount", 0)) > 0');
    expect(sql).not.toContain('"paidAmount"');
  });

  it('scenario C: unallocated payment (paidAmount only) → allocation sum 0 → outstanding = grandTotal, candidate', async () => {
    // Payment exists with no allocation → COALESCE(...,0) → grandTotal outstanding
    const result = await runWith([
      { invoiceId: 'inv-C', outstanding: '100000.0000', daysOverdue: 5 },
    ]);
    expect(result[0]!.outstanding).toBe('100000.0000');
    const sql = getLastSql();
    expect(sql).toContain('COALESCE(spa."allocatedAmount", 0)');
  });

  it('scenario E/F/G: overdue boundary — today excluded, ≥1 full day included, time-bearing 0-day excluded', () => {
    void repo.findOverdueInvoices(companyId, startOfToday);
    const sql = getLastSql();

    // E: dueDate today → floor(diff) = 0 → filtered out by >= 1
    // F: dueDate yesterday 00:00 → floor(diff) = 1 → included
    // G: dueDate yesterday 22:00 → floor(2h) = 0 → excluded (aging-consistent)
    expect(sql).toContain('::int >= 1');
    expect(sql).toContain('pi."dueDate" IS NOT NULL');
  });
});
