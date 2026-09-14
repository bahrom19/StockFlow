import { SupplierExposureRepository } from '../repositories/supplier-exposure.repository';

/**
 * Unit tests for the G9-D3 open-PO exposure read model.
 *
 * The repository is a thin raw-SQL reader (same pattern as the AP aging and
 * overdue-invoice read models). These tests verify the observable contract:
 *  - row mapping (SupplierExposureCurrencyRow shape);
 *  - parameterization (companyId/supplierId passed as query parameters);
 *  - SQL construction contract: canonical uninvoiced-remainder formula with
 *    GREATEST(...,0) floor, PO status filter, invoice status filter, tenant
 *    boundaries visible directly in the query structure.
 *
 * The SQL string contract tests document the required PostgreSQL semantics —
 * they do not execute against a real database (no live-PostgreSQL test
 * infrastructure exists in this module's test architecture).
 */
describe('SupplierExposureRepository — open-PO exposure (G9-D3)', () => {
  const companyId = 'company-1';
  const supplierId = 'supplier-1';
  let repo: SupplierExposureRepository;
  let mockPrisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    mockPrisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    repo = new SupplierExposureRepository(mockPrisma as any);
  });

  const getLastSql = (): string => {
    const arg = mockPrisma.$queryRaw.mock.calls.at(-1)?.[0];
    expect(arg).toBeDefined();
    return (arg as unknown[]).join('${param}');
  };

  const runWith = (rows: unknown[]) => {
    mockPrisma.$queryRaw.mockResolvedValueOnce(rows);
    return repo.getOpenPoExposureAggregates(supplierId, companyId);
  };

  it('maps supplierId, currency, openPoCount and the two monetary aggregates', async () => {
    const result = await runWith([
      {
        supplierId,
        currency: 'KZT',
        openPoCount: 3,
        committedOpenPo: '1500000.0000',
        uninvoicedOpenPo: '800000.0000',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      supplierId,
      currency: 'KZT',
      openPoCount: 3,
      committedOpenPo: '1500000.0000',
      uninvoicedOpenPo: '800000.0000',
    });
  });

  it('passes supplierId and companyId as query parameters (no string concatenation)', async () => {
    await runWith([]);

    const [sqlArg, ...params] = mockPrisma.$queryRaw.mock.calls.at(-1)!;
    const joined = (sqlArg as unknown[]).join('${param}');
    expect(joined).toContain('${param}');
    // Invoice aggregation companyId (JOIN clause) + PO supplierId and
    // companyId (WHERE) → 3 parameters in textual order
    expect(params).toEqual([companyId, supplierId, companyId]);
  });

  it('computes committedOpenPo as plain SUM(grandTotal) — NOT reduced by invoices', () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();

    expect(sql).toContain('SUM(po."grandTotal")::text AS "committedOpenPo"');
  });

  it('computes uninvoicedOpenPo with the canonical remainder formula and GREATEST floor', () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();

    expect(sql).toContain('COALESCE(inv."invoicedTotal", 0)');
    expect(sql).toMatch(
      /GREATEST\(\s*po\."grandTotal" - COALESCE\(inv\."invoicedTotal", 0\),\s*0\s*\)/,
    );
  });

  it('aggregates invoices per PO with APPROVED/PAID statuses and deletedAt IS NULL', () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();

    expect(sql).toContain('FROM "PurchaseInvoice" pi');
    expect(sql).toMatch(/pi\."deletedAt" IS NULL/);
    expect(sql).toMatch(/pi\.status IN \('APPROVED', 'PAID'\)/);
    expect(sql).toContain('SUM(pi."grandTotal") AS "invoicedTotal"');
    expect(sql).toContain('GROUP BY pi."purchaseOrderId", pi."companyId"');
  });

  it('keeps the tenant boundary visible in the query structure (not UUID-inferred)', () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();

    // Invoice aggregation is itself companyId-scoped…
    expect(sql).toContain('pi."companyId" = ${param}');
    // …and the joined aggregation is re-bound to the PO's company.
    expect(sql).toContain('inv."companyId" = po."companyId"');
    expect(sql).toContain('po."companyId" = ${param}');
  });

  it('includes exactly APPROVED, ORDERED, PARTIALLY_RECEIVED, RECEIVED POs', () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();

    expect(sql).toContain(
      "po.status IN ('APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED')",
    );
    // The excluded statuses must not appear as included anywhere.
    expect(sql).not.toMatch(/status IN[^)]*'DRAFT'/);
    expect(sql).not.toMatch(/status IN[^)]*'PENDING'/);
  });

  it('excludes soft-deleted POs and groups by supplier + currency', () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();

    expect(sql).toMatch(/po\."deletedAt" IS NULL/);
    expect(sql).toContain('GROUP BY po."supplierId", po.currency');
  });

  it('does NOT use paidAmount from PurchaseOrder or PurchaseInvoice', () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();

    expect(sql).not.toContain('"paidAmount"');
  });

  it('does NOT read GoodsReceipt monetary values', () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();

    expect(sql).not.toContain('GoodsReceipt');
  });

  // ── Documented regression scenarios (SQL semantics + row passthrough) ──

  it('scenario 1: PO 1000, no invoice → COALESCE(inv,0)=0 → uninvoiced 1000000', async () => {
    const result = await runWith([
      {
        supplierId,
        currency: 'KZT',
        openPoCount: 1,
        committedOpenPo: '1000.0000',
        uninvoicedOpenPo: '1000.0000',
      },
    ]);
    expect(result[0]!.uninvoicedOpenPo).toBe('1000.0000');
    expect(result[0]!.committedOpenPo).toBe('1000.0000');
    // Semantics documented by the SQL contract: no matching row in the inv
    // aggregation → COALESCE(...,0) → full grandTotal is uninvoiced.
    expect(getLastSql()).toContain('COALESCE(inv."invoicedTotal", 0)');
  });

  it('scenario 2: PO 1000, APPROVED invoice 700 → committed 1000, uninvoiced 300', async () => {
    // committedOpenPo stays the full PO value; only uninvoicedOpenPo shrinks.
    const result = await runWith([
      {
        supplierId,
        currency: 'KZT',
        openPoCount: 1,
        committedOpenPo: '1000.0000',
        uninvoicedOpenPo: '300.0000',
      },
    ]);
    expect(result[0]!.committedOpenPo).toBe('1000.0000');
    expect(result[0]!.uninvoicedOpenPo).toBe('300.0000');
  });

  it('scenario 3: fully invoiced PO → uninvoiced 0 (GREATEST floor holds the invariant)', async () => {
    const result = await runWith([
      {
        supplierId,
        currency: 'KZT',
        openPoCount: 1,
        committedOpenPo: '1000.0000',
        uninvoicedOpenPo: '0.0000',
      },
    ]);
    expect(result[0]!.uninvoicedOpenPo).toBe('0.0000');
    expect(getLastSql()).toMatch(/GREATEST\(/);
  });

  it('scenario 4: legacy overrun data → floor at 0, never negative exposure', async () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();
    // Defence-in-depth floor for corrupt/legacy rows where the invoiced sum
    // exceeds the PO total (pre-G9-D2 data).
    expect(sql).toMatch(/GREATEST\(\s*po\."grandTotal" - COALESCE\(inv\."invoicedTotal", 0\),\s*0\s*\)/);
  });

  it('scenario 5: only active (deletedAt IS NULL) invoices count toward invoicedTotal', () => {
    void repo.getOpenPoExposureAggregates(supplierId, companyId);
    const sql = getLastSql();
    expect(sql).toMatch(/pi\."deletedAt" IS NULL/);
  });
});
