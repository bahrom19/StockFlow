import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  getOptionsToken,
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { AIThrottle } from '../../../modules/ai/decorators/ai-throttle.decorator';
import { THROTTLER_DEFINITIONS } from '../throttler.config';

/**
 * Behaviour tests for the real `ThrottlerGuard` against `THROTTLER_DEFINITIONS`.
 *
 * `ai-throttle-scope.spec.ts` only asserts that `skipIf` is *called* with the
 * right answer. These tests drive the actual guard loop — per-throttler
 * `skipIf`, `handleRequest`, the real in-memory storage and the real
 * `@AIThrottle()` key generator — and identify the blocking bucket through the
 * `Retry-After-<name>` header the guard sets before throwing.
 *
 * No HTTP layer, database or Docker: `supertest` is not a project dependency,
 * and `ThrottlerStorageService` is an in-memory `Map`.
 */

const CLIENT_IP = '127.0.0.1';

/** `short` is 10 req/s, so pacing keeps its sliding window under the limit. */
const PACE_MS = 150;
/** `short` ttl is 1s; this clears it so only long-lived buckets can block. */
const CLEAR_SHORT_MS = 1100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  // Required: populates `throttlers` / `commonOptions` from the options array.
  await guard.onModuleInit();
  const increment = jest.spyOn(storage, 'increment');
  const consumed = () => increment.mock.calls.map((call) => call[4]);
  return { guard, storage, consumed };
}

function makeContext(handler: (...args: any[]) => any, cls: any, userId?: string) {
  const req: Record<string, any> = { ip: CLIENT_IP, headers: {} };
  if (userId !== undefined) {
    req.user = { userId };
  }
  const header = jest.fn();
  const context = {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ header }),
    }),
  } as unknown as ExecutionContext;
  return { context, header };
}

class ProductsController {
  create(): void {}
}

class AiController {
  @AIThrottle()
  chat(): void {}
}

describe('ThrottlerGuard behaviour with THROTTLER_DEFINITIONS', () => {
  it('S1: ordinary routes never consume the AI buckets', async () => {
    const { guard, consumed } = await createGuard();
    const { context } = makeContext(ProductsController.prototype.create, ProductsController);

    // 15 requests is more than the 10/min AI budget. Paced so that only the
    // AI buckets could block; `short` stays under its own limit.
    const results: boolean[] = [];
    for (let i = 0; i < 15; i++) {
      if (i > 0) await sleep(PACE_MS);
      results.push(await guard.canActivate(context));
    }

    expect(results.every(Boolean)).toBe(true);
    expect(new Set(consumed())).toEqual(new Set(['short', 'medium', 'long']));
    expect(consumed()).not.toContain('ai-minute');
    expect(consumed()).not.toContain('ai-hour');
  });

  it('S2: an AI route is blocked by ai-minute on the 11th request', async () => {
    const { guard } = await createGuard();
    const { context, header } = makeContext(
      AiController.prototype.chat,
      AiController,
      'user-A',
    );

    for (let i = 0; i < 10; i++) {
      expect(await guard.canActivate(context)).toBe(true);
    }

    // Clears `short` so ai-minute is the only bucket that can block.
    await sleep(CLEAR_SHORT_MS);
    await expect(guard.canActivate(context)).rejects.toThrow(ThrottlerException);
    expect(header).toHaveBeenCalledWith('Retry-After-ai-minute', expect.anything());
  });

  it('S3: the short bucket still limits ordinary routes', async () => {
    const { guard, consumed } = await createGuard();
    const { context, header } = makeContext(
      ProductsController.prototype.create,
      ProductsController,
    );

    for (let i = 0; i < 10; i++) {
      expect(await guard.canActivate(context)).toBe(true);
    }

    await expect(guard.canActivate(context)).rejects.toThrow(ThrottlerException);
    expect(header).toHaveBeenCalledWith('Retry-After-short', expect.anything());
    expect(consumed()).not.toContain('ai-minute');
  });

  it('S4: AI limits are isolated per user by the @AIThrottle key', async () => {
    const { guard } = await createGuard();
    const userA = makeContext(AiController.prototype.chat, AiController, 'user-A');
    const userB = makeContext(AiController.prototype.chat, AiController, 'user-B');

    for (let i = 0; i < 10; i++) {
      expect(await guard.canActivate(userA.context)).toBe(true);
    }
    await sleep(CLEAR_SHORT_MS);

    // user-A exhausted its own 10/min budget.
    await expect(guard.canActivate(userA.context)).rejects.toThrow(ThrottlerException);

    // user-B has a separate key (`user:<id>`) and is unaffected.
    expect(await guard.canActivate(userB.context)).toBe(true);
  });

  it('S5: forRoot receives exactly the five configured buckets', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(THROTTLER_DEFINITIONS)],
    }).compile();

    const registered = moduleRef.get<any>(getOptionsToken());
    expect(registered).toEqual(THROTTLER_DEFINITIONS);
    expect(registered.map((bucket: any) => bucket.name).sort()).toEqual([
      'ai-hour',
      'ai-minute',
      'long',
      'medium',
      'short',
    ]);
    await moduleRef.close();
  });

  it('S5: the guard consumes those buckets with the expected limits', async () => {
    const { guard } = await createGuard();
    const buckets = (guard as any).throttlers as Array<{
      name: string;
      ttl: number;
      limit: number;
      skipIf?: (ctx: ExecutionContext) => boolean;
    }>;

    const find = (name: string) => buckets.find((bucket) => bucket.name === name)!;

    expect(find('short')).toMatchObject({ ttl: 1000, limit: 10 });
    expect(find('medium')).toMatchObject({ ttl: 10000, limit: 50 });
    expect(find('long')).toMatchObject({ ttl: 60000, limit: 200 });
    expect(find('ai-minute')).toMatchObject({ ttl: 60000, limit: 10 });
    expect(find('ai-hour')).toMatchObject({ ttl: 3600000, limit: 50 });

    expect(find('short').skipIf).toBeUndefined();
    expect(find('medium').skipIf).toBeUndefined();
    expect(find('long').skipIf).toBeUndefined();
    expect(typeof find('ai-minute').skipIf).toBe('function');
    expect(typeof find('ai-hour').skipIf).toBe('function');
  });
});
