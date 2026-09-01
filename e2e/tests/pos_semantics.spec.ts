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
 * StockFlow — POS workspace text semantics regression guard.
 *
 * Discovered + fixed in `2195ddc`: non-interactive POS text (toolbar,
 * catalog footer, cart header, totals, payment summary) was being hoisted
 * by Flutter Web into the workspace `role="group"` aria-label, making it
 * invisible to `document.body.innerText`. The fix wraps each text block in
 * a label-less `Semantics(container: true)` boundary; every CTA stays a
 * separate sibling node.
 *
 * This test locks the browser-level contract:
 *   - POS texts are discoverable via document.body.innerText;
 *   - CTAs remain independently clickable, proven by actual OUTCOME
 *     (dialog opens) rather than role selectors alone;
 *   - no repeated X-report polling while no shift is open.
 *
 * State: a deterministic company is registered via the API in beforeAll
 * (identity lifecycle identical to auth.spec.ts), then a warehouse and 35
 * products are seeded through the API with the login token. No shift is
 * opened, so the Cash Drawer bootstrap 404 is expected and the workspace
 * must NOT poll X-report.
 */
const PASSWORD = 'E2eStrong123!';
const API_FALLBACK = 'http://localhost:3000/api';

/** Identity registered + seeded in beforeAll; login-dependent tests share it. */
let identity: { email: string; companyName: string } | undefined;

/** X-report request URLs observed during the current test. */
const xReportRequests: string[] = [];

/**
 * Resolve the API base URL by reading the bundled .env.prod asset.
 * Works for both production (Railway) and local (localhost) builds.
 */
async function resolveApiBase(request: APIRequestContext): Promise<string> {
  try {
    const res = await request.get('http://127.0.0.1:8081/assets/env/.env.prod');
    if (res.ok()) {
      const text = await res.text();
      const m = text.match(/API_BASE_URL=(.+)/);
      if (m) return m[1].trim();
    }
  } catch {
    /* fall through to fallback */
  }
  return API_FALLBACK;
}

test.beforeAll(async ({ request }) => {
  const unique = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  identity = {
    email: `e2e.pos.${unique}@stockflow.test`,
    companyName: `POS Corp ${unique}`,
  };
  const apiBase = await resolveApiBase(request);

  // 1. Register the company (201 or harmless 409).
  const reg = await request.post(`${apiBase}/auth/register`, {
    data: {
      email: identity.email,
      password: PASSWORD,
      companyName: identity.companyName,
      firstName: 'POS E2E',
    },
  });
  if (reg.status() !== 201 && reg.status() !== 409) {
    throw new Error(
      `registration failed: ${reg.status()} ${await reg.text()}`,
    );
  }

  // 2. Login via API → bearer token for seeding.
  const login = await request.post(`${apiBase}/auth/login`, {
    data: { email: identity.email, password: PASSWORD },
  });
  const loginBody = await login.json().catch(() => ({}));
  const accessToken = loginBody?.accessToken as string | undefined;
  if (!accessToken) {
    throw new Error(
      `login failed: ${login.status()} ${JSON.stringify(loginBody).slice(0, 300)}`,
    );
  }
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
  };

  // 3. Warehouse + 35 products (limit 30 → Load more must appear).
  const wh = await request.post(`${apiBase}/inventory/warehouses`, {
    headers: authHeaders,
    data: { name: 'Main Store', code: 'MS' },
  });
  if (wh.status() >= 400) {
    throw new Error(`warehouse seed failed: ${wh.status()} ${await wh.text()}`);
  }

  let seeded = 0;
  for (let i = 0; i < 35; i++) {
    // Small delay to avoid hitting the global rate limiter (10 req/s).
    if (i > 0) await new Promise((r) => setTimeout(r, 150));
    const r = await request.post(`${apiBase}/products`, {
      headers: authHeaders,
      data: {
        name: `POSGuard Product ${i + 1}`,
        sku: `POSG${i + 1}`,
        price: '100.00',
        unit: 'pcs',
      },
    });
    if (r.status() === 201 || r.status() === 200) seeded++;
  }
  if (seeded < 35) {
    throw new Error(`product seed incomplete: ${seeded}/35`);
  }
});

