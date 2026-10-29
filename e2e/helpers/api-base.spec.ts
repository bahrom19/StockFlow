import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { createServer } from 'node:http';
import { resolveApiBase } from './api-base';
import {
  parseE2EEnv,
  assertLoopbackBundle,
  EnvGuardError,
  GuardReasonCode,
} from './env-guard';
import { createTestServer, TestServer } from './test-server';

let integrationTestServer: TestServer;

async function withRequestContext<T>(
  run: (context: APIRequestContext) => Promise<T>,
): Promise<T> {
  const context = await request.newContext();
  let hasPrimaryError = false;

  try {
    return await run(context);
  } catch (error) {
    hasPrimaryError = true;
    throw error;
  } finally {
    if (!hasPrimaryError) {
      await context.dispose();
    } else {
      try {
        await context.dispose();
      } catch {
        // Preserve the original test error if cleanup also fails.
      }
    }
  }
}

function requestRejectingWith(error: unknown): APIRequestContext {
  return {
    get: async () => {
      throw error;
    },
  } as unknown as APIRequestContext;
}

test.beforeAll(async () => {
  // Port 0: ephemeral port assigned by the OS, actual URL read back from
  // server.address() (see test-server.ts) — never a fixed port, so unit
  // runs cannot collide with the main E2E webServer or each other.
  integrationTestServer = await createTestServer();
});

test.afterAll(async () => {
  await integrationTestServer.close();
});

test.describe('parseE2EEnv - shared parser contract', () => {
  test('missing API_BASE_URL returns E_API_COUNT', () => {
    const result = parseE2EEnv('APP_NAME=Test\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_API_COUNT');
  });

  test('duplicate API_BASE_URL returns E_API_COUNT', () => {
    const result = parseE2EEnv('API_BASE_URL=http://localhost:3000/api\nAPI_BASE_URL=http://evil.com\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_API_COUNT');
  });

  test('invalid scheme (https) returns E_SCHEME', () => {
    const result = parseE2EEnv('API_BASE_URL=https://localhost:3000/api\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_SCHEME');
  });

  test('non-loopback host returns E_HOST', () => {
    const result = parseE2EEnv('API_BASE_URL=http://evil.com/api\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_HOST');
  });

  test('invalid port (0) returns E_URL_SYNTAX', () => {
    const result = parseE2EEnv('API_BASE_URL=http://localhost:0/api\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_URL_SYNTAX');
  });

  test('embedded credentials returns E_CREDENTIALS', () => {
    const result = parseE2EEnv('API_BASE_URL=http://user:pass@localhost:3000/api\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_CREDENTIALS');
  });

  test('embedded control character returns E_CONTROL_CHAR', () => {
    const result = parseE2EEnv('API_BASE_URL=http://localhost:3000/api\tmore\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_CONTROL_CHAR');
  });

  test('valid loopback URL returns ok', () => {
    const result = parseE2EEnv('API_BASE_URL=http://localhost:3000/api\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.apiBase).toBe('http://localhost:3000/api');
    }
  });

  test('valid 127.0.0.1 URL returns ok', () => {
    const result = parseE2EEnv('API_BASE_URL=http://127.0.0.1:3000/api\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.apiBase).toBe('http://127.0.0.1:3000/api');
    }
  });

  test('empty value returns E_URL_SYNTAX', () => {
    const result = parseE2EEnv('API_BASE_URL=\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_URL_SYNTAX');
  });

  test('malformed URL returns E_URL_SYNTAX', () => {
    const result = parseE2EEnv('API_BASE_URL=not-a-url\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_URL_SYNTAX');
  });

  test('ftp scheme returns E_SCHEME', () => {
    const result = parseE2EEnv('API_BASE_URL=ftp://localhost:3000/api\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_SCHEME');
  });

  test('non-loopback IP returns E_HOST', () => {
    const result = parseE2EEnv('API_BASE_URL=http://192.168.1.1/api\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_HOST');
  });

  test('port out of range returns E_URL_SYNTAX', () => {
    const result = parseE2EEnv('API_BASE_URL=http://localhost:70000/api\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_URL_SYNTAX');
  });

  test('negative port returns E_URL_SYNTAX', () => {
    const result = parseE2EEnv('API_BASE_URL=http://localhost:-1/api\n');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_URL_SYNTAX');
  });
});

