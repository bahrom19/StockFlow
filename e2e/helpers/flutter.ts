import { Page, expect } from '@playwright/test';

/**
 * Flutter Web semantics driver.
 *
 * StockFlow renders to <canvas>. With accessibility enabled, Flutter exposes
 * the widget tree as real DOM nodes (semantics tree):
 *   - textboxes  -> <input aria-label="Email">   (rect mirrors the widget)
 *   - buttons    -> <flt-semantics role="button">Sign In
 *   - menu items -> <flt-semantics role="menuitem">Logout
 *
 * HOW INTERACTION WORKS (verified empirically):
 *   1. Dispatched DOM events (el.dispatchEvent/click, el.focus + fill) set
 *      the DOM value but NEVER reach Flutter's TextEditingController — the
 *      engine only wires the editing connection when the <flutter-view>
 *      canvas receives a REAL pointer interaction (pointerdown at the
 *      widget's screen position), exactly like a real user tapping.
 *   2. Therefore every interaction must be a REAL mouse action aimed at the
 *      semantics element's bounding-box center. The <flutter-view> canvas
 *      intercepts the pointer (its hit-test routes it to the right widget),
 *      so use click({force:true}) / page.mouse.click at coordinates.
 *   3. Text is entered with REAL KEYSTROKES (page.keyboard.type) once the
 *      field is focused by the pointer interaction.
 */

/**
 * Wait for the app shell to boot and enable accessibility semantics.
 *
 * The placeholder is a 1x1 px element; a dispatched click activates the
 * semantics tree (verified empirically). It can appear at any point during
 * bootstrap, so poll: every 300 ms, click the placeholder if it exists, and
 * check whether the login email input has appeared yet. This is robust to
 * the placeholder showing up late, briefly, or never (semantics already
 * active after a service-worker restore).
 */
export async function enableSemantics(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const placeholder = page.locator('flt-semantics-placeholder');
  const email = page.locator('input[aria-label="Email"]');
  const intervals = Array(135).fill(300); // up to ~40 s

  await expect
    .poll(async () => {
      if ((await placeholder.count()) > 0) {
        await placeholder.evaluate((el) =>
          el.dispatchEvent(new MouseEvent('click', { bubbles: true })),
        );
      }
      return (await email.count()) > 0;
    }, { timeout: 45_000, intervals })
    .toBe(true);

  await expect(email).toBeVisible({ timeout: 10_000 });
}

/**
 * Re-activate semantics on the CURRENT page (no navigation). After a full
 * reload / hard navigation Flutter boots again and re-shows the "Enable
 * accessibility" placeholder, so the semantics tree (and innerText) stays
 * empty until it is clicked. Polls for any semantics node while clicking the
 * placeholder whenever it exists.
 */
export async function reenableSemantics(page: Page): Promise<void> {
  const placeholder = page.locator('flt-semantics-placeholder');
  const anySemantics = page.locator('flt-semantics');
  const intervals = Array(70).fill(300); // up to ~21 s

  await expect
    .poll(async () => {
      if ((await placeholder.count()) > 0) {
        await placeholder.evaluate((el) =>
          el.dispatchEvent(new MouseEvent('click', { bubbles: true })),
        );
      }
      return (await anySemantics.count()) > 0;
    }, { timeout: 25_000, intervals })
    .toBe(true);
}

/**
 * Type into a labelled textbox: real pointer click at the input's screen
 * position (Flutter focuses the widget and attaches the editing connection),
 * then real keystrokes.
 */
export async function typeInto(
  page: Page,
  label: string,
  value: string,
): Promise<void> {
  const box = page.locator(`input[aria-label="${label}"]`);
  await box.waitFor({ state: 'visible', timeout: 15_000 });
  // force:true — the flutter-view canvas intercepts the pointer; the click
  // still lands at these coordinates and Flutter routes it to the widget.
  await box.click({ force: true });
  await page.waitForTimeout(400);
  await page.keyboard.type(value, { delay: 25 });
  await page.waitForTimeout(200);
}

/** Click a button via a real pointer click at its semantics-node center. */
export async function clickButton(
  page: Page,
  name: string,
): Promise<void> {
  const btn = page
    .locator('flt-semantics[role="button"]')
    .filter({ hasText: name });
  await expect(btn.first()).toBeVisible({ timeout: 15_000 });
  const box = await btn.first().boundingBox();
  if (!box) throw new Error(`No bounding box for button "${name}"`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
}

/**
 * Assert text is present in the rendered page.
 *
 * Flutter's semantics tree renders text as nested plain-text nodes inside
 * flt-semantics containers; a flt-semantics[hasText] locator is unreliable
 * (text may live in a container that Playwright cannot match). Polling
 * document.body.innerText is proven to capture every visible label,
 * snackbar and error (verified: success snackbar + validation errors).
 */
export async function expectText(
  page: Page,
  text: string | RegExp,
  opts: { visible?: boolean } = {},
): Promise<void> {
  const matches = async (body: string) =>
    typeof text === 'string' ? body.includes(text) : text.test(body);
  // Snackbars render in the semantics DOM only for a ~400 ms window
  // (verified empirically), so poll densely — every 120 ms — to never miss
  // a transient success/error message.
  const intervals = Array(125).fill(120); // up to 15 s of dense polling
  if (opts.visible === false) {
    await expect
      .poll(async () => {
        const body = await page.evaluate(() => document.body.innerText);
        return matches(body);
      }, { timeout: 10_000, intervals })
      .toBe(false);
  } else {
    await expect
      .poll(async () => {
        const body = await page.evaluate(() => document.body.innerText);
        return matches(body);
      }, { timeout: 15_000, intervals })
      .toBe(true);
  }
}

/** Wait for the browser location hash to match a route (e.g. '#/login'). */
export async function waitForRoute(
  page: Page,
  route: string,
  timeout = 20_000,
): Promise<void> {
  await page.waitForFunction(
    (r) => window.location.hash.startsWith(r),
    route,
    { timeout },
  );
}

/** Open the account menu and click the named menu item (real pointer). */
export async function clickMenu(page: Page, item: string): Promise<void> {
  const trigger = page
    .locator('flt-semantics[role="button"]')
    .filter({ hasText: 'Account' });
  if ((await trigger.count()) > 0) {
    const box = await trigger.first().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
  } else {
    // Fallback: the account avatar sits at the FAR RIGHT of the top bar.
    // Real pointer events reach the Flutter canvas even when the shell chrome
    // is absent from the semantics tree (NaN-geometry quirk), so click the
    // avatar's screen position directly instead of "the last semantics button"
    // (which on some screens is a content button that navigates away).
    const vp = page.viewportSize() ?? { width: 1440, height: 900 };
    await page.mouse.click(vp.width - 20, 45);
  }
  await page.waitForTimeout(700);
  const menuItem = page
    .locator('flt-semantics[role="menuitem"], flt-semantics[role="button"]')
    .filter({ hasText: item });
  await expect(menuItem.first()).toBeVisible({ timeout: 10_000 });
  const box = await menuItem.first().boundingBox();
  if (!box) throw new Error(`No bounding box for menu item "${item}"`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
}
