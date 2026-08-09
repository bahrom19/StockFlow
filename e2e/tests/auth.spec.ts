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
 * StockFlow v1.2.1 — First-user authentication flow.
 *
 * Runs against the locally-served Flutter Web release build which talks to
 * the PRODUCTION Railway API (embedded in env/.env.prod) — the same binary
 * that is deployed to stockflow-web.
 *
 * ── IDENTITY LIFECYCLE (critical) ─────────────────────────────────────────
 * The test identity (email / company) is created AND registered via the API
 * in `test.beforeAll`, which Playwright runs once per worker process.
 *
 * Root cause of the historical flaky 401s: identity was generated at MODULE
 * scope (`let unique = Date.now()`). Playwright 1.62 restarts worker
 * processes mid-file (re-evaluating the module), so tests that ran in a new
 * worker used an email that had never been registered → spurious
 * `401 Invalid credentials`. Registering in beforeAll guarantees the identity
 * always exists in whichever worker runs the tests.
 * ──────────────────────────────────────────────────────────────────────────
 */

const PASSWORD = 'E2eStrong123!';
const FULL_NAME = 'E2E Tester';

// Production API base, resolved from the built binary (same URL the app
// itself uses). Fallback kept for resilience if extraction ever fails.
const API_FALLBACK = 'https://stockflow-production-04c7.up.railway.app/api';

/** Identity registered in beforeAll; all login-dependent tests share it. */
let identity: { email: string; companyName: string } | undefined;

async function resolveApiBase(request: APIRequestContext): Promise<string> {
  try {
    const res = await request.get('http://127.0.0.1:8081/main.dart.js');
    if (res.ok()) {
      const js = await res.text();
      const m = js.match(/https:\/\/[a-z0-9.-]+railway\.app\/api/);
      if (m) return m[0];
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
    email: `e2e.${unique}@stockflow.test`,
    companyName: `E2E Corp ${unique}`,
  };
  const apiBase = await resolveApiBase(request);
  const res = await request.post(`${apiBase}/auth/register`, {
    data: {
      email: identity.email,
      password: PASSWORD,
      companyName: identity.companyName,
      firstName: FULL_NAME,
    },
  });
  // 201 = created; 409 = already exists (harmless — identity is still valid).
  if (res.status() !== 201 && res.status() !== 409) {
    throw new Error(
      `beforeAll registration failed: ${res.status()} ${await res.text()}`,
    );
  }
});

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

/** Register a company through the real UI (register screen). */
async function registerViaUi(
  page: Page,
  opts: { email: string; companyName: string },
): Promise<void> {
  await waitForRoute(page, '#/register');
  await typeInto(page, 'Company Name', opts.companyName);
  await typeInto(page, 'Full Name', FULL_NAME);
  await typeInto(page, 'Email', opts.email);
  await typeInto(page, 'Password', PASSWORD);
  await typeInto(page, 'Confirm Password', PASSWORD);
  await clickButton(page, 'Create Account');
}

/** Log in with the beforeAll-registered identity. */
async function login(page: Page): Promise<void> {
  await waitForRoute(page, '#/login');
  await typeInto(page, 'Email', identity!.email);
  await typeInto(page, 'Password', PASSWORD);
  await clickButton(page, 'Sign In');
  await waitForRoute(page, '#/dashboard');
}

/**
 * Flutter web only emits semantics nodes for widgets laid out inside the
 * visible viewport. On the dashboard the KPI strip sits below the tall Cash
 * Drawer hero, so scroll it into view before asserting KPI labels — a real
 * wheel gesture, not a wait/retry workaround.
 */
async function scrollDashboardIntoView(page: Page): Promise<void> {
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 1000);
}

test.describe('StockFlow first-user authentication', () => {
  test('1. Register new company', async ({ page }) => {
    // The beforeAll identity already exists; this test needs its OWN fresh
    // email to exercise the real "new company" success path.
    const uiUnique = `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    await waitForRoute(page, '#/login');
    await clickButton(page, 'Create account');
    await waitForRoute(page, '#/register');

    await registerViaUi(page, {
      email: `e2e-ui.${uiUnique}@stockflow.test`,
      companyName: `E2E UI Corp ${uiUnique}`,
    });

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
    await scrollDashboardIntoView(page);
    // KPI strip regression guard: ALL five labels must be visible through
    // document.body.innerText. This regressed in Stage E when the
    // interactive pencil IconButton inside RevenueGoalCard made Flutter Web
    // hoist the whole strip's text into role="group" aria-label (invisible
    // to innerText). The semantics boundary fix restores textContent output.
    for (const label of [
      "Today's Revenue",
      "Today's Sales",
      'Gross Profit',
      'Inventory Value',
      'Customers',
    ]) {
      await expectText(page, label);
    }
  });

  test('4. Refresh page keeps the session (F5)', async ({ page }) => {
    await login(page);
    await page.reload();
    await waitForRoute(page, '#/dashboard');
    // After a reload Flutter re-shows the accessibility placeholder; the
    // session itself is restored (route = dashboard), reactivate semantics
    // to render the tree for further assertions.
    await reenableSemantics(page);
    await scrollDashboardIntoView(page);
    await expectText(page, "Today's Revenue");
  });

  test('5. Session restored after full reload', async ({ page }) => {
    await login(page);
    // Hard reload — full page restore from secure storage.
    await page.goto('/#/dashboard');
    await page.reload();
    await waitForRoute(page, '#/dashboard');
    await reenableSemantics(page);
    await scrollDashboardIntoView(page);
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
    await typeInto(page, 'Email', identity!.email);
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

    // The beforeAll identity is guaranteed to exist → deterministic 409.
    await registerViaUi(page, {
      email: identity!.email,
      companyName: identity!.companyName,
    });

    // Error snackbar, still on register.
    await expectText(page, /already|exists|registered/i);
    await expectText(page, 'Create your account');
  });

  test('10. Password mismatch rejected client-side', async ({ page }) => {
    await waitForRoute(page, '#/login');
    await clickButton(page, 'Create account');
    await waitForRoute(page, '#/register');

    await typeInto(page, 'Company Name', identity!.companyName);
    await typeInto(page, 'Full Name', FULL_NAME);
    await typeInto(page, 'Email', identity!.email);
    await typeInto(page, 'Password', PASSWORD);
    await typeInto(page, 'Confirm Password', 'Different123!');
    await clickButton(page, 'Create Account');

    await expectText(page, 'Passwords do not match');
    await expectText(page, 'Create your account');
  });

  test('11. Monthly goal pencil opens dialog and survives reload', async ({
    page,
  }) => {
    await login(page);
    await scrollDashboardIntoView(page);

    // Pencil (role=button, label from tooltip) opens the Monthly Goal dialog.
    await clickButton(page, 'Set monthly goal');
    // Dialog is open when its amount input is present. Flutter Web renders
    // the dialog as an overlay where the title/labels may live in aria-label
    // rather than innerText, so assert on the input itself (exact, robust).
    const field = page.locator('input[aria-label*="Goal amount"]');
    await field.waitFor({ state: 'visible', timeout: 15_000 });
    await field.click({ force: true });
    await page.waitForTimeout(400);
    await page.keyboard.type('2000000', { delay: 25 });
    await clickButton(page, 'Save');

    // Goal summary appears on the Revenue card (currencyShort($2.0M)).
    await expectText(page, 'of $2.0M');

    // Reload → goal persisted locally (SharedPreferences), progress re-shown.
    await page.reload();
    await waitForRoute(page, '#/dashboard');
    await reenableSemantics(page);
    await scrollDashboardIntoView(page);
    await expectText(page, 'of $2.0M');
  });
});
