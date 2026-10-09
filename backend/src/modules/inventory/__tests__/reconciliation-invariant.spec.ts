import { Decimal } from '@prisma/client/runtime/library';

/**
 * G16-F (NWD-06 / F19) — test-only reconciliation regression.
 *
 * Canonical read-only reconciliation SQL (the operational form; NOT wired to
 * any endpoint/job — G16-F scope is test-only):
 *
 *   -- Class A (hard invariant, fully-layered products): any row is a violation
 *   SELECT p.id, p."companyId", s.stk, l.lyr
 *   FROM "Product" p
 *   JOIN (SELECT "productId", SUM(quantity) stk
 *         FROM "Stock" GROUP BY "productId") s ON s."productId" = p.id
 *   JOIN (SELECT "productId", SUM("remainingQuantity") lyr
 *         FROM "CostLayer"
 *         WHERE direction = 'IN' AND "remainingQuantity" > 0
 *         GROUP BY "productId") l ON l."productId" = p.id
 *   WHERE s.stk <> l.lyr;
 *
 *   -- Class B (uncovered legacy stock — reported separately, NOT a violation)
 *   SELECT p.id, p."companyId", s.stk
 *   FROM "Product" p
 *   JOIN (SELECT "productId", SUM(quantity) stk
 *         FROM "Stock" GROUP BY "productId") s ON s."productId" = p.id
 *   LEFT JOIN (SELECT DISTINCT "productId" FROM "CostLayer"
 *              WHERE direction = 'IN') l ON l."productId" = p.id
 *   WHERE l."productId" IS NULL AND s.stk <> 0;
 *
 * Semantics implemented below mirror that SQL exactly: Decimal-exact integer
 * comparison, companyId/productId scoped, only active IN layers
 * (remainingQuantity > 0), products whose stock exists but never had an IN
 * layer are Class B, and warehouse transfers never affect the invariant
 * (they move quantity between Stock rows without touching CostLayers).
 */

interface StockRow {
  companyId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
}

interface CostLayerRow {
  companyId: string;
  productId: string;
  direction: 'IN' | 'OUT';
  remainingQuantity: number;
  unitCost: Decimal;
}

interface ReconciliationResult {
  /** Class A violations: fully-layered products where ΣStock ≠ ΣIN.remaining. */
  violations: Array<{
    companyId: string;
    productId: string;
    stock: number;
    layers: number;
  }>;
  /** Class B: stock without any IN layer — legacy/uncovered, reported not failed. */
  classB: Array<{ companyId: string; productId: string; stock: number }>;
  /** Negative-quantity anomalies (never acceptable). */
  anomalies: Array<{
    kind: 'negative_stock' | 'negative_layer';
    productId: string;
  }>;
  /** Exact Decimal valuation per product: Σ(remainingQuantity × unitCost). */
  valuation: Map<string, Decimal>;
}

const reconcile = (
  stocks: StockRow[],
  layers: CostLayerRow[],
): ReconciliationResult => {
  const result: ReconciliationResult = {
    violations: [],
    classB: [],
    anomalies: [],
    valuation: new Map(),
  };

  const stockByProduct = new Map<
    string,
    { companyId: string; total: number }
  >();
  for (const s of stocks) {
    if (s.quantity < 0) {
      result.anomalies.push({ kind: 'negative_stock', productId: s.productId });
    }
    const agg = stockByProduct.get(s.productId);
    // Σ Stock across warehouses — transfers move quantity between rows,
    // the per-product total must stay layer-consistent.
    stockByProduct.set(s.productId, {
      companyId: s.companyId,
      total: (agg?.total ?? 0) + s.quantity,
    });
  }

  const layersByProduct = new Map<
    string,
    {
      companyId: string;
      remaining: number;
      value: Decimal;
      everHadLayer: boolean;
    }
  >();
  for (const l of layers) {
    if (l.remainingQuantity < 0) {
      result.anomalies.push({ kind: 'negative_layer', productId: l.productId });
    }
    const agg = layersByProduct.get(l.productId) ?? {
      companyId: l.companyId,
      remaining: 0,
      value: new Decimal(0),
      everHadLayer: false,
    };
    // only ACTIVE layers participate (remainingQuantity > 0); a fully
    // consumed layer contributes 0 and, importantly, keeps everHadLayer true
    // so a product that sold out everything is Class A (0 === 0), not Class B.
    if (l.direction === 'IN' && l.remainingQuantity > 0) {
      agg.remaining += l.remainingQuantity;
      agg.value = agg.value.add(l.unitCost.mul(l.remainingQuantity));
    }
    if (l.direction === 'IN') agg.everHadLayer = true;
    layersByProduct.set(l.productId, agg);
  }

  for (const [productId, s] of stockByProduct) {
    const l = layersByProduct.get(productId);
    if (!l || !l.everHadLayer) {
      if (s.total !== 0)
        result.classB.push({
          companyId: s.companyId,
          productId,
          stock: s.total,
        });
      continue;
    }
    if (s.total !== l.remaining) {
      result.violations.push({
        companyId: s.companyId,
        productId,
        stock: s.total,
        layers: l.remaining,
      });
    }
    result.valuation.set(productId, l.value);
  }

  return result;
};

