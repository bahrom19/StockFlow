import 'reflect-metadata';
import { AuthController } from '../auth.controller';

describe('AuthController throttle', () => {
  it('register has explicit @Throttle decorator (3 / 60s)', () => {
    const fn = AuthController.prototype.register;
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', fn);
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', fn);
    expect(limit).toBe(3);
    expect(ttl).toBe(60000);
  });

  it('login has explicit @Throttle decorator (5 / 60s)', () => {
    const fn = AuthController.prototype.login;
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', fn);
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', fn);
    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
  });

  it('register throttle is stricter than login (3 vs 5)', () => {
    const registerLimit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      AuthController.prototype.register,
    );
    const loginLimit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      AuthController.prototype.login,
    );
    expect(registerLimit).toBeLessThan(loginLimit);
  });
});

describe('Password reset throttle', () => {
  it('forgot-password has explicit @Throttle decorator (3 / 60s)', () => {
    const fn = AuthController.prototype.forgotPassword;
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', fn);
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', fn);
    expect(limit).toBe(3);
    expect(ttl).toBe(60000);
  });

  it('reset-password has explicit @Throttle decorator (5 / 60s)', () => {
    const fn = AuthController.prototype.resetPassword;
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', fn);
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', fn);
    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
  });

  it('forgot-password throttle is stricter than reset-password (3 vs 5)', () => {
    const forgotLimit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      AuthController.prototype.forgotPassword,
    );
    const resetLimit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      AuthController.prototype.resetPassword,
    );
    expect(forgotLimit).toBeLessThan(resetLimit);
  });
});

describe('Swagger secure default (F-04)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SWAGGER_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function loadSwaggerConfig() {
    jest.resetModules();
    const { swaggerConfig } = await import(
      '../../../../common/config/swagger.config'
    );
    return swaggerConfig();
  }

  it('swagger is disabled by default when env var is unset', async () => {
    const config = await loadSwaggerConfig();
    expect(config.enabled).toBe(false);
  });

  it('swagger can be enabled via SWAGGER_ENABLED=true', async () => {
    process.env.SWAGGER_ENABLED = 'true';
    const config = await loadSwaggerConfig();
    expect(config.enabled).toBe(true);
  });
});
