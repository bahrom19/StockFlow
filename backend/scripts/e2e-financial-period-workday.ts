/**
 * E2E: full shop workday WITHOUT manually creating a FinancialPeriod.
 *
 * Proves that company registration auto-creates the first OPEN financial
 * period, so the following chain works end-to-end:
 *
 *   register → warehouse → product → supplier → purchase order →
 *   goods receipt → open cash shift → sale → complete sale
 *
 * Expected:
 *   - sale complete = 200
 *   - journal entries created
 *   - trial balance = 200
 *   - dashboard = 200
 *
 * Usage (requires a running backend, default http://localhost:3000/api):
 *   cd backend && npm run e2e:financial-period-workday
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000/api';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${detail ? ` | ${detail}` : ''}`);
  if (!ok) failures += 1;
}

interface ReqResult {
  status: number;
  body: any;
}

async function req(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string,
): Promise<ReqResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

async function main(): Promise<void> {
  const ts = Date.now();
  const email = `fp_e2e_${ts}@test.local`;
  const pw = 'QaTest!2026x';

  // 1. Register — must auto-create the OPEN financial period
  let r = await req('POST', '/auth/register', {
    companyName: `FpE2E${ts}`,
    email,
    password: pw,
    firstName: 'E2E',
    lastName: 'Flow',
    phone: `+99890${ts % 100000000}`,
  });
  check('1. register', r.status === 201, String(r.status));
  const token = r.body?.accessToken ?? '';
  const companyId = r.body?.user?.companyId ?? '';
  check('   token + companyId', Boolean(token && companyId), companyId);

  // Verify the period exists in the DB (proves auto-creation, no manual step)
  const now = new Date();
  const period = await prisma.financialPeriod.findFirst({
    where: { companyId, year: now.getFullYear(), month: now.getMonth() + 1 },
  });
  check('2. OPEN financial period auto-created', Boolean(period && period.status === 'OPEN'),
    period ? `${period.name} ${period.status}` : 'NOT FOUND');

  // 3. Warehouse
  r = await req('POST', '/inventory/warehouses', { name: `WH${ts}`, code: `W${ts % 100000}` }, token);
  check('3. warehouse', r.status === 201, String(r.status));
  const warehouseId = r.body?.id ?? '';

  // 4. Product
  r = await req('POST', '/products', {
    name: `Coffee ${ts}`, sku: `SKU-${ts}`, unit: 'kg', price: 25, costPrice: 15, stockQuantity: 50,
  }, token);
  check('4. product', r.status === 201, String(r.status));
  const productId = r.body?.id ?? '';

  // 5. Supplier
  r = await req('POST', '/suppliers', {
    companyName: `CoffeeCo${ts}`, email: `sup${ts}@t.local`, phone: `+99891${ts % 100000000}`, bin: `BIN${ts}`,
  }, token);
  check('5. supplier', r.status === 201, String(r.status));
  const supplierId = r.body?.id ?? '';

  // 6. Purchase Order
  r = await req('POST', '/purchasing/purchase-orders', {
    supplierId,
    items: [{ productId, quantity: 30, unitCost: 15 }],
  }, token);
  check('6. purchase order', r.status === 201, String(r.status));
  const poId = r.body?.id ?? '';
  const poItemId = r.body?.items?.[0]?.id ?? '';

  // 7. Approve PO through the full chain DRAFT → PENDING → APPROVED → ORDERED
  r = await req('PATCH', `/purchasing/purchase-orders/${poId}/status`, { status: 'PENDING' }, token);
  r = await req('PATCH', `/purchasing/purchase-orders/${poId}/status`, { status: 'APPROVED' }, token);
  r = await req('PATCH', `/purchasing/purchase-orders/${poId}/status`, { status: 'ORDERED' }, token);
  check('7. approve PO (ORDERED)', r.status === 200, `${r.status} ${JSON.stringify(r.body ?? {}).slice(0, 100)}`);

  // 8. Goods Receipt (needs purchaseOrderItemId + unitCost)
  r = await req('POST', '/purchasing/goods-receipts', {
    purchaseOrderId: poId,
    warehouseId,
    items: [{ productId, quantity: 30, purchaseOrderItemId: poItemId, unitCost: 15 }],
  }, token);
  check('8. goods receipt', r.status === 201, `${r.status} ${JSON.stringify(r.body ?? {}).slice(0, 120)}`);

  // 9. Stock = 80 (endpoint returns an array of per-warehouse rows — sum them)
  const sumQty = (rows: any): number =>
    Array.isArray(rows)
      ? (rows as any[]).reduce((acc, r) => acc + (r.quantity ?? 0), 0)
      : (rows?.quantity ?? 0);
  r = await req('GET', `/inventory/stock/${productId}`, undefined, token);
  check('9. stock=80', r.status === 200 && sumQty(r.body) === 80, `qty=${sumQty(r.body)}`);

  // 10. Open cash shift
  r = await req('POST', '/sales/cash-shifts/open', { warehouseId, openingBalance: 100 }, token);
  check('10. open shift', r.status === 201, String(r.status));

  // 11. Sale
  r = await req('POST', '/sales', {
    warehouseId,
    items: [{ productId, quantity: 5, unitPrice: 25 }],
    payments: [{ method: 'CASH', amount: 125 }],
  }, token);
  check('11. sale', r.status === 201, String(r.status));
  const saleId = r.body?.id ?? '';

  // 12. Complete sale — the BLOCKER: must be 200 without manual period creation
  r = await req('POST', `/sales/${saleId}/complete`, {}, token);
  check('12. complete sale = 200', r.status === 200,
    `${r.status} ${JSON.stringify(r.body ?? {}).slice(0, 140)}`);

  // 13. Journal entries were created for the sale
  const journalCount = await prisma.journalEntry.count({
    where: { companyId, financialPeriodId: period?.id },
  });
  check('13. journal entries created', journalCount > 0, `count=${journalCount}`);

  // 14. Stock = 75 after sale
  r = await req('GET', `/inventory/stock/${productId}`, undefined, token);
  check('14. stock=75', r.status === 200 && sumQty(r.body) === 75, `qty=${sumQty(r.body)}`);

  // 15. Trial balance
  r = await req('GET', '/finance/ledger/trial-balance', undefined, token);
  check('15. trial balance = 200', r.status === 200, String(r.status));

  // 16. Dashboard
  r = await req('GET', '/reports/dashboard', undefined, token);
  check('16. dashboard = 200', r.status === 200, String(r.status));

  // 17. Reports
  r = await req('GET', '/reports/sales?page=1&limit=10', undefined, token);
  check('17. reports/sales = 200', r.status === 200, String(r.status));

  console.log(`\n===== E2E FINANCIAL PERIOD WORKDAY: ${failures === 0 ? 'ALL PASSED' : `${failures} FAILURES`} =====`);
  await prisma.$disconnect();
  if (failures > 0) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
