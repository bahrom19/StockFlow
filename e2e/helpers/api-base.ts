import type { APIRequestContext } from '@playwright/test';
import {
  EnvGuardError,
  WEB_ORIGIN,
  E2E_ASSET_PATH,
  parseE2EEnv,
} from './env-guard';

/**
 * Bundled dotenv asset that the E2E web bundle is configured to read.
 *
 * The app only loads this asset when its compiled environment is `e2e`;
 * the globalSetup guard (env-guard.ts) has already proven that property
 * for the served bundle before any spec runs. Re-exported here for
 * existing consumers.
 */
export { E2E_ASSET_PATH };

/**
 * Resolves the API base URL the application under test is configured to use.
 *
 * Fail-closed: reads the bundled asset from the same origin the browser uses
 * (WEB_ORIGIN) and validates it through the shared parseE2EEnv path — the
 * single URL-validation implementation shared with the globalSetup guard, so
 * the helper and the guard can never disagree.
 *
 * A missing, unreadable, redirected, ambiguous, or invalid asset throws
 * EnvGuardError with a fixed reason code. There is no silent fallback: the
 * guard has already proven the asset exists, so any failure here is a
 * regression, not a configuration to paper over. No URL or environment value
 * is ever included in an error message.
 *
 * @param origin Base URL to fetch the asset from. Defaults to the guarded
 *   WEB_ORIGIN (the browser's origin). Unit tests pass their ephemeral
 *   test-server URL so no fixed port is required; the asset content is
 *   still validated by the same fail-closed parseE2EEnv path either way.
 */
export async function resolveApiBase(
  request: APIRequestContext,
  origin: string = WEB_ORIGIN,
): Promise<string> {
  let text: string;
  try {
    const res = await request.get(`${origin}${E2E_ASSET_PATH}`, {
      maxRedirects: 0,
      timeout: 5000,
    });
    // F3: classify 3xx exactly like the shared guard's fetchAsset branch
    // (env-guard.ts), so both consumers agree on the same reason code.
    // Redirects are never followed (maxRedirects: 0) and never accepted.
    const status = res.status();
    if (status >= 300 && status < 400) {
      throw new EnvGuardError('E_REDIRECT');
    }
    if (status === 404) {
      throw new EnvGuardError('E_ASSET_MISSING');
    }
    if (!res.ok()) {
      throw new EnvGuardError('E_FETCH');
    }
    text = await res.text();
  } catch (error) {
    if (error instanceof EnvGuardError) {
      throw error;
    }
    throw new EnvGuardError('E_FETCH');
  }

  const parsed = parseE2EEnv(text);
  if (!parsed.ok) {
    throw new EnvGuardError(parsed.code);
  }
  return parsed.apiBase;
}
