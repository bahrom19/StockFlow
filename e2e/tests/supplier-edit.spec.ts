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
 * StockFlow — Supplier Edit E2E regression guard (F-01 / F9-1).
 *
 * The F-01 bug: navigating to the supplier form with a supplierId loaded
 * an empty CREATE form instead of pre-populating with the existing supplier's
 * data (the route was passing `supplier: null`).
 *
 * This test proves the fix by:
 *   1. Creating a supplier via the API.
 *   2. Navigating directly to the edit form (#/suppliers/:id).
 *   3. Verifying the form is in EDIT mode and data is populated.
 *   4. Changing the name and saving.
 *   5. Verifying the update persisted via API.
 */
const PASSWORD = 'E2eStrong123!';
const FULL_NAME = 'E2E Supplier Tester';
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
    email: `e2e.supplier.${unique}@stockflow.test`,
    companyName: `Supplier E2E ${unique}`,
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

test.describe('Supplier Edit (F-01 regression)', () => {
  test('1. Edit form loads with data and saves updated name', async ({ page }) => {
    const apiBase = await resolveApiBase(page.context().request);

    // ── Step 1: Login via UI ─────────────────────────────────────
    await login(page);

    // ── Step 2: Create supplier via API ──────────────────────────
    // Small delay to avoid rate limiting from previous test's API calls.
    await page.waitForTimeout(2000);
    const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const originalName = `Acme Supplies ${unique}`;
    const renamedName = `Acme Renamed ${unique}`;

    const loginRes = await page.context().request.post(`${apiBase}/auth/login`, {
      data: { email: identity!.email, password: PASSWORD },
    });
    const loginBody = await loginRes.json().catch(() => ({}));
    const token = loginBody?.accessToken;
    if (!token) throw new Error(`API login failed: ${loginRes.status()}`);
    const authHeaders = { Authorization: `Bearer ${token}` };

    const createRes = await page.context().request.post(`${apiBase}/suppliers`, {
      headers: authHeaders,
      data: {
        companyName: originalName,
        bin: '12345',
        email: `acme.${unique}@example.com`,
        phone: '+77001234567',
      },
    });
    if (createRes.status() !== 201 && createRes.status() !== 200) {
      throw new Error(`Supplier creation failed: ${createRes.status()} ${await createRes.text()}`);
    }
    const createdBody = await createRes.json().catch(() => ({}));
    const supplierId = createdBody?.id;
    if (!supplierId) throw new Error(`No supplier id: ${JSON.stringify(createdBody).slice(0, 300)}`);

    // ── Step 3: Navigate directly to the edit form ───────────────
    // The F-01 bug was in the SupplierFormScreen when opened with a
    // supplierId — the form loaded empty. Use page.goto for reliable
    // routing (hash assignment via JS doesn't always fire popstate
    // that GoRouter listens to).
    await page.goto(`/#/suppliers/${supplierId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await reenableSemantics(page);
    await page.waitForTimeout(2000);

    // ── Step 4: Verify EDIT mode ─────────────────────────────────
    // ASSERT 1: Title says "Edit Supplier" (not "New Supplier").
    await expectText(page, 'Edit Supplier');
    await expectText(page, 'New Supplier', { visible: false });

    // ASSERT 2: Button says "Update" (not "Create").
    await expectText(page, 'Update');

    // ASSERT 3: The form fields are present.
    const nameInput = page.locator('input[aria-label="Company Name *"]');
    await nameInput.waitFor({ state: 'visible', timeout: 10_000 });

    // ASSERT 4: The name field has content (data was loaded from API).
    // Flutter Web's TextFormField doesn't sync .value to DOM reliably,
    // so we verify by: focusing the field → selecting all → reading
    // the selection range. If selectionEnd > 0, the field has content.
    await nameInput.click({ force: true });
    await page.waitForTimeout(300);
    // Triple-click selects all text via pointer events (Flutter-compatible).
    await nameInput.click({ force: true, clickCount: 3 });
    await page.waitForTimeout(200);
    const fieldState = await page.evaluate(() => {
      const input = document.querySelector(
        'input[aria-label="Company Name *"]',
      ) as HTMLInputElement;
      return {
        hasSelection:
          (input?.selectionEnd ?? 0) - (input?.selectionStart ?? 0) > 0,
        value: input?.value ?? '',
        selectionStart: input?.selectionStart ?? 0,
        selectionEnd: input?.selectionEnd ?? 0,
      };
    });
    // The field should have content — either via .value or selection range.
    const hasData =
      fieldState.value.length > 0 || fieldState.hasSelection;
    expect(
      hasData,
      `Company Name field should have pre-populated data but was empty (value="${fieldState.value}", selection=${fieldState.selectionStart}-${fieldState.selectionEnd})`,
    ).toBeTruthy();

    // ── Step 5: Change name and save ─────────────────────────────
    // Flutter Web text input does not respond to Ctrl+A / Home+Shift+End.
    // Triple-click is a real pointer event that Flutter recognizes as
    // "select all", then typing replaces the selection.
    await nameInput.click({ force: true });
    await page.waitForTimeout(300);
    await nameInput.click({ force: true, clickCount: 3 });
    await page.waitForTimeout(300);
    await page.keyboard.type(renamedName, { delay: 15 });
    await page.waitForTimeout(300);

    // Click Update button.
    await clickButton(page, 'Update');

    // ASSERT 5: Success feedback.
    await expectText(page, /updated|saved|success/i);

    // ── Step 6: Verify via API ───────────────────────────────────
    // The SAME supplier should be updated (not a new one created).
    const getRes = await page.context().request.get(
      `${apiBase}/suppliers/${supplierId}`,
      { headers: authHeaders },
    );
    expect(getRes.status()).toBe(200);
    const fetched = await getRes.json().catch(() => ({}));
    expect(fetched?.companyName).toBe(renamedName);
    expect(fetched?.bin).toBe('12345');

    // Verify no duplicate was created.
    const listRes = await page.context().request.get(`${apiBase}/suppliers`, {
      headers: authHeaders,
    });
    const listBody = await listRes.json().catch(() => ({}));
    expect(listBody?.total).toBe(1);
  });
});