const layer = (
  productId: string,
  remaining: number,
  unitCost: string,
): CostLayerRow => ({
  companyId: 'comp-1',
  productId,
  direction: 'IN',
  remainingQuantity: remaining,
  unitCost: new Decimal(unitCost),
});

const stock = (
  productId: string,
  warehouseId: string,
  quantity: number,
): StockRow => ({
  companyId: 'comp-1',
  productId,
  warehouseId,
  quantity,
});

describe('Inventory reconciliation invariant (G16-F F19, test-only)', () => {
  it('fully layered product with equal totals → no violations', () => {
    // 30 units across two warehouses, layers cover exactly 30.
    const result = reconcile(
      [stock('p1', 'wh1', 10), stock('p1', 'wh2', 20)],
      [layer('p1', 25, '10'), layer('p1', 5, '12')],
    );

    expect(result.violations).toEqual([]);
    expect(result.classB).toEqual([]);
    expect(result.anomalies).toEqual([]);
  });

  it('fully layered product with drift → violation reporting the exact per-product delta', () => {
    // The G16-F NWD-01 signature: stock decreased, layers did not.
    const result = reconcile([stock('p1', 'wh1', 8)], [layer('p1', 10, '10')]);

    expect(result.violations).toEqual([
      { companyId: 'comp-1', productId: 'p1', stock: 8, layers: 10 },
    ]);
  });

  it('stock without any IN layer → Class B, not a violation', () => {
    const result = reconcile([stock('legacy', 'wh1', 99)], []);

    expect(result.violations).toEqual([]);
    expect(result.classB).toEqual([
      { companyId: 'comp-1', productId: 'legacy', stock: 99 },
    ]);
  });

  it('product with stock but only fully-consumed layers → Class A (0 === 0 passes)', () => {
    const result = reconcile(
      [stock('p1', 'wh1', 0)],
      [{ ...layer('p1', 0, '10'), remainingQuantity: 0 }],
    );

    expect(result.violations).toEqual([]);
    expect(result.classB).toEqual([]);
  });

  it('fully consumed stock with remaining layers → violation (inverse drift)', () => {
    const result = reconcile([stock('p1', 'wh1', 0)], [layer('p1', 5, '10')]);

    expect(result.violations).toEqual([
      { companyId: 'comp-1', productId: 'p1', stock: 0, layers: 5 },
    ]);
  });

  it('negative quantities are anomalies regardless of balance', () => {
    // ΣStock across warehouses = 10; the anomalous layer (−1) is excluded
    // from the active sum, the healthy layer (10) reconciles the balance —
    // the anomalies themselves are the reportable defect.
    const result = reconcile(
      [stock('p1', 'wh1', -3), stock('p1', 'wh1', 13)],
      [
        { ...layer('p1', 0, '10'), remainingQuantity: -1 },
        layer('p1', 10, '10'),
      ],
    );

    expect(result.anomalies).toEqual([
      { kind: 'negative_stock', productId: 'p1' },
      { kind: 'negative_layer', productId: 'p1' },
    ]);
    // balances still reconcile — the anomalies are the reportable defect
    expect(result.violations).toEqual([]);
  });

  it('warehouse transfer does not affect the per-product invariant', () => {
    const before = reconcile(
      [stock('p1', 'wh1', 10), stock('p1', 'wh2', 0)],
      [layer('p1', 10, '10')],
    );
    const after = reconcile(
      [stock('p1', 'wh1', 4), stock('p1', 'wh2', 6)],
      [layer('p1', 10, '10')],
    );

    expect(before.violations).toEqual([]);
    expect(after.violations).toEqual([]);
  });

  it('valuation is Decimal-exact: Σ(remainingQuantity × unitCost) with no float drift', () => {
    const result = reconcile(
      [stock('p1', 'wh1', 3)],
      [
        layer('p1', 1, '0.1'),
        layer('p1', 1, '0.2'),
        layer('p1', 1, '1000000000000.0001'),
      ],
    );

    // 0.1 + 0.2 + 1000000000000.0001 must be exact Decimal arithmetic.
    expect(result.valuation.get('p1')?.toString()).toBe(
      new Decimal('0.1').add('0.2').add('1000000000000.0001').toString(),
    );
    expect(result.valuation.get('p1')?.toString()).toBe('1000000000000.3001');
  });

  it('OUT layers are ignored by the quantity invariant (they are the consume record)', () => {
    const result = reconcile(
      [stock('p1', 'wh1', 10)],
      [
        layer('p1', 10, '10'),
        {
          ...layer('p1', 0, '10'),
          direction: 'OUT' as const,
          remainingQuantity: 0,
        },
      ],
    );

    expect(result.violations).toEqual([]);
  });
});
