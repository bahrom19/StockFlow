import { defineConfig, devices } from '@playwright/test';

/**
 * StockFlow Flutter Web — end-to-end authentication suite.
 *
 * The Flutter Web app renders to <canvas>; interaction is driven through
 * Flutter's web semantics tree, which becomes available after clicking the
 * "Enable accessibility" placeholder. All locators below therefore use ARIA
 * roles/names (the semantics layer exposes textboxes, buttons, menus as real
 * DOM nodes with aria-labels).
 *
 * The app is served from a local static server (hash routing — no SPA
 * rewrite needed) and talks to the PRODUCTION Railway API embedded in
 * env/.env.prod, exactly like the deployed site.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'python3 -m http.server 8081 --directory ../mobile/build/web',
    url: 'http://127.0.0.1:8081/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
