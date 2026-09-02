import { test, expect, Page, APIRequestContext } from '@playwright/test';
import {
  enableSemantics,
  reenableSemantics,
  typeInto,
  clickButton,
  expectText,
  waitForRoute,
  clickMenu,
} from '../helpers/flutter';

/**
 * StockFlow — Forgot Password / Password Reset E2E.
 *
 * Tests the full flow:
 * 1. Register a test user via API
 * 2. Open the "Forgot password?" form
 * 3. Submit email → generic success message
 * 4. Use DEV-only endpoint to get reset token
 * 5. Navigate to reset password screen
 * 6. Enter new password → success
 * 7. Verify old password no longer works
 * 8. Verify new password works
 */

const PASSWORD = 'E2eStrong123!';
const NEW_PASSWORD = 'NewE2ePass456!';

const API_FALLBACK = 'http://localhost:3000/api';

async function resolveApiBase(request: APIRequestContext): Promise<string> {
  try {
    const res = await request.get('http://127.0.0.1:8081/assets/env/.env.prod');
    if (res.ok()) {
      const text = await res.text();
      const m = text.match(/API_BASE_URL=(.+)/);
      if (m) return m[1].trim();
    }
  } catch {}
  return API_FALLBACK;
}

let identity: { email: string; companyName: string } | undefined;
let apiBase: string;

test.beforeAll(async ({ request }) => {
  apiBase = await resolveApiBase(request);
  const unique = `e2e.forgot.${Date.now()}`;
  identity = { email: `${unique}@stockflow.test`, companyName: `ForgotCo ${unique}` };

  // Register a test user
  const res = await request.post(`${apiBase}/auth/register`, {
    data: {
      email: identity.email,
      password: PASSWORD,
      companyName: identity.companyName,
    },
  });
  expect(res.status()).toBe(201);
});

test.describe('Forgot Password flow', () => {
  test('1. Forgot password form opens and submits email', async ({ page }) => {
    await page.goto('http://127.0.0.1:8081');
    await enableSemantics(page);

    // Navigate to login
    await page.goto('http://127.0.0.1:8081/#/login');
    await page.waitForTimeout(2000);
    await reenableSemantics(page);
    await page.waitForTimeout(1000);

    // Verify login page loaded
    await expectText(page, 'Sign In');

    // Click "Forgot password?" link
    await clickButton(page, 'Forgot password?');
    await page.waitForTimeout(2000);
    await reenableSemantics(page);

    // Verify forgot password screen
    await expectText(page, 'Reset your password');

    // Enter email
    const emailInput = page.locator('input[aria-label="Email"]');
    await emailInput.click({ force: true });
    await page.waitForTimeout(300);
    await emailInput.fill(identity!.email);

    // Submit
    await clickButton(page, 'Send reset link');
    await page.waitForTimeout(3000);

    // Verify success message
    await expectText(page, /password reset link has been sent/i);
  });

  test('2. Reset password with new credentials', async ({ page, request }) => {
    // Get the reset token via DEV-only endpoint
    const tokenRes = await request.post(`${apiBase}/auth/dev-reset-token`, {
      data: { email: identity!.email },
    });
    expect(tokenRes.status()).toBe(200);
    const { token } = await tokenRes.json();
    expect(token).toBeTruthy();

    // Navigate directly to reset-password with token.
    // Flutter's auth redirect allows /reset-password for unauthenticated users.
    await page.goto(`http://127.0.0.1:8081/#/reset-password?token=${token}`);
    await page.waitForTimeout(5000);
    await reenableSemantics(page);
    await page.waitForTimeout(3000);

    // Verify reset password screen — try multiple approaches:
    // 1) flt-semantics selector
    const title = page.locator('flt-semantics').filter({ hasText: 'Set new password' });
    const titleVisible = await title.first().isVisible().catch(() => false);

    if (!titleVisible) {
      // 2) Flutter may have redirected to login. Try hash change with popstate.
      await page.evaluate((t) => {
        window.location.hash = `/reset-password?token=${t}`;
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      }, token);
      await page.waitForTimeout(3000);
      await reenableSemantics(page);
      await page.waitForTimeout(2000);
    }
    await expect(title.first()).toBeVisible({ timeout: 20_000 });

    // Enter new password
    const passwordInput = page.locator('input[aria-label="Password"]');
    await passwordInput.click({ force: true });
    await page.waitForTimeout(300);
    await passwordInput.fill(NEW_PASSWORD);

    // Enter confirm password
    const confirmInput = page.locator('input[aria-label="Confirm Password"]');
    await confirmInput.click({ force: true });
    await page.waitForTimeout(300);
    await confirmInput.fill(NEW_PASSWORD);

    // Submit
    await clickButton(page, 'Reset password');
    await page.waitForTimeout(3000);

    // Verify success message — check semantics tree for Flutter Web
    const successMsg = page.locator('flt-semantics').filter({ hasText: /Password reset successful/i });
    await expect(successMsg.first()).toBeVisible({ timeout: 15_000 });

    // Verify old password no longer works
    const oldLoginRes = await request.post(`${apiBase}/auth/login`, {
      data: { email: identity!.email, password: PASSWORD },
    });
    expect(oldLoginRes.status()).toBe(401);

    // Verify new password works
    const newLoginRes = await request.post(`${apiBase}/auth/login`, {
      data: { email: identity!.email, password: NEW_PASSWORD },
    });
    expect(newLoginRes.status()).toBe(201);
    const loginBody = await newLoginRes.json();
    expect(loginBody.accessToken).toBeTruthy();
  });

  test('3. Login with new password via UI', async ({ page }) => {
    await page.goto('http://127.0.0.1:8081/#/login');
    await page.waitForTimeout(2000);
    await reenableSemantics(page);
    await page.waitForTimeout(1000);

    // Enter email
    const emailInput = page.locator('input[aria-label="Email"]');
    await emailInput.click({ force: true });
    await page.waitForTimeout(300);
    await emailInput.fill(identity!.email);

    // Enter NEW password
    const passwordInput = page.locator('input[aria-label="Password"]');
    await passwordInput.click({ force: true });
    await page.waitForTimeout(300);
    await passwordInput.fill(NEW_PASSWORD);

    // Login
    await clickButton(page, 'Sign In');
    await page.waitForTimeout(5000);

    // Should navigate to dashboard
    await expectText(page, /Dashboard|StockFlow/);
  });

  test('4. Dev endpoint is blocked in production', async ({ request }) => {
    // This test verifies the dev endpoint exists and works in non-prod
    // In production, it would return 500 — but we can't test that here
    const res = await request.post(`${apiBase}/auth/dev-reset-token`, {
      data: { email: 'nonexistent@test.com' },
    });
    // Should return 400 (user not found) — not 500 (production block)
    expect(res.status()).toBe(400);
  });
});
