import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformOperatorGuard } from '../platform-operator.guard';

/**
 * G16-N-4 P0-A — PlatformOperatorGuard unit contract.
 *
 * The guard is the security boundary for GLOBAL resource mutations. These
 * tests pin the properties the rest of the design depends on:
 *   * it is a no-op on routes without the metadata (so registering it on a
 *     controller cannot affect unrelated endpoints);
 *   * it derives authority ONLY from the environment allowlist;
 *   * email, companyId and tenant RBAC can never satisfy it;
 *   * every abnormal configuration denies.
 */
const OPERATOR = '11111111-1111-4111-8111-111111111111';
const TENANT_ADMIN = '22222222-2222-4222-8222-222222222222';

interface HarnessOptions {
  platformMetadata?: unknown;
  user?: Record<string, unknown> | null;
  operatorUserIds: unknown;
}

/**
 * One Reflector instance is shared by the guard and the stubbed context, so the
 * `@RequirePlatformOperator()` metadata the guard reads is exactly what the
 * test declares.
 */
function makeHarness(options: HarnessOptions) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockReturnValue(options.platformMetadata as never);

  const configGet = jest.fn().mockReturnValue(options.operatorUserIds);
  const guard = new PlatformOperatorGuard(reflector, {
    get: configGet,
  } as never);

  const request: Record<string, unknown> = {};
  if (options.user !== null) request.user = options.user;

  const context = {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;

  return { guard, configGet, context };
}

describe('PlatformOperatorGuard (G16-N-4 P0-A)', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('no-op behaviour', () => {
    it('allows when @RequirePlatformOperator() metadata is absent', () => {
      const { guard, context } = makeHarness({
        platformMetadata: undefined,
        user: {},
        operatorUserIds: [OPERATOR],
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows an unauthenticated request when metadata is absent', () => {
      const { guard, context } = makeHarness({
        platformMetadata: undefined,
        user: null,
        operatorUserIds: [],
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('does not read configuration on an unprotected route', () => {
      const { guard, configGet, context } = makeHarness({
        platformMetadata: undefined,
        user: {},
        operatorUserIds: [OPERATOR],
      });
      guard.canActivate(context);
      expect(configGet).not.toHaveBeenCalled();
    });
  });

  describe('fail-closed configuration handling', () => {
    it.each([
      ['missing namespace (undefined)', undefined],
      ['null', null],
      ['empty allowlist', []],
      ['non-array value', 'not-an-array'],
      ['object value', { ids: [OPERATOR] }],
      ['array of non-strings', [1, 2, 3]],
      ['array of blank strings', ['', '   ']],
    ])('denies when configuration is %s', (_label, configured) => {
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: { userId: OPERATOR },
        operatorUserIds: configured,
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('denies when the principal is absent', () => {
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: null,
        operatorUserIds: [OPERATOR],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('denies when the principal has no userId', () => {
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: { companyId: 'company-1' },
        operatorUserIds: [OPERATOR],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('denies a non-operator authenticated user', () => {
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: { userId: TENANT_ADMIN },
        operatorUserIds: [OPERATOR],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('identity source', () => {
    it('allows an allowlisted userId', () => {
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: { userId: OPERATOR },
        operatorUserIds: [OPERATOR],
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('matches case-insensitively because ids are normalised on parse', () => {
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: { userId: OPERATOR },
        operatorUserIds: [OPERATOR.toUpperCase()],
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('cannot be satisfied by email alone', () => {
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: {
          userId: TENANT_ADMIN,
          email: `${OPERATOR}@example.com`,
          companyId: 'company-1',
        },
        operatorUserIds: [OPERATOR],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('cannot be satisfied by an email that matches an allowlisted email', () => {
      // The allowlist holds user ids; a principal whose email equals that id
      // string is still not the allowlisted principal.
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: { userId: TENANT_ADMIN, email: `${OPERATOR}@example.com` },
        operatorUserIds: [`${OPERATOR}@example.com`],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('cannot be satisfied by companyId', () => {
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: { userId: TENANT_ADMIN, companyId: OPERATOR },
        operatorUserIds: [OPERATOR],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('cannot be satisfied by a role name', () => {
      const { guard, context } = makeHarness({
        platformMetadata: true,
        user: {
          userId: TENANT_ADMIN,
          companyId: 'company-1',
          roles: ['Admin', 'PlatformOperator'],
        },
        operatorUserIds: [OPERATOR],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('never receives a RolePermission lookup dependency', () => {
      const { guard: rawGuard } = makeHarness({
        platformMetadata: true,
        user: { userId: OPERATOR },
        operatorUserIds: [OPERATOR],
      });
      const guard = rawGuard as unknown as {
        constructor: { name: string };
        prismaService?: unknown;
        rolesRepository?: unknown;
      };
      expect(guard.prismaService).toBeUndefined();
      expect(guard.rolesRepository).toBeUndefined();
    });
  });
});
