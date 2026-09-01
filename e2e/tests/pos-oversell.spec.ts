import { test, expect, Page, APIRequestContext } from '@playwright/test';
import {
  enableSemantics,
  reenableSemantics,
  typeInto,
  clickButton,
  expectText,
  waitForRoute,
} from '../helpers/flutter';

/**
 * StockFlow — POS oversell E2E (F9-3).
 *
 * Proves strict stock policy: selling more than available stock is rejected.
 *
 * Setup: stock = 1 unit.
 * UI flow: add product ×2 → pay → press F9.
 * Expected: sale completion fails, stock unchanged, no COMPLETED sale.
 */
const PASSWORD = 'E2eStrong123!';
const FULL_NAME = 'E2E Oversell Tester';
const API_FALLBACK = 'http://localhost:3000/api';

let identity: { email: string; companyName: string } | undefined;

async function resolveApiBase(request: APIRequestContext): Promise<string> {
  try {
    const res = await request.get('http://127.0.0.1:8081/assets/env/.env.prod');
    if (res.ok()) {
      const text = await res.text();
      const m = text.match(/API_BASE_URL=(.+)/);
      if (m) return m[1].trim();
    }
  } catch { /* fall through */ }
  return API_FALLBACK;
}

test.beforeAll(async ({ request }) => {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  identity = {
    email: `e2e.oversell.${unique}@stockflow.test`,
    companyName: `Oversell E2E ${unique}`,
  };
  const apiBase = await resolveApiBase(request);

  const reg = await request.post(`${apiBase}/auth/register`, {
    data: {
      email: identity.email,
      password: PASSWORD,
      companyName: identity.companyName,
      firstName: FULL_NAME,
    },
  });
  if (reg.status() !== 201 && reg.status() !== 409) {
    throw new Error(`beforeAll registration failed: ${reg.status()} ${await reg.text()}`);
  }

  const loginRes = await request.post(`${apiBase}/auth/login`, {
    data: { email: identity.email, password: PASSWORD },
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  const token = loginBody?.accessToken;
  if (!token) throw new Error(`beforeAll login failed: ${loginRes.status()}`);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const whRes = await request.post(`${apiBase}/inventory/warehouses`, {
    headers: authHeaders,
    data: { name: 'Oversell E2E Warehouse', code: 'OVER-E2E' },
  });
  if (whRes.status() !== 201 && whRes.status() !== 200) {
    throw new Error(`Warehouse creation failed: ${whRes.status()} ${await whRes.text()}`);
  }
  const whBody = await whRes.json().catch(() => ({}));
  const warehouseId = whBody?.id;
  if (!warehouseId) throw new Error(`No warehouse id: ${JSON.stringify(whBody).slice(0, 300)}`);

  const prodRes = await request.post(`${apiBase}/products`, {
    headers: authHeaders,
    data: {
      name: 'E2E Oversell Widget',
      sku: `OVERWIDGET-${unique}`,
      price: '2000.00',
      unit: 'pcs',
    },
  });
  if (prodRes.status() !== 201 && prodRes.status() !== 200) {
    throw new Error(`Product creation failed: ${prodRes.status()} ${await prodRes.text()}`);
  }
  const prodBody = await prodRes.json().catch(() => ({}));
  const productId = prodBody?.id;
  if (!productId) throw new Error(`No product id: ${JSON.stringify(prodBody).slice(0, 300)}`);

  const stockRes = await request.post(`${apiBase}/inventory/stock/adjust`, {
    headers: authHeaders,
    data: { productId, warehouseId, quantity: 1, reason: 'E2E oversell test seed' },
  });
  if (stockRes.status() !== 200 && stockRes.status() !== 201) {
    throw new Error(`Stock adjust failed: ${stockRes.status()} ${await stockRes.text()}`);
  }

  const shiftRes = await request.post(`${apiBase}/sales/cash-shifts/open`, {
    headers: authHeaders,
    data: { warehouseId, openingBalance: 10000 },
  });
  if (shiftRes.status() !== 201 && shiftRes.status() !== 200) {
    throw new Error(`Shift open failed: ${shiftRes.status()} ${await shiftRes.text()}`);
  }

  (test as any)._oversellTestData = {
    warehouseId, productId, token, apiBase, authHeaders, originalStock: 1,
  };
});

test.beforeEach(async ({ page }) => {
  await enableSemantics(page);
});

async function login(page: Page): Promise<void> {
  await waitForRoute(page, '#/login');
  await typeInto(page, 'Email', identity!.email);
  await typeInto(page, 'Password', PASSWORD);
  await clickButton(page, 'Sign In');
  await waitForRoute(page, '#/dashboard');
}

async function clickCatalogProduct(page: Page, name: string): Promise<void> {
  const node = page.locator('flt-semantics').filter({ hasText: name });
  await expect(node.first()).toBeVisible({ timeout: 15_000 });
  const box = await node.first().boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box.width / 2, box!.y + box.height / 2);
  await page.waitForTimeout(1500);
}

async function searchProduct(page: Page, name: string): Promise<void> {
  await page.keyboard.press('F2');
  await page.waitForTimeout(500);
  await page.keyboard.type(name, { delay: 25 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
}

test.describe('POS oversell (F9-3)', () => {
  test('1. reject sale when qty > stock', async ({ page }) => {
    const data = (test as any)._oversellTestData;
    const { warehouseId, productId, apiBase, authHeaders, originalStock } = data;
    const PRODUCT_NAME = 'E2E Oversell Widget';

    // ── Step 1: Login via UI ─────────────────────────────────────
    await login(page);

    // ── Step 2: Navigate to POS ──────────────────────────────────
    await page.goto('/#/sales/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await reenableSemantics(page);
    await page.waitForTimeout(2000);

    await expectText(page, 'Cashier Terminal');

    // ── Step 3: Verify shift is open ─────────────────────────────
    await expectText(page, 'X Report');

    // ── Step 4: Search and add product (qty=1) ───────────────────
    await searchProduct(page, PRODUCT_NAME);
    await clickCatalogProduct(page, PRODUCT_NAME);
    await expectText(page, /Cart \(1 items?\)/);

    // ── Step 5: Re-search and add again (qty=2) ─────────────────
    await searchProduct(page, PRODUCT_NAME);
    await clickCatalogProduct(page, PRODUCT_NAME);
    await expectText(page, /Cart \(2 items?\)/);

    // ── Step 6: Enter payment ────────────────────────────────────
    // Total = 2 × 2000 = 4000. Pay 5000 cash.
    // F8 focuses the Cash input field.
    await page.keyboard.press('F8');
    await page.waitForTimeout(800);
    // Find the Cash input and type directly.
    const cashInput = page.locator('input[aria-label="Cash"]');
    await cashInput.click({ force: true });
    await page.waitForTimeout(300);
    await page.keyboard.type('5000', { delay: 25 });
    await page.waitForTimeout(500);

    // ── Step 7: Attempt to complete sale ──────────────────────────
    // Record sales count BEFORE pressing F9.
    const preSalesRes = await page.context().request.get(
      `${apiBase}/sales?page=1&limit=5`,
      { headers: authHeaders },
    );
    const preSalesBody = await preSalesRes.json().catch(() => ({}));
    const preSalesCount = (preSalesBody?.items ?? []).length;

    await page.keyboard.press('F9');
    await page.waitForTimeout(8000);

    // ── Step 8: Verify via API — no new COMPLETED sale ───────────
    const postSalesRes = await page.context().request.get(
      `${apiBase}/sales?page=1&limit=10`,
      { headers: authHeaders },
    );
    expect(postSalesRes.status()).toBe(200);
    const postSalesBody = await postSalesRes.json().catch(() => ({}));
    const allSales = postSalesBody?.items ?? [];
    const completedSales = allSales.filter((s: any) => s.status === 'COMPLETED');
    expect(
      completedSales.length,
      `Expected 0 COMPLETED sales but found ${completedSales.length}: ${JSON.stringify(completedSales.map((s: any) => ({ id: s.id, status: s.status, items: s.items?.map((i: any) => ({ qty: i.quantity, productId: i.productId })) })))}`,
    ).toBe(0);

    // ── Step 9: Verify via API — stock unchanged ─────────────────
    const stockRes = await page.context().request.get(
      `${apiBase}/inventory/stock?warehouseId=${warehouseId}`,
      { headers: authHeaders },
    );
    expect(stockRes.status()).toBe(200);
    const stockBody = await stockRes.json().catch(() => ({}));
    const stockItems = stockBody?.items ?? stockBody ?? [];
    const stockEntry = Array.isArray(stockItems)
      ? stockItems.find((s: any) => s.productId === productId)
      : null;
    expect(
      stockEntry,
      `Stock entry not found for product ${productId}`,
    ).not.toBeNull();
    expect(
      Number(stockEntry!.quantity),
      `Stock should remain ${originalStock} but was ${stockEntry!.quantity}`,
    ).toBe(originalStock);

    // ── Step 10: Verify UI — cart preserved (hard assertion) ────
    // On a failed completion the POS does NOT clear the cart.
    // This is a hard, non-flaky assertion — the cart header text
    // persists until the user explicitly clears or completes a sale.
    await expectText(page, /Cart \(2 items?\)/);

    // Bonus: receipt dialog must NOT appear.
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasReceipt = bodyText.includes('Sale completed');
    expect(
      hasReceipt,
      'Receipt dialog ("Sale completed") should NOT appear after oversell rejection',
    ).toBe(false);

    // Bonus: error snackbar may have appeared (transient, not mandatory).
    const hasError = /insufficient stock|failed to complete sale/i.test(bodyText);
    if (hasError) {
      console.log('✓ Error snackbar detected: insufficient stock / failed to complete');
    } else {
      console.log('ℹ Error snackbar already dismissed (transient — cart assertion is the gate)');
    }
  });
});
