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
 * rewrite needed) and must talk to an ISOLATED loopback stand — never to
 * production. Endpoint selection is enforced fail-closed by the globalSetup
 * guard (helpers/env-guard.ts), which verifies the actually served bundle
 * before any test hook runs:
 *   - BUILD_ENV must be present and read "e2e" (a configuration label,
 *     NOT cryptographic attestation of the build);
 *   - the label must be no older than main.dart.js (mtime heuristic,
 *     not proof of build provenance);
 *   - assets/env/.env.e2e must exist and contain exactly one http://
 *     API_BASE_URL whose host is localhost or 127.0.0.1.
 *
 * Safe local build sequence (stale or pre-existing servers cannot pass a
 * wrong bundle — the guard inspects whatever is actually served on 8081):
 *
 *   cd mobile
 *   flutter build web --release --dart-define=ENV=e2e
 *   printf 'e2e\n' > build/web/assets/env/BUILD_ENV   # immediately after build
 *   cd ../e2e
 *   npx playwright test
 *
 * Config-level bypass limitations (documented residual risk): the guard is
 * wired through this config file. Invoking Playwright with a different
 * --config, editing this file to remove globalSetup, or hand-writing BUILD_ENV
 * after an incorrectly built bundle defeats it. The guard defends against
 * misconfiguration, not against a hostile author of the local tree.
 */
export default defineConfig({
  // Fail-closed production-isolation guard. Playwright 1.62.1 runs plugin
  // setup (webServer start + availability probe) BEFORE globalSetup, and
  // globalSetup BEFORE test files, workers, and beforeAll hooks. If it
  // throws, the run exits non-zero and the webServer teardown still runs.
  globalSetup: './helpers/env-guard.ts',
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