test.beforeEach(async ({ page }) => {
  xReportRequests.length = 0;
  page.on('request', (req) => {
    if (req.url().includes('/x-report')) xReportRequests.push(req.url());
  });
  await enableSemantics(page);
});

/** Log in with the beforeAll-registered identity. */
async function login(page: Page): Promise<void> {
  await waitForRoute(page, '#/login');
  await typeInto(page, 'Email', identity!.email);
  await typeInto(page, 'Password', PASSWORD);
  await clickButton(page, 'Sign In');
  await waitForRoute(page, '#/dashboard');
}

/** Close the currently open dialog via its Cancel button (if present). */
async function closeDialog(page: Page): Promise<void> {
  const cancel = page
    .locator('flt-semantics[role="button"]')
    .filter({ hasText: 'Cancel' });
  if ((await cancel.count()) > 0) {
    const box = await cancel.first().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(600);
    }
  }
}

test.describe('StockFlow POS workspace semantics', () => {
  test('POS texts stay in innerText and CTAs remain tappable', async ({
    page,
  }) => {
    await login(page);

    // Navigate to POS via hash (SPA — avoids a full reload that would
    // rebuild the semantics tree), then re-enable semantics if Flutter
    // re-showed the accessibility placeholder.
    await page.evaluate(() => {
      window.location.hash = '#/sales/new';
    });
    await page.waitForTimeout(3000);
    await reenableSemantics(page);
    await page.waitForTimeout(1500);

    // 1. POS workspace loads.
    await expectText(page, 'Cashier Terminal');

    // 2–3. Keyboard hints.
    for (const hint of ['F2 search', 'F8 payment', 'F9 complete']) {
      await expectText(page, hint);
    }

    // 4. Toolbar cart summary.
    await expectText(page, '0 items');

    // 5. Catalog navigation hints.
    for (const hint of ['Enter to add', '↑↓ to navigate']) {
      await expectText(page, hint);
    }

    // 6. Cart header (empty).
    await expectText(page, 'Cart (0 items)');

    // Catalog rendered the seeded product.
    await expectText(page, 'POSGuard Product 1');

    // 7. Open Shift CTA → real outcome: the shift dialog opens.
    await clickButton(page, 'Open Shift');
    await expectText(page, 'Open Cash Shift');
    await closeDialog(page);

    // Snapshot the X-report count AFTER the workspace is fully loaded —
    // bootstraps may have fired once; NO further polls are allowed.
    const xReportBaseline = xReportRequests.length;

    // 8. Add a product via a real pointer click on its catalog row.
    const productRow = page
      .locator('flt-semantics')
      .filter({ hasText: 'POSGuard Product 1' });
    await productRow.first().waitFor({ state: 'visible', timeout: 15_000 });
    const rowBox = await productRow.first().boundingBox();
    expect(rowBox).not.toBeNull();
    await page.mouse.click(
      rowBox!.x + rowBox!.width / 2,
      rowBox!.y + rowBox!.height / 2,
    );
    await page.waitForTimeout(1200);

    for (const text of [
      'Cart (1 items)',
      'Subtotal',
      'Tax',
      'Total',
      'Payment',
      'Paid',
      'F9 to complete',
    ]) {
      await expectText(page, text);
    }

    // 9. Clear CTA → real outcome: confirmation dialog opens.
    await clickButton(page, 'Clear');
    await expectText(page, 'Clear cart?');
    await closeDialog(page);

    // 10. Load more CTA present (35 seeded products > 30-page limit).
    const loadMore = page
      .locator('flt-semantics[role="button"]')
      .filter({ hasText: 'Load more' });
    await expect(loadMore.first()).toBeVisible({ timeout: 15_000 });

    // 11. No unexpected polling: wait past one 20s tick; the X-report count
    // must NOT grow while no shift is open.
    await page.waitForTimeout(21_000);
    expect(
      xReportRequests.length,
      `X-report was polled while no shift is open: ${xReportRequests.length} requests`,
    ).toBe(xReportBaseline);

    // 12. Responsive overflow sanity at 1024 and 768.
    for (const width of [1024, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(1200);
      await reenableSemantics(page);
      await page.waitForTimeout(800);
      const { sw, cw } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(sw, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
        cw + 1,
      );
    }
  });
});
