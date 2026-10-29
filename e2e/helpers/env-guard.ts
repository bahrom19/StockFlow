/**
 * StockFlow G16 — P-E2E fail-closed bundle guard (revised design, GO-1).
 *
 * Wired as the Playwright `globalSetup` (see playwright.config.ts). It runs
 * AFTER the configured webServer is available and BEFORE any test file, worker,
 * or `beforeAll` hook can touch data. On any violation it throws EnvGuardError,
 * the run aborts non-zero, and Playwright's task runner still tears the
 * webServer down.
 *
 * What the BUILD_ENV stamp is: a configuration label written by the trusted
 * build step ("this output directory was produced by the e2e build"). It is
 * NOT cryptographic build attestation and cannot prove what dart-define value
 * was compiled into main.dart.js.
 *
 * The mtime freshness check (BUILD_ENV not older than main.dart.js, compared
 * via the served Last-Modified headers) is an additional HEURISTIC that makes
 * a stale label survive less often on a reused local build directory. It is
 * not proof of build provenance either.
 *
 * Design invariants:
 *  - Every failure emits a FIXED reason code. No URL, environment value,
 *    token, or credential is ever interpolated into an error message.
 *  - Guard asset fetches never follow redirects (redirect: 'manual').
 *  - Bounded time: 5s per request, 15s total budget.
 *  - Importing this module performs no I/O: all constants are plain values.
 *  - parseE2EEnv is the single URL-validation path shared with api-base.ts,
 *    so the guard and the pre-seeding helper cannot disagree.
 */

export type GuardReasonCode =
  | 'E_MISSING_STAMP'
  | 'E_STAMP_VALUE'
  | 'E_STAMP_STALE'
  | 'E_ASSET_MISSING'
  | 'E_FETCH'
  | 'E_REDIRECT'
  | 'E_API_COUNT'
  | 'E_URL_SYNTAX'
  | 'E_SCHEME'
  | 'E_HOST'
  | 'E_CREDENTIALS'
  | 'E_CONTROL_CHAR';

/** Fixed failure messages, keyed by code. Never interpolated. */
const REASON_MESSAGES: Record<GuardReasonCode, string> = {
  E_MISSING_STAMP: 'EnvGuard:E_MISSING_STAMP',
  E_STAMP_VALUE: 'EnvGuard:E_STAMP_VALUE',
  E_STAMP_STALE: 'EnvGuard:E_STAMP_STALE',
  E_ASSET_MISSING: 'EnvGuard:E_ASSET_MISSING',
  E_FETCH: 'EnvGuard:E_FETCH',
  E_REDIRECT: 'EnvGuard:E_REDIRECT',
  E_API_COUNT: 'EnvGuard:E_API_COUNT',
  E_URL_SYNTAX: 'EnvGuard:E_URL_SYNTAX',
  E_SCHEME: 'EnvGuard:E_SCHEME',
  E_HOST: 'EnvGuard:E_HOST',
  E_CREDENTIALS: 'EnvGuard:E_CREDENTIALS',
  E_CONTROL_CHAR: 'EnvGuard:E_CONTROL_CHAR',
};

export class EnvGuardError extends Error {
  readonly code: GuardReasonCode;

  constructor(code: GuardReasonCode) {
    super(REASON_MESSAGES[code]);
    this.name = 'EnvGuardError';
    this.code = code;
  }
}

/**
 * Origin of the static server that serves the built Flutter web bundle.
 * Matches playwright.config.ts (`baseURL` and `webServer.url`): the guard
 * always inspects the same origin the browser is pointed at.
 */
export const WEB_ORIGIN = 'http://127.0.0.1:8081';

/** Build label written immediately after the trusted e2e build. */
export const BUILD_STAMP_PATH = '/assets/env/BUILD_ENV';

/** Bundled dotenv asset the app loads when the compiled environment is e2e. */
export const E2E_ASSET_PATH = '/assets/env/.env.e2e';

/** Compiled entry; only its Last-Modified header is used for freshness. */
export const ENTRY_JS_PATH = '/main.dart.js';

const API_BASE_KEY = 'API_BASE_URL=';
const REQUIRED_STAMP = 'e2e';
const REQUEST_TIMEOUT_MS = 5_000;
const TOTAL_BUDGET_MS = 15_000;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

export type EnvParseResult =
  | { ok: true; apiBase: string }
  | { ok: false; code: GuardReasonCode };

/**
 * Pure validator for a served .env.e2e body. Deterministic, no I/O.
 *
 * Mirrors the application-side rules in mobile/lib/core/config/environment.dart
 * (trim, control-character rejection, absolute http(s) URL, no credentials,
 * real host, valid port) and adds the E2E-only constraints: exactly one
 * API_BASE_URL declaration, HTTP only, loopback host only.
 */
