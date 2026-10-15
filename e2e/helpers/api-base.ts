import type { APIRequestContext } from '@playwright/test';

/**
 * Origin of the static server that serves the built Flutter web bundle.
 * Matches `playwright.config.ts` (`baseURL` and the `webServer` url).
 */
const WEB_ORIGIN = 'http://127.0.0.1:8081';

/**
 * Bundled dotenv asset that the E2E web bundle is configured to read.
 *
 * The workflow builds with `--dart-define=ENV=e2e`, so the application loads
 * `env/.env.e2e` — never the production asset. Reading the production asset
 * here would make the specs validate one file while the app under test used
 * another.
 */
export const E2E_ASSET_PATH = '/assets/env/.env.e2e';

/**
 * Loopback-only fallback, used when the bundled asset cannot be read.
 *
 * This must never be a production URL: it is what keeps a failed asset read
 * pointing the suite at the local stand instead of a live environment.
 */
export const API_FALLBACK = 'http://localhost:3000/api';

/**
 * Resolves the API base URL the application under test is configured to use.
 *
 * The resolution order and the failure behaviour are deliberately identical to
 * the per-spec resolvers this helper replaces: read the bundled asset, take the
 * first `API_BASE_URL=` value, trim it, and otherwise fall back to loopback.
 */
export async function resolveApiBase(
  request: APIRequestContext,
): Promise<string> {
  try {
    const res = await request.get(`${WEB_ORIGIN}${E2E_ASSET_PATH}`);
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