import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { THROTTLER_DEFINITIONS } from '../../../../common/config/throttler.config';
import { AuthController } from '../auth.controller';

/**
 * Enforcement contract for the auth rate limits.
 *
 * The previous version of this spec asserted that
 * `Reflect.getMetadata('THROTTLER:LIMITdefault', …)` existed. That passes even
 * when the guard never reads the value, because the application registers
 * `short`/`medium`/`long` and no bucket named `default` — so it provided no
 * protection at all.
 *
 * These tests instead drive the real `ThrottlerGuard` with the real bucket
 * definitions and the real `AuthController` metadata, and assert the observable
 * outcome: N requests pass, request N+1 throws `ThrottlerException`, and the
 * blocking bucket is identified from the `Retry-After-<name>` header the guard
 * sets before throwing.
 */

const CLIENT_IP = '203.0.113.10';
const OTHER_IP = '198.51.100.20';

const openStorages: ThrottlerStorageService[] = [];

afterEach(() => {
  while (openStorages.length > 0) {
    openStorages.pop()!.onApplicationShutdown();
  }
});

async function createGuard() {
  const storage = new ThrottlerStorageService();
  openStorages.push(storage);
  const guard = new ThrottlerGuard(THROTTLER_DEFINITIONS, storage, new Reflector());
  // Required: populates `throttlers` / `commonOptions` from the definitions.
  await guard.onModuleInit();
  return { guard, storage };
}

function makeContext(handler: (...args: any[]) => any, ip: string) {
  const req: Record<string, any> = { ip, headers: {} };
  const header = jest.fn();
  const context = {
    getHandler: () => handler,
    getClass: () => AuthController,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ header }),
    }),
  } as unknown as ExecutionContext;
  return { context, header };
}

/** Runs `limit` allowed requests, then one that must be rejected. */
async function expectBlockedAfter(
  guard: ThrottlerGuard,
  handler: (...args: any[]) => any,
  limit: number,
  ip: string,
) {
  const { context, header } = makeContext(handler, ip);
  for (let i = 0; i < limit; i++) {
    await expect(guard.canActivate(context)).resolves.toBe(true);
  }
  await expect(guard.canActivate(context)).rejects.toThrow(ThrottlerException);
  return header;
}

describe('auth route rate limits (enforcement)', () => {
  it('login allows 20 requests per minute and rejects the 21st', async () => {
    const { guard } = await createGuard();
    await expectBlockedAfter(guard, AuthController.prototype.login, 20, CLIENT_IP);
  });

  it('register allows 5 requests per minute and rejects the 6th', async () => {
    const { guard } = await createGuard();
    await expectBlockedAfter(guard, AuthController.prototype.register, 5, CLIENT_IP);
  });

  it('forgot-password allows 5 requests per minute and rejects the 6th', async () => {
    const { guard } = await createGuard();
    await expectBlockedAfter(
      guard,
      AuthController.prototype.forgotPassword,
      5,
      CLIENT_IP,
    );
  });

  it('reset-password allows 10 requests per minute and rejects the 11th', async () => {
    const { guard } = await createGuard();
    await expectBlockedAfter(
      guard,
      AuthController.prototype.resetPassword,
      10,
      CLIENT_IP,
    );
  });

  it('dev-reset-token is rate limited and rejects the 11th request', async () => {
    const { guard } = await createGuard();
    await expectBlockedAfter(
      guard,
      AuthController.prototype.devGetResetToken,
      10,
      CLIENT_IP,
    );
  });

  it('refresh allows 30 requests per minute and rejects the 31st', async () => {
    const { guard } = await createGuard();
    await expectBlockedAfter(guard, AuthController.prototype.refresh, 30, CLIENT_IP);
  });

  it('logout allows 30 requests per minute and rejects the 31st', async () => {
    const { guard } = await createGuard();
    await expectBlockedAfter(guard, AuthController.prototype.logout, 30, CLIENT_IP);
  });

  it('reports the blocking bucket through a suffixed Retry-After header', async () => {
    const { guard } = await createGuard();
    const header = await expectBlockedAfter(
      guard,
      AuthController.prototype.login,
      20,
      CLIENT_IP,
    );
    // Which bucket blocks depends on the request pattern: a burst inside one
    // second is stopped by `short`, while a sustained stream is stopped by the
    // 60s `long` bucket. Both enforce the same per-minute ceiling, and the
    // guard always names the bucket through the suffix.
    const retryHeaders = header.mock.calls
      .map((call) => call[0])
      .filter((name: string) => name.startsWith('Retry-After'));

    expect(retryHeaders).toHaveLength(1);
    expect(retryHeaders[0]).toMatch(/^Retry-After-(short|medium|long)$/);
  });

  it('does not emit a bare Retry-After header (library emits suffixed only)', async () => {
    const { guard } = await createGuard();
    const header = await expectBlockedAfter(
      guard,
      AuthController.prototype.login,
      20,
      CLIENT_IP,
    );
    expect(header).not.toHaveBeenCalledWith('Retry-After', expect.anything());
  });

  it('scopes the limit per IP: another source is unaffected', async () => {
    const { guard } = await createGuard();
    await expectBlockedAfter(guard, AuthController.prototype.login, 20, CLIENT_IP);

    const other = makeContext(AuthController.prototype.login, OTHER_IP);
    for (let i = 0; i < 20; i++) {
      await expect(guard.canActivate(other.context)).resolves.toBe(true);
    }
  });

  it('scopes the limit per route: exhausting login does not throttle register', async () => {
    const { guard } = await createGuard();
    await expectBlockedAfter(guard, AuthController.prototype.login, 20, CLIENT_IP);

    const register = makeContext(AuthController.prototype.register, CLIENT_IP);
    for (let i = 0; i < 5; i++) {
      await expect(guard.canActivate(register.context)).resolves.toBe(true);
    }
  });

  it('does not throttle AI buckets on auth routes', async () => {
    // `ai-minute` / `ai-hour` carry `skipIf`; auth routes must keep their own
    // higher budget rather than inheriting the 10/min AI ceiling.
    const { guard } = await createGuard();
    const { context } = makeContext(AuthController.prototype.login, CLIENT_IP);
    for (let i = 0; i < 20; i++) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }
  });
});