export function parseE2EEnv(text: string): EnvParseResult {
  const declarations = text.split(/\r?\n/).filter((line) =>
    line.startsWith(API_BASE_KEY),
  );
  if (declarations.length !== 1) {
    return { ok: false, code: 'E_API_COUNT' };
  }

  const raw = declarations[0].slice(API_BASE_KEY.length).trim();
  if (raw.length === 0) {
    return { ok: false, code: 'E_URL_SYNTAX' };
  }

  // Control characters or whitespace anywhere inside the value. Trailing
  // line endings were removed by trim(), matching the app's own trim-then-
  // validate sequence; anything still here is embedded and invalid.
  for (let i = 0; i < raw.length; i++) {
    const unit = raw.charCodeAt(i);
    if (unit <= 0x20 || unit === 0x7f) {
      return { ok: false, code: 'E_CONTROL_CHAR' };
    }
  }

  if (raw.indexOf('://') <= 0) {
    return { ok: false, code: 'E_URL_SYNTAX' };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, code: 'E_URL_SYNTAX' };
  }

  if (url.protocol !== 'http:') {
    return { ok: false, code: 'E_SCHEME' };
  }

  if (url.username !== '' || url.password !== '') {
    return { ok: false, code: 'E_CREDENTIALS' };
  }

  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    return { ok: false, code: 'E_HOST' };
  }

  if (url.port !== '' && Number(url.port) < 1) {
    return { ok: false, code: 'E_URL_SYNTAX' };
  }

  return { ok: true, apiBase: raw };
}

interface ServedAsset {
  status: number;
  text?: string;
  lastModifiedMs?: number;
}

async function fetchAsset(
  origin: string,
  path: string,
  method: 'GET' | 'HEAD',
  deadline: number,
): Promise<ServedAsset> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new EnvGuardError('E_FETCH');
  }
  const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, remaining);

  let res: Response;
  try {
    res = await fetch(`${origin}${path}`, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new EnvGuardError('E_FETCH');
  }

  if (res.status >= 300 && res.status < 400) {
    throw new EnvGuardError('E_REDIRECT');
  }

  const lastModifiedHeader = res.headers.get('last-modified');
  const lastModifiedMs =
    lastModifiedHeader === null ? Number.NaN : Date.parse(lastModifiedHeader);

  if (method === 'HEAD') {
    return { status: res.status, lastModifiedMs };
  }

  try {
    const text = await res.text();
    return { status: res.status, text, lastModifiedMs };
  } catch {
    throw new EnvGuardError('E_FETCH');
  }
}

/**
 * Fail-closed verification of the bundle actually served at `origin`.
 * Throws EnvGuardError with a fixed reason code on any violation; resolves
 * only when the served stamp, entry freshness heuristic, and .env.e2e asset
 * all prove a loopback e2e configuration.
 */
export async function assertLoopbackBundle(
  origin: string = WEB_ORIGIN,
): Promise<void> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  // 1. BUILD_ENV stamp must exist and be exactly the e2e label.
  const stamp = await fetchAsset(origin, BUILD_STAMP_PATH, 'GET', deadline);
  if (stamp.status === 404) {
    throw new EnvGuardError('E_MISSING_STAMP');
  }
  if (stamp.status !== 200 || stamp.text === undefined) {
    throw new EnvGuardError('E_FETCH');
  }
  if (stamp.text.trim() !== REQUIRED_STAMP) {
    throw new EnvGuardError('E_STAMP_VALUE');
  }

  // 2. Freshness heuristic: the served label must be at least as new as the
  //    served compiled entry. Catches a label left behind by an earlier e2e
  //    build after the bundle was rebuilt (e.g. with ENV=prod) on a reused
  //    local build directory. Heuristic only — not provenance proof.
  const entry = await fetchAsset(origin, ENTRY_JS_PATH, 'HEAD', deadline);
  if (entry.status === 404) {
    throw new EnvGuardError('E_ASSET_MISSING');
  }
  if (entry.status !== 200) {
    throw new EnvGuardError('E_FETCH');
  }
  if (
    !Number.isFinite(stamp.lastModifiedMs) ||
    !Number.isFinite(entry.lastModifiedMs)
  ) {
    throw new EnvGuardError('E_STAMP_STALE');
  }
  if (stamp.lastModifiedMs < entry.lastModifiedMs) {
    throw new EnvGuardError('E_STAMP_STALE');
  }

  // 3. The e2e environment asset must be served.
  const asset = await fetchAsset(origin, E2E_ASSET_PATH, 'GET', deadline);
  if (asset.status === 404) {
    throw new EnvGuardError('E_ASSET_MISSING');
  }
  if (asset.status !== 200 || asset.text === undefined) {
    throw new EnvGuardError('E_FETCH');
  }

  // 4. Single shared validation path with resolveApiBase.
  const parsed = parseE2EEnv(asset.text);
  if (!parsed.ok) {
    throw new EnvGuardError(parsed.code);
  }
}

/**
 * Playwright globalSetup entry point (default export).
 * Runs after the webServer is available, before any test hooks.
 */
export default async function globalSetup(): Promise<void> {
  await assertLoopbackBundle();
}
