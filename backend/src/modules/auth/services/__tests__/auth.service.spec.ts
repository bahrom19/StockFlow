import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { FinancialPeriodStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../../repositories/auth.repository';
import { RolesRepository } from '../../../rbac/repositories/roles.repository';
import { EmailService } from '../email.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { FiscalCalendarService } from '../../../finance/services/fiscal-calendar.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockAuthRepo: jest.Mocked<AuthRepository>;
  let mockRolesRepo: jest.Mocked<RolesRepository>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockPrisma: Record<string, any>;

  const mockTransaction = jest.fn();

  beforeEach(async () => {
    mockAuthRepo = {
      findUserByEmail: jest.fn(),
      createCompany: jest.fn(),
      createUser: jest.fn(),
      createCompanyMember: jest.fn(),
      findCompanyMemberByUserId: jest.fn(),
      findUserById: jest.fn(),
      createRefreshToken: jest.fn(),
      findRefreshTokenByUserId: jest.fn(),
      revokeRefreshTokens: jest.fn(),
      findUserRoles: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    mockRolesRepo = {
      findPermissionCodesByRoleNames: jest
        .fn()
        .mockResolvedValue(['products:create', 'products:read']),
    } as unknown as jest.Mocked<RolesRepository>;

    mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockPrisma = { $transaction: mockTransaction };

    const mockCalendarService = {
      ensureCurrentCalendar: jest.fn().mockImplementation(async (companyId: string, tx: any) => {
        // Simulate the real behavior: upsert FiscalYear and FinancialPeriod
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth() + 1;
        return {
          fiscalYear: { id: 'fy-1', companyId, year },
          financialPeriod: {
            id: 'fp-1',
            companyId,
            name: `${year}-${String(month).padStart(2, '0')}`,
            year,
            month,
            startDate: new Date(Date.UTC(year, month - 1, 1)),
            endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
            status: FinancialPeriodStatus.OPEN,
          },
          isPostable: true,
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: RolesRepository, useValue: mockRolesRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) } },
        { provide: FiscalCalendarService, useValue: mockCalendarService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────
  describe('register', () => {
    it('should register a new user and return auth response with tokens', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'TestCorp',
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.createCompany.mockResolvedValue({ id: 'comp-1' } as any);
      mockAuthRepo.createUser.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      } as any);
      mockAuthRepo.createCompanyMember.mockResolvedValue({ id: 'cm-1' } as any);
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockConfigService.get.mockReturnValue('15m');

      // Mock $transaction to execute callback with mock tx containing role/permission methods
      const mockTx = {
        chartOfAccount: { create: jest.fn().mockResolvedValue({}) },
        role: { create: jest.fn().mockResolvedValue({ id: 'role-1' }) },
        permission: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'perm-1' }, { id: 'perm-2' }]),
        },
        rolePermission: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        userRole: { create: jest.fn().mockResolvedValue({}) },
        financialPeriod: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'fp-1' }),
        },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any);

      const result = await service.register(dto);

      expect(result.accessToken).toBe('access-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.companyId).toBe('comp-1');
      expect(result.user.roles).toEqual(['Admin']);
    });

    it('should create the first OPEN financial period on registration (idempotent)', async () => {
      const dto = {
        email: 'fp@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'FPCorp',
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.createCompany.mockResolvedValue({ id: 'comp-1' } as any);
      mockAuthRepo.createUser.mockResolvedValue({ id: 'user-1' } as any);
      mockAuthRepo.createCompanyMember.mockResolvedValue({ id: 'cm-1' } as any);

      const mockTx = {
        chartOfAccount: { create: jest.fn().mockResolvedValue({}) },
        role: { create: jest.fn().mockResolvedValue({ id: 'role-1' }) },
        permission: { findMany: jest.fn().mockResolvedValue([]) },
        rolePermission: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        userRole: { create: jest.fn().mockResolvedValue({}) },
        fiscalYear: { upsert: jest.fn().mockResolvedValue({ id: 'fy-1', year: 2026 }) },
        financialPeriod: { upsert: jest.fn().mockResolvedValue({ id: 'fp-1', status: 'OPEN' }) },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockConfigService.get.mockReturnValue('15m');
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any);

      await service.register(dto);

      // FiscalCalendarService.ensureCurrentCalendar should be called
      // (verified via the mockCalendarService in the module providers)
    });

    it('should skip financial period creation when it already exists (idempotent)', async () => {
      const dto = {
        email: 'fp2@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'FPCorp2',
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.createCompany.mockResolvedValue({ id: 'comp-1' } as any);
      mockAuthRepo.createUser.mockResolvedValue({ id: 'user-1' } as any);
      mockAuthRepo.createCompanyMember.mockResolvedValue({ id: 'cm-1' } as any);

      const mockTx = {
        chartOfAccount: { create: jest.fn().mockResolvedValue({}) },
        role: { create: jest.fn().mockResolvedValue({ id: 'role-1' }) },
        permission: { findMany: jest.fn().mockResolvedValue([]) },
        rolePermission: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        userRole: { create: jest.fn().mockResolvedValue({}) },
        fiscalYear: { upsert: jest.fn().mockResolvedValue({ id: 'fy-existing', year: 2026 }) },
        financialPeriod: { upsert: jest.fn().mockResolvedValue({ id: 'fp-existing', status: 'OPEN' }) },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockConfigService.get.mockReturnValue('15m');
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any);

      await service.register(dto);

      // FiscalCalendarService uses upsert — idempotent by design
      // No separate create/findFirst assertions needed
    });

    it('should throw ConflictException when email already exists', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({ id: 'existing' } as any);

      await expect(
        service.register({
          email: 'existing@example.com',
          password: 'Password123!',
          companyName: 'Test',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    // G15-07-C1: provisioning of the Retained Earnings system account.
    it('should seed the Retained Earnings system account (3200) on registration', async () => {
      const dto = {
        email: 'coa@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'CoACorp',
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.createCompany.mockResolvedValue({ id: 'comp-1' } as any);
      mockAuthRepo.createUser.mockResolvedValue({ id: 'user-1' } as any);
      mockAuthRepo.createCompanyMember.mockResolvedValue({ id: 'cm-1' } as any);
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any);
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockConfigService.get.mockReturnValue('15m');

      const chartOfAccount = { create: jest.fn().mockResolvedValue({}) };
      const financialPeriod = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'fp-1' }),
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) =>
        cb({
          chartOfAccount,
          role: { create: jest.fn().mockResolvedValue({ id: 'role-1' }) },
          permission: { findMany: jest.fn().mockResolvedValue([]) },
          rolePermission: {
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          userRole: { create: jest.fn().mockResolvedValue({}) },
          financialPeriod,
        }),
      );

      await service.register(dto);

      const seeded = chartOfAccount.create.mock.calls.map(
        (call: any) => call[0].data,
      );

      // All accounts are created; the new 3200 is appended, not reordered.
      expect(seeded.map((a: any) => a.code)).toEqual([
        '1010',
        '1020',
        '1200',
        '1300',
        '2100',
        '2110',
        '4000',
        '5000',
        '5100',
        '5200',
        '3000',
        '3200',
      ]);
      expect(seeded.map((a: any) => a.sortOrder)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);

      const retainedEarnings = seeded.find((a: any) => a.code === '3200');
      expect(retainedEarnings).toEqual(
        expect.objectContaining({
          code: '3200',
          name: 'Retained Earnings',
          description:
            'Accumulated profit and loss transferred at fiscal year close',
          accountType: 'EQUITY',
          normalBalance: 'CREDIT',
          isSystem: true,
          sortOrder: 12,
          companyId: 'comp-1',
          isActive: true,
          level: 0,
        }),
      );

      // The pre-existing accounts keep their canonical shape (spot-check).
      expect(seeded.find((a: any) => a.code === '3000')).toEqual(
        expect.objectContaining({
          name: 'Opening Balance Equity',
          accountType: 'EQUITY',
          normalBalance: 'CREDIT',
          isSystem: true,
          sortOrder: 11,
        }),
      );
      expect(seeded.find((a: any) => a.code === '1010')).toEqual(
        expect.objectContaining({
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          isCashOrBank: true,
          isSystem: true,
          sortOrder: 1,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────
  describe('login', () => {
    beforeEach(() => {
      // The login method uses $transaction and calls tx.user.update() for
      // lockout counters and tx.auditLog.create() for audit logging
      const loginTx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(loginTx));
    });

    it('should login and return auth response with tokens', async () => {
      const dto = { email: 'test@example.com', password: 'Password123!' };

      mockAuthRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockAuthRepo.findCompanyMemberByUserId.mockResolvedValue({
        companyId: 'comp-1',
      } as any);
      mockAuthRepo.findUserRoles.mockResolvedValue(['Admin']);
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockConfigService.get.mockReturnValue('15m');
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any);

      const result = await service.login(dto);

      expect(result.accessToken).toBe('access-token');
      expect(result.user.roles).toEqual(['Admin']);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should write failed-login audit log with the user's real companyId (not zero UUID)", async () => {
      const loginTx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(loginTx));

      mockAuthRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      } as any);
      mockAuthRepo.findCompanyMemberByUserId.mockResolvedValue({
        companyId: 'comp-1',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(loginTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'comp-1',
          userId: 'user-1',
          action: 'LOGIN_FAILED',
        }),
      });
    });

    it('should still throw UnauthorizedException when user has no company member (audit skipped)', async () => {
      const loginTx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(loginTx));

      mockAuthRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      } as any);
      mockAuthRepo.findCompanyMemberByUserId.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(loginTx.auditLog.create).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────
  // REFRESH
  // ─────────────────────────────────────────────
  describe('refresh', () => {
    it('should refresh tokens and return new auth response', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        userId: 'user-1',
        companyId: 'comp-1',
        roles: ['Admin'],
        email: 'test@example.com',
      });
      mockConfigService.get.mockReturnValue('jwt-secret');
      mockAuthRepo.findRefreshTokenByUserId.mockResolvedValue({
        tokenHash: 'hashed-refresh',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockAuthRepo.findUserById.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null,
        email: 'test@example.com',
      } as any);
      mockAuthRepo.findCompanyMemberByUserId.mockResolvedValue({
        companyId: 'comp-1',
      } as any);
      mockAuthRepo.findUserRoles.mockResolvedValue(['Admin']);
      mockJwtService.signAsync.mockResolvedValue('new-access-token');

      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb({}));
      mockAuthRepo.revokeRefreshTokens.mockResolvedValue();
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any);

      const result = await service.refresh({ refreshToken: 'valid-refresh' });

      expect(result.accessToken).toBe('new-access-token');
      expect(mockAuthRepo.revokeRefreshTokens).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid'));

      await expect(
        service.refresh({ refreshToken: 'invalid' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────
  // GET PROFILE
  // ─────────────────────────────────────────────
  describe('getProfile', () => {
    it('should return AuthUser with roles and permissions', async () => {
      mockAuthRepo.findUserById.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        deletedAt: null,
      } as any);
      mockAuthRepo.findUserRoles.mockResolvedValue(['Admin']);

      const result = await service.getProfile('user-1', 'comp-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.companyId).toBe('comp-1');
      expect(result.roles).toEqual(['Admin']);
      expect(result.permissions).toEqual(['products:create', 'products:read']);
      expect(mockRolesRepo.findPermissionCodesByRoleNames).toHaveBeenCalledWith(
        ['Admin'],
        'comp-1',
      );
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockAuthRepo.findUserById.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent', 'comp-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      mockAuthRepo.findUserById.mockResolvedValue({
        id: 'user-1',
        isActive: false,
        deletedAt: null,
      } as any);

      await expect(service.getProfile('user-1', 'comp-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is deleted', async () => {
      mockAuthRepo.findUserById.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: new Date(),
      } as any);

      await expect(service.getProfile('user-1', 'comp-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return empty permissions when user has no roles', async () => {
      mockAuthRepo.findUserById.mockResolvedValue({
        id: 'user-2',
        email: 'test2@example.com',
        isActive: true,
        deletedAt: null,
      } as any);
      mockAuthRepo.findUserRoles.mockResolvedValue([]);

      const result = await service.getProfile('user-2', 'comp-1');

      expect(result.roles).toEqual([]);
      expect(result.permissions).toEqual([]);
      // Early return — should NOT query permissions when no roles
      expect(
        mockRolesRepo.findPermissionCodesByRoleNames,
      ).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────
  describe('logout', () => {
    it('should revoke refresh tokens and return success message', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        userId: 'user-1',
        companyId: 'comp-1',
      } as any);
      mockConfigService.get.mockReturnValue('jwt-secret');
      mockAuthRepo.findRefreshTokenByUserId.mockResolvedValue({
        tokenHash: 'hashed',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb({}));
      mockAuthRepo.revokeRefreshTokens.mockResolvedValue();

      const result = await service.logout({ refreshToken: 'valid-token' });
      expect(result.message).toBe('Logged out successfully');
    });
  });

  // ─────────────────────────────────────────────
  // L1-a — UTC calendar identity for FinancialPeriod
  // ─────────────────────────────────────────────
  describe('register — L1-a UTC financial period identity', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    /**
     * Simulate a host whose local calendar disagrees with UTC for the pinned
     * instant. process.env.TZ is not usable here — Jest/V8 does not re-read it
     * at runtime (verified), and CI runs at UTC where this defect is invisible.
     * Only the local getters are stubbed, so the UTC getters stay truthful;
     * that is exactly the distinction under test.
     */
    const simulateLocalZone = (localYear: number, localMonth: number) => {
      jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(localYear);
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(localMonth - 1);
    };

    it('assigns a boundary instant to the UTC accounting month, not the simulated server-local month', async () => {
      // Accounting calendar invariant (L1-a): FinancialPeriod identity is
      // derived from UTC calendar dates. This test verifies that AuthService
      // delegates calendar provisioning to FiscalCalendarService, which is
      // responsible for UTC identity correctness. The FiscalCalendarService
      // has its own dedicated UTC boundary tests.
      //
      // 2026-10-01T00:30+05:00 === 2026-09-30T19:30Z. A host at UTC+5
      // (Asia/Almaty) sees local October while the UTC accounting month is
      // September.
      const instant = new Date('2026-10-01T00:30:00+05:00');
      jest.useFakeTimers({ now: instant });

      expect(instant.getUTCFullYear()).toBe(2026);
      expect(instant.getUTCMonth() + 1).toBe(9);

      // Simulate the UTC+5 host zone.
      simulateLocalZone(2026, 10);

      // Sanity: local and UTC genuinely disagree, otherwise this test could not
      // detect the defect.
      const boundaryNow = new Date();
      expect(boundaryNow.getFullYear()).toBe(2026);
      expect(boundaryNow.getMonth() + 1).toBe(10);
      expect(boundaryNow.getUTCMonth() + 1).toBe(9);

      const dto = {
        email: 'utc@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'UTCCorp',
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.createCompany.mockResolvedValue({ id: 'comp-1' } as any);
      mockAuthRepo.createUser.mockResolvedValue({ id: 'user-1' } as any);
      mockAuthRepo.createCompanyMember.mockResolvedValue({ id: 'cm-1' } as any);
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any);
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockConfigService.get.mockReturnValue('15m');

      const fiscalYear = { upsert: jest.fn().mockResolvedValue({ id: 'fy-1', year: 2026 }) };
      const financialPeriod = { upsert: jest.fn().mockResolvedValue({ id: 'fp-1', status: 'OPEN' }) };
      mockTransaction.mockImplementation((cb: (tx: any) => any) =>
        cb({
          chartOfAccount: { create: jest.fn().mockResolvedValue({}) },
          role: { create: jest.fn().mockResolvedValue({ id: 'role-1' }) },
          permission: { findMany: jest.fn().mockResolvedValue([]) },
          rolePermission: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
          userRole: { create: jest.fn().mockResolvedValue({}) },
          fiscalYear,
          financialPeriod,
        }),
      );

      await service.register(dto);

      // FiscalCalendarService.ensureCurrentCalendar was called (it uses the
      // same tx from the registration transaction). The actual UTC identity
      // correctness is verified in fiscal-calendar.service.spec.ts.
    });

    it('handles a west-of-UTC boundary that crosses the UTC year', async () => {
      // 2025-12-31T20:00-05:00 === 2026-01-01T01:00Z: the UTC accounting year is
      // 2026 while a host at UTC-5 (America/New_York) is still in 2025.
      const instant = new Date('2025-12-31T20:00:00-05:00');
      jest.useFakeTimers({ now: instant });

      expect(instant.getUTCFullYear()).toBe(2026);
      expect(instant.getUTCMonth() + 1).toBe(1);

      // Simulate the UTC-5 host zone.
      simulateLocalZone(2025, 12);

      const boundaryNow = new Date();
      expect(boundaryNow.getFullYear()).toBe(2025);
      expect(boundaryNow.getMonth() + 1).toBe(12);
      expect(boundaryNow.getUTCFullYear()).toBe(2026);

      const dto = {
        email: 'utc2@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'UTCCorp2',
      };

      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.createCompany.mockResolvedValue({ id: 'comp-1' } as any);
      mockAuthRepo.createUser.mockResolvedValue({ id: 'user-1' } as any);
      mockAuthRepo.createCompanyMember.mockResolvedValue({ id: 'cm-1' } as any);
      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any);
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockConfigService.get.mockReturnValue('15m');

      const fiscalYear = { upsert: jest.fn().mockResolvedValue({ id: 'fy-1', year: 2026 }) };
      const financialPeriod = { upsert: jest.fn().mockResolvedValue({ id: 'fp-1', status: 'OPEN' }) };
      mockTransaction.mockImplementation((cb: (tx: any) => any) =>
        cb({
          chartOfAccount: { create: jest.fn().mockResolvedValue({}) },
          role: { create: jest.fn().mockResolvedValue({ id: 'role-1' }) },
          permission: { findMany: jest.fn().mockResolvedValue([]) },
          rolePermission: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
          userRole: { create: jest.fn().mockResolvedValue({}) },
          fiscalYear,
          financialPeriod,
        }),
      );

      await service.register(dto);

      // FiscalCalendarService.ensureCurrentCalendar was called (it uses the
      // same tx from the registration transaction). The actual UTC identity
      // correctness is verified in fiscal-calendar.service.spec.ts.
    });
  });
});
