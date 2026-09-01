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
 * StockFlow — POS full sale E2E (F9-2).
 *
 * Tests the core business flow: login → verify shift → add product ×2 →
 * pay → complete sale → verify stock decreased by 2.
 */
const PASSWORD = 'E2eStrong123!';
const FULL_NAME = 'E2E POS Tester';
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
    email: `e2e.pos.${unique}@stockflow.test`,
    companyName: `POS E2E ${unique}`,
  };
  const apiBase = await resolveApiBase(request);

  // Register company.
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

  // Login via API to get token for seeding.
  const loginRes = await request.post(`${apiBase}/auth/login`, {
    data: { email: identity.email, password: PASSWORD },
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  const token = loginBody?.accessToken;
  if (!token) throw new Error(`beforeAll login failed: ${loginRes.status()}`);
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Create warehouse.
  const whRes = await request.post(`${apiBase}/inventory/warehouses`, {
    headers: authHeaders,
    data: { name: 'POS E2E Warehouse', code: 'POS-E2E' },
  });
  if (whRes.status() !== 201 && whRes.status() !== 200) {
    throw new Error(`Warehouse creation failed: ${whRes.status()} ${await whRes.text()}`);
  }
  const whBody = await whRes.json().catch(() => ({}));
  const warehouseId = whBody?.id;
  if (!warehouseId) throw new Error(`No warehouse id: ${JSON.stringify(whBody).slice(0, 300)}`);

  // Create product.
  const prodRes = await request.post(`${apiBase}/products`, {
    headers: authHeaders,
    data: {
      name: 'E2E Widget',
      sku: `WIDGET-${unique}`,
      price: '1500.00',
      unit: 'pcs',
    },
  });
  if (prodRes.status() !== 201 && prodRes.status() !== 200) {
    throw new Error(`Product creation failed: ${prodRes.status()} ${await prodRes.text()}`);
  }
  const prodBody = await prodRes.json().catch(() => ({}));
  const productId = prodBody?.id;
  if (!productId) throw new Error(`No product id: ${JSON.stringify(prodBody).slice(0, 300)}`);

  // Seed stock: 10 units.
  const stockRes = await request.post(`${apiBase}/inventory/stock/adjust`, {
    headers: authHeaders,
    data: { productId, warehouseId, quantity: 10, reason: 'E2E test seed' },
  });
  if (stockRes.status() !== 200 && stockRes.status() !== 201) {
    throw new Error(`Stock adjust failed: ${stockRes.status()} ${await stockRes.text()}`);
  }

  // Open cash shift.
  const shiftRes = await request.post(`${apiBase}/sales/cash-shifts/open`, {
    headers: authHeaders,
    data: { warehouseId, openingBalance: 10000 },
  });
  if (shiftRes.status() !== 201 && shiftRes.status() !== 200) {
    throw new Error(`Shift open failed: ${shiftRes.status()} ${await shiftRes.text()}`);
  }

  (test as any)._posTestData = {
    warehouseId, productId, token, apiBase, authHeaders, originalStock: 10,
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

/** Click a product in the POS catalog by its visible name. */
async function clickCatalogProduct(page: Page, name: string): Promise<void> {
  const node = page.locator('flt-semantics').filter({ hasText: name });
  await expect(node.first()).toBeVisible({ timeout: 15_000 });
  const box = await node.first().boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box.width / 2, box!.y + box.height / 2);
  await page.waitForTimeout(1500);
}

test.describe('POS full sale (F9-2)', () => {
  test('1. complete sale: add product ×2 → pay → verify stock = 8', async ({ page }) => {
    const data = (test as any)._posTestData;
    const { warehouseId, productId, apiBase, authHeaders, originalStock } = data;
    const SOLD_QTY = 2;

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

    // ── Step 4: Search for product ───────────────────────────────
    await page.keyboard.press('F2');
    await page.waitForTimeout(500);
    await page.keyboard.type('E2E Widget', { delay: 25 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // ── Step 5: Add product to cart (×2 clicks = qty 2) ──────────
    // Click 1: adds product with qty=1.
    await clickCatalogProduct(page, 'E2E Widget');
    await expectText(page, /Cart \(1 items?\)/);

    // After adding, POS clears the search field. Re-search for the same
    // product so it appears in the catalog again.
    await page.keyboard.press('F2');
    await page.waitForTimeout(500);
    await page.keyboard.type('E2E Widget', { delay: 25 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Click 2: addItem() increments existing qty from 1 → 2.
    await clickCatalogProduct(page, 'E2E Widget');
    await expectText(page, /Cart \(2 items?\)/);

    // ── Step 6: Enter payment ────────────────────────────────────
    // Total = 2 × 1500 = 3000. Pay 5000 cash.
    await page.keyboard.press('F8');
    await page.waitForTimeout(500);
    const cashInput = page.locator('input[aria-label="Cash"]');
    if ((await cashInput.count()) > 0) {
      await cashInput.click({ force: true });
      await page.waitForTimeout(300);
      await page.keyboard.type('5000', { delay: 25 });
    } else {
      await page.keyboard.type('5000', { delay: 25 });
    }
    await page.waitForTimeout(500);

    // ── Step 7: Complete sale ────────────────────────────────────
    await page.keyboard.press('F9');
    await page.waitForTimeout(5000);

    // ── Step 8: Verify success ───────────────────────────────────
    await expectText(page, 'Sale completed');
    await clickButton(page, 'New sale');
    await page.waitForTimeout(1000);

    // ── Step 9: Verify via API ───────────────────────────────────
    const salesRes = await page.context().request.get(`${apiBase}/sales?page=1&limit=1`, {
      headers: authHeaders,
    });
    expect(salesRes.status()).toBe(200);
    const salesBody = await salesRes.json().catch(() => ({}));
    const sales = salesBody?.items ?? [];
    expect(sales.length).toBeGreaterThan(0);

    const latestSale = sales[0];
    expect(latestSale.status).toBe('COMPLETED');
    expect(latestSale.items).toHaveLength(1);
    expect(latestSale.items[0].productId).toBe(productId);
    expect(Number(latestSale.items[0].quantity)).toBe(SOLD_QTY);

    // ── Step 10: Verify stock decreased by SOLD_QTY ──────────────
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
    // FAIL if stock record not found — never silently pass.
    expect(stockEntry, `Stock entry not found for product ${productId}`).not.toBeNull();
    expect(Number(stockEntry!.quantity)).toBe(originalStock - SOLD_QTY);
  });
});
