import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * G16-Y: production CORS contract.
 *
 * T1-T2 prove the ConfigService mapping (single source of truth
 * `app.corsOrigin`, no wildcard default in the factory).
 * T3-T7 prove the fail-closed Joi rule (required in production only).
 * T8 is a source guard on main.ts because bootstrap() runs as a top-level
 * side effect and cannot be imported into Jest directly.
 */
describe('CORS_ORIGIN contract (G16-Y)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CORS_ORIGIN;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function loadAppConfig() {
    jest.resetModules();
    const { appConfig } = await import('../app.config');
    return appConfig();
  }

  async function loadSchema() {
    jest.resetModules();
    const { envValidationSchema } = await import('../env.validation');
    return envValidationSchema;
  }

  /** Minimal env satisfying the pre-existing required rules of the schema. */
  function baseEnv(overrides: Record<string, string> = {}) {
    return {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'test-secret-16-chars-min',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      ...overrides,
    };
  }

  function corsErrorReferences(
    details?: Array<{ path: ReadonlyArray<string | number>; message: string }>,
  ) {
    return (details ?? []).some(
      (d) =>
        d.path.join('.') === 'CORS_ORIGIN' || d.message.includes('CORS_ORIGIN'),
    );
  }

  // ── T1: exact mapping ─────────────────────────────────────
  it('T1: maps CORS_ORIGIN to app.corsOrigin verbatim', async () => {
    process.env.CORS_ORIGIN = 'https://x.example.com';
    const config = await loadAppConfig();
    expect(config.corsOrigin).toBe('https://x.example.com');
  });

  // ── T2: no wildcard default in the factory ────────────────
  it('T2: leaves corsOrigin undefined when CORS_ORIGIN is absent (never "*")', async () => {
    const config = await loadAppConfig();
    expect(config.corsOrigin).toBeUndefined();
    expect(config.corsOrigin).not.toBe('*');
  });

  // ── T3: production missing -> fail closed ─────────────────
  it('T3: production without CORS_ORIGIN fails validation, referencing CORS_ORIGIN', async () => {
    const schema = await loadSchema();
    const { error } = schema.validate(baseEnv({ NODE_ENV: 'production' }), {
      abortEarly: false,
      allowUnknown: true,
    });
    expect(error).toBeDefined();
    expect(corsErrorReferences(error?.details)).toBe(true);
  });

  // ── T4: production valid -> pass ──────────────────────────
  it('T4: production with a valid CORS_ORIGIN passes validation', async () => {
    const schema = await loadSchema();
    const { error } = schema.validate(
      baseEnv({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com',
      }),
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeUndefined();
  });

  // ── T5: development missing -> pass ───────────────────────
  it('T5: development without CORS_ORIGIN passes validation', async () => {
    const schema = await loadSchema();
    const { error } = schema.validate(baseEnv(), {
      abortEarly: false,
      allowUnknown: true,
    });
    expect(error).toBeUndefined();
  });

  // ── T6: production invalid URI -> fail ────────────────────
  it('T6: production with a non-URI CORS_ORIGIN fails validation', async () => {
    const schema = await loadSchema();
    const { error } = schema.validate(
      baseEnv({ NODE_ENV: 'production', CORS_ORIGIN: 'not a uri' }),
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeDefined();
    expect(corsErrorReferences(error?.details)).toBe(true);
  });

  // ── T7: production empty -> fail ──────────────────────────
  it('T7: production with an empty CORS_ORIGIN fails validation', async () => {
    const schema = await loadSchema();
    const { error } = schema.validate(
      baseEnv({ NODE_ENV: 'production', CORS_ORIGIN: '' }),
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeDefined();
    expect(corsErrorReferences(error?.details)).toBe(true);
  });

  // ── T8: source guard on main.ts ───────────────────────────
  // main.ts executes `void bootstrap()` at import time, so the production
  // branch is pinned at source level (project precedent: supplementary
  // source guards in billing-cron / overdue-notification specs).
  it('T8: main.ts production branch is fail-closed (no "*" fallback, "?? false" present)', () => {
    const mainSrc = readFileSync(
      join(__dirname, '..', '..', '..', 'main.ts'),
      'utf8',
    );
    // The old defect: configService.get<string>('app.corsOrigin', '*')
    expect(mainSrc).not.toMatch(/app\.corsOrigin',\s*'\*'/);
    // Defense-in-depth: missing value disables CORS instead of wildcarding
    expect(mainSrc).toContain('?? false');
  });
});
