import { test, expect, Page } from '@playwright/test';
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
 * StockFlow v1.2.1 — First-user authentication flow.
 *
 * Runs against the locally-served Flutter Web release build which talks to
 * the PRODUCTION Railway API (embedded in env/.env.prod) — the same binary
 * that is deployed to stockflow-web.
 *
 * Each run uses a unique company (timestamp suffix) so parallel/repeated
 * runs never collide on duplicate emails.
 */

let unique = Date.now().toString(36);
let companyName = `E2E Corp ${unique}`;
let email = `e2e.${unique}@stockflow.test`;
const password = 'E2eStrong123!';
const fullName = 'E2E Tester';

async function registerCompany(page: Page): Promise<void> {
  await waitForRoute(page, '#/register');
  await typeInto(page, 'Company Name', companyName);
  await typeInto(page, 'Full Name', fullName);
  await typeInto(page, 'Email', email);
  await typeInto(page, 'Password', password);
  await typeInto(page, 'Confirm Password', password);
  await clickButton(page, 'Create Account');
}

async function login(page: Page): Promise<void> {
  await waitForRoute(page, '#/login');
  await typeInto(page, 'Email', email);
  await typeInto(page, 'Password', password);
  await clickButton(page, 'Sign In');
  await waitForRoute(page, '#/dashboard');
}

// Failure diagnostics: capture console + page errors so a hanging/failing
// test can be debugged from the report without a rerun.
const browserLogs: string[] = [];

test.beforeEach(async ({ page }, testInfo) => {
  browserLogs.length = 0;
  page.on('console', (msg) => {
    browserLogs.push(`[console:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    browserLogs.push(`[pageerror] ${err.message}`);
  });
  await enableSemantics(page);
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') {
    console.log('\n=== BROWSER CONSOLE LOGS ===');
    console.log(browserLogs.slice(-40).join('\n') || '(none)');
    const html = await page.content().catch(() => '(unavailable)');
    console.log('=== PAGE HTML (first 2500 chars) ===');
    console.log(html.slice(0, 2500));
  }
});

test.describe('StockFlow first-user authentication', () => {
  test('1. Register new company', async ({ page }) => {
    await waitForRoute(page, '#/login');
    await clickButton(page, 'Create account');
    await waitForRoute(page, '#/register');

    await registerCompany(page);

    // Success snackbar, then redirected back to login.
    await expectText(page, 'Account created. Please sign in.');
    await waitForRoute(page, '#/login');
  });

  test('2. Login', async ({ page }) => {
    await login(page);
    await waitForRoute(page, '#/dashboard');
  });

  test('3. Dashboard opens', async ({ page }) => {
    await login(page);
    await expectText(page, "Today's Revenue");
    await expectText(page, "Today's Sales");
  });

  test('4. Refresh page keeps the session (F5)', async ({ page }) => {
    await login(page);
    await page.reload();
    await waitForRoute(page, '#/dashboard');
    // After a reload Flutter re-shows the accessibility placeholder; the
    // session itself is restored (route = dashboard), reactivate semantics
    // to render the tree for further assertions.
    await reenableSemantics(page);
    await expectText(page, "Today's Revenue");
  });

  test('5. Session restored after full reload', async ({ page }) => {
    await login(page);
    // Hard reload — full page restore from secure storage.
    await page.goto('/#/dashboard');
    await page.reload();
    await waitForRoute(page, '#/dashboard');
    await reenableSemantics(page);
    await expectText(page, "Today's Revenue");
  });

  test('6. Logout returns to Login', async ({ page }) => {
    await login(page);
    await clickMenu(page, 'Logout');
    await waitForRoute(page, '#/login');
  });

  test('7. Protected pages redirect to Login', async ({ page }) => {
    // Fresh context (beforeEach enabled semantics, but no session).
    await page.goto('/#/dashboard');
    await waitForRoute(page, '#/login');
    await reenableSemantics(page);
    await expectText(page, 'Sign In');
  });

  test('8. Invalid password rejected', async ({ page }) => {
    await waitForRoute(page, '#/login');
    await typeInto(page, 'Email', email);
    await typeInto(page, 'Password', 'WrongPass123!');
    await clickButton(page, 'Sign In');
    // Stays on login with an error.
    await waitForRoute(page, '#/login');
    await expectText(page, /invalid|incorrect|failed/i);
  });

  test('9. Duplicate email rejected', async ({ page }) => {
    await waitForRoute(page, '#/login');
    await clickButton(page, 'Create account');
    await waitForRoute(page, '#/register');

    await registerCompany(page);

    // Error snackbar, still on register.
    await expectText(page, /already|exists|registered/i);
    await expectText(page, 'Create your account');
  });

  test('10. Password mismatch rejected client-side', async ({ page }) => {
    await waitForRoute(page, '#/login');
    await clickButton(page, 'Create account');
    await waitForRoute(page, '#/register');

    await typeInto(page, 'Company Name', companyName);
    await typeInto(page, 'Full Name', fullName);
    await typeInto(page, 'Email', email);
    await typeInto(page, 'Password', password);
    await typeInto(page, 'Confirm Password', 'Different123!');
    await clickButton(page, 'Create Account');

    await expectText(page, 'Passwords do not match');
    await expectText(page, 'Create your account');
  });
});