test.describe('error message leakage', () => {
  test('EnvGuardError messages contain only fixed codes', () => {
    const codes: GuardReasonCode[] = [
      'E_MISSING_STAMP',
      'E_STAMP_VALUE',
      'E_STAMP_STALE',
      'E_ASSET_MISSING',
      'E_FETCH',
      'E_REDIRECT',
      'E_API_COUNT',
      'E_URL_SYNTAX',
      'E_SCHEME',
      'E_HOST',
      'E_CREDENTIALS',
      'E_CONTROL_CHAR',
    ];

    for (const code of codes) {
      const error = new EnvGuardError(code);
      expect(error.message).toBe(`EnvGuard:${code}`);
      expect(error.message).not.toMatch(/http:/);
      expect(error.message).not.toMatch(/localhost/);
      expect(error.message).not.toMatch(/127\.0\.0\.1/);
      expect(error.message).not.toMatch(/evil/);
      expect(error.message).not.toMatch(/user|pass/);
    }
  });

  test('EnvGuardError has correct name and code', () => {
    const error = new EnvGuardError('E_FETCH');
    expect(error.name).toBe('EnvGuardError');
    expect(error.code).toBe('E_FETCH');
  });
});

test.describe('resolveApiBase - error contract & integration (ephemeral port)', () => {
  test.beforeEach(async () => {
    await integrationTestServer.setAssetResponse({
      status: 200,
      body: 'API_BASE_URL=http://localhost:3000/api\n',
    });
  });

  test('invalid HTTPS API base returns the exact E_SCHEME error', async () => {
    await integrationTestServer.setAssetResponse({
      status: 200,
      body: 'API_BASE_URL=https://localhost:3000/api\n',
    });
    const error = await withRequestContext(async (context) =>
      resolveApiBase(context, integrationTestServer.url).catch((caught) => caught),
    );

    expect(error).toBeInstanceOf(EnvGuardError);
    expect((error as EnvGuardError).code).toBe('E_SCHEME');
    expect((error as EnvGuardError).message).toBe('EnvGuard:E_SCHEME');
  });

  test('error messages do not leak the rejected URL secret marker', async () => {
    const secretMarker = 'unit-a-secret-marker-7f31c9';
    await integrationTestServer.setAssetResponse({
      status: 200,
      body: `API_BASE_URL=http://${secretMarker}:password@localhost:3000/api\n`,
    });
    const error = await withRequestContext(async (context) =>
      resolveApiBase(context, integrationTestServer.url).catch((caught) => caught),
    );

    expect(error).toBeInstanceOf(EnvGuardError);
    expect((error as EnvGuardError).code).toBe('E_CREDENTIALS');
    expect((error as EnvGuardError).message).toBe('EnvGuard:E_CREDENTIALS');
    expect((error as EnvGuardError).message).not.toContain(secretMarker);
  });

  test('HTTP 500 response maps to EnvGuardError E_FETCH', async () => {
    await integrationTestServer.setAssetResponse({ status: 500 });
    const error = await withRequestContext(async (context) =>
      resolveApiBase(context, integrationTestServer.url).catch((caught) => caught),
    );

    expect(error).toBeInstanceOf(EnvGuardError);
    expect((error as EnvGuardError).code).toBe('E_FETCH');
    expect((error as EnvGuardError).message).toBe('EnvGuard:E_FETCH');
  });

  test('preserves the same EnvGuardError rejected by request.get', async () => {
    const originalError = new EnvGuardError('E_FETCH');
    const error = await resolveApiBase(requestRejectingWith(originalError)).catch(
      (caught) => caught,
    );

    expect(error).toBe(originalError);
    expect(error).toBeInstanceOf(EnvGuardError);
    expect((error as EnvGuardError).code).toBe('E_FETCH');
    expect((error as EnvGuardError).message).toBe('EnvGuard:E_FETCH');
  });

  test('network rejection from request.get maps to EnvGuardError E_FETCH', async () => {
    const transportMarker = 'unit-a-transport-failure-91bd';
    const error = await resolveApiBase(
      requestRejectingWith(new Error(`transport failure ${transportMarker}`)),
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(EnvGuardError);
    expect((error as EnvGuardError).code).toBe('E_FETCH');
    expect((error as EnvGuardError).message).toBe('EnvGuard:E_FETCH');
    expect((error as EnvGuardError).message).not.toContain(transportMarker);
  });

  test('HTTP redirect returns E_REDIRECT (maxRedirects: 0)', async () => {
    await integrationTestServer.setAssetResponse({
      status: 302,
      body: '',
      delayMs: 0,
    });

    const error = await withRequestContext(async (context) =>
      resolveApiBase(context, integrationTestServer.url).catch((caught) => caught),
    );

    expect(error).toBeInstanceOf(EnvGuardError);
    expect((error as EnvGuardError).code).toBe('E_REDIRECT');
    expect((error as EnvGuardError).message).toBe('EnvGuard:E_REDIRECT');
  });

  test('every redirect status (301, 307, 308) maps to E_REDIRECT', async () => {
    for (const status of [301, 307, 308]) {
      await integrationTestServer.setAssetResponse({
        status,
        body: '',
        delayMs: 0,
      });

      const error = await withRequestContext(async (context) =>
        resolveApiBase(context, integrationTestServer.url).catch((caught) => caught),
      );

      expect(error, `status ${status}`).toBeInstanceOf(EnvGuardError);
      expect((error as EnvGuardError).code, `status ${status}`).toBe('E_REDIRECT');
      expect((error as EnvGuardError).message, `status ${status}`).toBe(
        'EnvGuard:E_REDIRECT',
      );
    }
  });

  test('helper and guard classify 3xx identically (both E_REDIRECT)', async () => {
    // Inline server that answers EVERY path with a redirect, so the guard's
    // BUILD_ENV fetch and the helper's .env.e2e fetch both hit a 3xx.
    const redirectEverything = createServer((_req, res) => {
      res.writeHead(302, { Location: '/redirect-target' });
      res.end();
    });
    await new Promise<void>((resolveListen) => {
      redirectEverything.listen(0, '127.0.0.1', resolveListen);
    });
    const address = redirectEverything.address();
    const origin =
      typeof address === 'object' && address !== null
        ? `http://127.0.0.1:${address.port}`
        : '';

    try {
      const guardError = await assertLoopbackBundle(origin).catch((caught) => caught);
      expect(guardError).toBeInstanceOf(EnvGuardError);
      expect((guardError as EnvGuardError).code).toBe('E_REDIRECT');

      const helperError = await withRequestContext((context) =>
        resolveApiBase(context, origin).catch((caught) => caught),
      );
      expect(helperError).toBeInstanceOf(EnvGuardError);
      expect((helperError as EnvGuardError).code).toBe('E_REDIRECT');

      // The F3 invariant: identical classification for identical behavior.
      expect((helperError as EnvGuardError).code).toBe(
        (guardError as EnvGuardError).code,
      );
      expect((helperError as EnvGuardError).message).toBe(
        (guardError as EnvGuardError).message,
      );
    } finally {
      await new Promise<void>((resolveClose) => {
        redirectEverything.close(() => resolveClose());
      });
    }
  });

  test('redirect target is never requested', async () => {
    await integrationTestServer.setAssetResponse({
      status: 302,
      body: '',
      delayMs: 0,
    });

    const initialRedirectTargetCount = integrationTestServer.redirectTargetCount;
    const error = await withRequestContext(async (context) =>
      resolveApiBase(context, integrationTestServer.url).catch((caught) => caught),
    );

    expect(error).toBeInstanceOf(EnvGuardError);
    expect((error as EnvGuardError).code).toBe('E_REDIRECT');
    expect(integrationTestServer.redirectTargetCount).toBe(initialRedirectTargetCount);
    expect(integrationTestServer.lastRequestPath).toBe('/assets/env/.env.e2e');
  });

  test('request timeout (delayed response >5s) returns E_FETCH', async () => {
    await integrationTestServer.setAssetResponse({
      status: 200,
      body: 'API_BASE_URL=http://localhost:3000/api\n',
      delayMs: 10_000,
    });

    const { error, elapsed } = await withRequestContext(async (context) => {
      const start = Date.now();
      const error = await resolveApiBase(context, integrationTestServer.url).catch(
        (caught) => caught,
      );
      return { error, elapsed: Date.now() - start };
    });

    expect(error).toBeInstanceOf(EnvGuardError);
    expect(error.code).toBe('E_FETCH');
    expect(elapsed).toBeLessThan(10_000);
    expect(elapsed).toBeGreaterThanOrEqual(4_000);
  });

  test('HTTP 404 returns E_ASSET_MISSING', async () => {
    await integrationTestServer.setAssetResponse({ status: 404 });
    const error = await withRequestContext(async (context) =>
      resolveApiBase(context, integrationTestServer.url).catch((caught) => caught),
    );

    expect(error).toBeInstanceOf(EnvGuardError);
    expect((error as EnvGuardError).code).toBe('E_ASSET_MISSING');
  });

  test('valid loopback response returns parsed apiBase', async () => {
    await integrationTestServer.setAssetResponse({
      status: 200,
      body: 'API_BASE_URL=http://localhost:3000/api\n',
    });

    const apiBase = await withRequestContext((context) =>
      resolveApiBase(context, integrationTestServer.url),
    );

    expect(apiBase).toBe('http://localhost:3000/api');
  });
});