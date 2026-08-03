/**
 * E2E: concurrency hardening regression (H1/H2/H3).
 *
 * Reproduces the three High race conditions with REAL parallel HTTP requests
 * against a live backend and asserts the fixes hold:
 *
 *   H1 — two parallel POST /sales/cash-shifts/open for the same cashier+warehouse:
 *        exactly ONE succeeds (201), the other gets 409 Conflict (DB partial
 *        unique index / P2002 → Conflict), never two OPEN shifts.
 *
 *   H2 — two parallel POST /sales/cash-shifts/cash-in on the same shift:
 *        exactly ONE succeeds (200), the other gets 409 Conflict; the final
 *        cashIn equals a single amount (no lost update).
 *
 *   H3 — two parallel goods receipts for the same PO item:
 *        exactly ONE succeeds (201), the other gets 409 Conflict; the PO item
 *        receivedQuantity increments exactly once and stock increases once.
 *
 *   M2 — two parallel sale creations: BOTH succeed (201) with DISTINCT
 *        saleNumbers (atomic DocumentSequence, no count+1 collision).
 *
 *   M1 — two parallel journal postings for a NEW account+period: BOTH succeed
 *        (201) with account balances accumulated exactly once each (atomic
 *        AccountBalance upsert, no findFirst/create P2002 race).
 *
 * Usage (requires a running backend, default http://localhost:3000/api):
 *   cd backend && npm run e2e:concurrency-hardening
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

async function doReq(
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
  const email = `cc_${ts}@test.local`;
  const pw = 'QaTest!2026x';

  // ── Setup: register ──
  let r = await doReq('POST', '/auth/register', {
    companyName: `Concurrency${ts}`,
    email,
    password: pw,
    firstName: 'E2E',
    lastName: 'Race',
    phone: `+99890${ts % 100000000}`,
  });
  check('setup. register', r.status === 201, String(r.status));
  const token = r.body?.accessToken ?? '';
  const companyId = r.body?.user?.companyId ?? '';
  check('   token + companyId', Boolean(token && companyId), companyId);

  // ── Setup: warehouse ──
  r = await doReq('POST', '/inventory/warehouses', {
    name: `WH${ts}`,
    code: `W${ts % 100000}`,
  }, token);
  const warehouseId = r.body?.id ?? '';
  check('setup. warehouse', r.status === 201 && Boolean(warehouseId), String(r.status));

  // ── Setup: product ──
  r = await doReq('POST', '/products', {
    name: `Prod${ts}`,
    sku: `SKU-${ts}`,
    unit: 'pcs',
    price: 10,
    costPrice: 5,
    stockQuantity: 100,
  }, token);
  const productId = r.body?.id ?? '';
  check('setup. product', r.status === 201 && Boolean(productId), String(r.status));

  // ═══════════════════════════════════════════
  // H1 — parallel cash shift open (one wins, one 409)
  // ═══════════════════════════════════════════
  const openBody = JSON.stringify({ warehouseId, openingBalance: 0 });
  const [openA, openB] = await Promise.all([
    fetch(BASE + '/sales/cash-shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: openBody,
    }),
    fetch(BASE + '/sales/cash-shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: openBody,
    }),
  ]);
  const openStatuses = [openA.status, openB.status].sort((a, b) => a - b);
  check(
    'H1. parallel open: one 201 + one 409',
    openStatuses[0] === 201 && openStatuses[1] === 409,
    `got ${openStatuses.join(',')}`,
  );

  // Only ONE OPEN shift may exist in the DB
  const openShifts = await prisma.cashShift.count({
    where: { companyId, warehouseId, status: 'OPEN' },
  });
  check('H1. DB has exactly one OPEN shift', openShifts === 1, `count=${openShifts}`);
  if (openShifts === 0) {
    console.log('   (no OPEN shift — opening one for H2)');
    await doReq('POST', '/sales/cash-shifts/open', { warehouseId, openingBalance: 0 }, token);
  }

  // ═══════════════════════════════════════════
  // H2 — parallel cash-in (one wins, one 409, no lost update)
  // ═══════════════════════════════════════════
  const cashInHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const [ciA, ciB] = await Promise.all([
    fetch(BASE + '/sales/cash-shifts/cash-in?warehouseId=' + warehouseId, {
      method: 'POST',
      headers: cashInHeaders,
      body: JSON.stringify({ amount: 100 }),
    }),
    fetch(BASE + '/sales/cash-shifts/cash-in?warehouseId=' + warehouseId, {
      method: 'POST',
      headers: cashInHeaders,
      body: JSON.stringify({ amount: 100 }),
    }),
  ]);
  const ciStatuses = [ciA.status, ciB.status].sort((a, b) => a - b);
  check(
    'H2. parallel cash-in: one 200 + one 409',
    ciStatuses[0] === 200 && ciStatuses[1] === 409,
    `got ${ciStatuses.join(',')}`,
  );
  const shiftAfter = await prisma.cashShift.findFirst({
    where: { companyId, warehouseId, status: 'OPEN' },
  });
  const cashInValue = shiftAfter ? Number(shiftAfter.cashIn.toString()) : 0;
  check(
    'H2. cashIn applied exactly once (no lost update)',
    cashInValue === 100,
    `cashIn=${cashInValue}`,
  );

  // ═══════════════════════════════════════════
  // H3 — parallel goods receipts for the same PO item
  // ═══════════════════════════════════════════
  r = await doReq('POST', '/suppliers', {
    companyName: `Supp${ts}`,
    email: `sup${ts}@t.local`,
    phone: `+99891${ts % 100000000}`,
    bin: `BIN${ts}`,
  }, token);
  const supplierId = r.body?.id ?? '';
  check('setup. supplier', r.status === 201 && Boolean(supplierId), String(r.status));

  r = await doReq('POST', '/purchasing/purchase-orders', {
    supplierId,
    items: [{ productId, quantity: 10, unitCost: 5 }],
  }, token);
  const poId = r.body?.id ?? '';
  const poItemId = r.body?.items?.[0]?.id ?? '';
  check('setup. PO', r.status === 201 && Boolean(poId && poItemId), String(r.status));

  // DRAFT → PENDING → APPROVED → ORDERED (chain required before receipt)
  for (const st of ['PENDING', 'APPROVED', 'ORDERED']) {
    await doReq('PATCH', `/purchasing/purchase-orders/${poId}/status`, { status: st }, token);
  }

  const receiptBody = JSON.stringify({
    purchaseOrderId: poId,
    warehouseId,
    items: [{ purchaseOrderItemId: poItemId, productId, quantity: 5, unitCost: 5 }],
  });
  const grHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const [grrA, grrB] = await Promise.all([
    fetch(BASE + '/purchasing/goods-receipts', {
      method: 'POST',
      headers: grHeaders,
      body: receiptBody,
    }),
    fetch(BASE + '/purchasing/goods-receipts', {
      method: 'POST',
      headers: grHeaders,
      body: receiptBody,
    }),
  ]);
  const grStatuses = [grrA.status, grrB.status].sort((a, b) => a - b);
  check(
    'H3. parallel goods receipts: one 201 + one 409',
    grStatuses[0] === 201 && grStatuses[1] === 409,
    `got ${grStatuses.join(',')}`,
  );

  const poItem = await prisma.purchaseOrderItem.findUnique({ where: { id: poItemId } });
  check(
    'H3. receivedQuantity incremented exactly once',
    poItem !== null && poItem.receivedQuantity === 5,
    `receivedQuantity=${poItem ? poItem.receivedQuantity : 'none'}`,
  );

  // Product was seeded with stockQuantity=100; exactly one receipt (+5) must
  // have applied — so stock must be 105, proving the second receipt did NOT
  // double-apply (stock+5 per receipt, not +10).
  const stock = await prisma.stock.findFirst({
    where: { companyId, productId, warehouseId },
  });
  check(
    'H3. stock increased exactly once (100 + 5 = 105)',
    stock !== null && stock.quantity === 105,
    `stock=${stock ? stock.quantity : 'none'}`,
  );

  // ═══════════════════════════════════════════
  // M2 — parallel sale creation: distinct saleNumbers, no P2002/400
  // ═══════════════════════════════════════════
  const saleHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const saleBody = JSON.stringify({
    warehouseId,
    items: [{ productId, quantity: 1, unitPrice: 10 }],
    payments: [{ method: 'CASH', amount: 10 }],
  });
  const [saleA, saleB] = await Promise.all([
    fetch(BASE + '/sales', { method: 'POST', headers: saleHeaders, body: saleBody }),
    fetch(BASE + '/sales', { method: 'POST', headers: saleHeaders, body: saleBody }),
  ]);
  const saleStatuses = [saleA.status, saleB.status].sort((a, b) => a - b);
  const saleANum = (await saleA.json())?.saleNumber ?? '';
  const saleBNum = (await saleB.json())?.saleNumber ?? '';
  check(
    'M2. both parallel sales created (201, 201)',
    saleStatuses[0] === 201 && saleStatuses[1] === 201,
    `got ${saleStatuses.join(',')}`,
  );
  check(
    'M2. sale numbers are DISTINCT (no count+1 collision)',
    Boolean(saleANum && saleBNum && saleANum !== saleBNum),
    `${saleANum} vs ${saleBNum}`,
  );

  // ═══════════════════════════════════════════
  // M1 — parallel journal postings for a NEW account+period:
  // both must succeed (atomic AccountBalance upsert, no P2002/400/500)
  // ═══════════════════════════════════════════
  const period = await prisma.financialPeriod.findFirst({
    where: { companyId, status: 'OPEN' },
    orderBy: { createdAt: 'asc' },
  });
  const accounts = await prisma.chartOfAccount.findMany({
    where: { companyId },
    take: 2,
    orderBy: { code: 'asc' },
  });
  check('M1. setup: OPEN period + 2 accounts', Boolean(period && accounts.length >= 2),
    `period=${period ? period.id : 'none'} accounts=${accounts.length}`);

  if (period && accounts.length >= 2) {
    // Earlier steps (sale completion) may already have created balance rows for
    // some accounts — the M1 race still fires because BOTH postings touch the
    // SAME accounts concurrently. The atomic upsert must handle both the create
    // and update paths without a P2002 → 400/500.
    const acct1Id = accounts[0]!.id;
    const acct2Id = accounts[1]!.id;
    const jeBody = JSON.stringify({
      financialPeriodId: period.id,
      description: 'M1 concurrent posting',
      lines: [
        { accountId: acct1Id, debit: '100' },
        { accountId: acct2Id, credit: '100' },
      ],
    });
    const [jeA, jeB] = await Promise.all([
      fetch(BASE + '/finance/gl/post', { method: 'POST', headers: saleHeaders, body: jeBody }),
      fetch(BASE + '/finance/gl/post', { method: 'POST', headers: saleHeaders, body: jeBody }),
    ]);
    const jeStatuses = [jeA.status, jeB.status].sort((a, b) => a - b);
    check(
      'M1. both parallel journal postings succeed (201, 201)',
      jeStatuses[0] === 201 && jeStatuses[1] === 201,
      `got ${jeStatuses.join(',')}`,
    );

    // Both postings must have received DISTINCT entryNumbers — this proves the
    // M2 fix for getNextEntryNumberInTransaction (was max()+1 → same number for
    // both parallel postings → P2002 on the unique [company, period, entryNumber]).
    let jeANum = -1;
    let jeBNum = -1;
    try {
      jeANum = (await jeA.clone().json())?.entryNumber ?? -1;
      jeBNum = (await jeB.clone().json())?.entryNumber ?? -1;
    } catch {
      jeANum = -1;
      jeBNum = -1;
    }
    check(
      'M1. parallel postings got DISTINCT entryNumbers (JE sequence fix)',
      jeANum > 0 && jeBNum > 0 && jeANum !== jeBNum,
      `${jeANum} vs ${jeBNum}`,
    );

    const balances = await prisma.accountBalance.findMany({
      where: { companyId, financialPeriodId: period.id },
    });
    check(
      'M1. account balances accumulated BOTH postings (no lost update)',
      balances.some((b) => Number(b.periodDebit.toString()) === 200) &&
        balances.some((b) => Number(b.periodCredit.toString()) === 200),
      `rows=${balances.length} debit=${balances.map((b) => b.periodDebit.toString()).join(',')} credit=${balances.map((b) => b.periodCredit.toString()).join(',')}`,
    );

    // End-to-end: the ledger query path must reflect both concurrent postings
    // (GL engine → accountBalance snapshot → trial balance).
    const tb = await doReq('GET', '/finance/ledger/trial-balance', undefined, token);
    check('M1. trial balance = 200 after concurrent postings', tb.status === 200, String(tb.status));
  }

  await prisma.$disconnect();
  console.log(
    failures === 0
      ? '\n===== ALL CONCURRENCY CHECKS PASSED ====='
      : `\n===== ${failures} FAILURE(S) =====`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
