import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { THROTTLER_DEFINITIONS } from '../../../common/config/throttler.config';
import {
  AI_THROTTLE_KEY,
  isAiThrottleRoute,
} from '../decorators/ai-throttle.decorator';

/**
 * Scope tests for the `ai-minute` / `ai-hour` throttler buckets.
 *
 * The guard evaluates every throttler registered in `ThrottlerModule.forRoot()`
 * against every request, so these buckets are scoped with `skipIf` in
 * `common/config/throttler.config.ts` — the single source passed to
 * `ThrottlerModule.forRoot()` in `app.module.ts`.
 *
 * The definitions are imported directly rather than read back from
 * `AppModule`: importing the application graph pulls in ESM-only packages that
 * the project's Jest transform does not process.
 *
 * These tests pin the scope to the `@AIThrottle` marker and lock the existing
 * limits so a future change cannot silently weaken them.
 */

function fakeContext(
  handler: (...args: any[]) => any,
  cls: any,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

/** Stands in for the real @AIThrottle() marker metadata. */
function AIThrottleMarker(): MethodDecorator {
  return (_target, _key, descriptor) => {
    Reflect.defineMetadata(
      AI_THROTTLE_KEY,
      { minuteLimit: 10, hourLimit: 50 },
      descriptor!.value as object,
    );
    return descriptor;
  };
}

interface ThrottlerDefinition {
  name: string;
  ttl: number;
  limit: number;
  skipIf?: (context: ExecutionContext) => boolean;
}

function readThrottlerDefinitions(): ThrottlerDefinition[] {
  return THROTTLER_DEFINITIONS as ThrottlerDefinition[];
}

function bucket(name: string): ThrottlerDefinition {
  const found = readThrottlerDefinitions().find((item) => item.name === name);
  if (!found) {
    throw new Error(`throttler bucket "${name}" is not registered`);
  }
  return found;
}

function skipIfOf(name: string): (context: ExecutionContext) => boolean {
  const fn = bucket(name).skipIf;
  if (typeof fn !== 'function') {
    throw new Error(`throttler bucket "${name}" has no skipIf`);
  }
  return fn;
}

describe('isAiThrottleRoute', () => {
  it('returns true for a handler marked with the AI throttle marker', () => {
    class AiController {
      @AIThrottleMarker()
      chat(): void {}
    }
    expect(
      isAiThrottleRoute(fakeContext(AiController.prototype.chat, AiController)),
    ).toBe(true);
  });

  it('returns false for a handler without the marker', () => {
    class ProductsController {
      create(): void {}
    }
    expect(
      isAiThrottleRoute(
        fakeContext(ProductsController.prototype.create, ProductsController),
      ),
    ).toBe(false);
  });

  it('returns false for a sibling handler that is not marked', () => {
    class AiController {
      @AIThrottleMarker()
      chat(): void {}

      history(): void {}
    }
    expect(
      isAiThrottleRoute(
        fakeContext(AiController.prototype.history, AiController),
      ),
    ).toBe(false);
  });

  it('returns true when the marker is set on the controller class', () => {
    class ScopedAiController {}
    Reflect.defineMetadata(
      AI_THROTTLE_KEY,
      { minuteLimit: 10, hourLimit: 50 },
      ScopedAiController,
    );

    class Handler {
      run(): void {}
    }
    expect(
      isAiThrottleRoute(fakeContext(Handler.prototype.run, ScopedAiController)),
    ).toBe(true);
  });

  it('does not treat undecorated routes as AI routes by name', () => {
    // Pins that scoping uses the marker metadata, not URL/name matching.
    class AIController {
      conversationList(): void {}
    }
    expect(
      isAiThrottleRoute(
        fakeContext(AIController.prototype.conversationList, AIController),
      ),
    ).toBe(false);
  });
});

describe('ai throttler bucket configuration', () => {
  it('keeps general-purpose limits unchanged', () => {
    for (const name of ['short', 'medium', 'long']) {
      expect(bucket(name).skipIf).toBeUndefined();
    }
    expect(bucket('short')).toMatchObject({ ttl: 1000, limit: 10 });
    expect(bucket('medium')).toMatchObject({ ttl: 10000, limit: 50 });
    expect(bucket('long')).toMatchObject({ ttl: 60000, limit: 200 });
  });

  it('keeps AI limits at 10/min and 50/hour', () => {
    expect(bucket('ai-minute')).toMatchObject({ ttl: 60000, limit: 10 });
    expect(bucket('ai-hour')).toMatchObject({ ttl: 3600000, limit: 50 });
  });

  it('scopes both AI buckets with skipIf', () => {
    expect(typeof bucket('ai-minute').skipIf).toBe('function');
    expect(typeof bucket('ai-hour').skipIf).toBe('function');
  });

  it('skipIf skips ordinary routes and does not skip AI routes', () => {
    const skipIf = skipIfOf('ai-minute');

    class AiController {
      @AIThrottleMarker()
      chat(): void {}
    }
    class ProductsController {
      create(): void {}
    }

    expect(
      skipIf(
        fakeContext(ProductsController.prototype.create, ProductsController),
      ),
    ).toBe(true);
    expect(skipIf(fakeContext(AiController.prototype.chat, AiController))).toBe(
      false,
    );
  });

  it('scopes the hour bucket identically to the minute bucket', () => {
    const minute = skipIfOf('ai-minute');
    const hour = skipIfOf('ai-hour');

    class ProductsController {
      create(): void {}
    }
    const ctx = fakeContext(
      ProductsController.prototype.create,
      ProductsController,
    );

    expect(hour(ctx)).toBe(minute(ctx));
  });
});
