import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../../repositories/auth.repository';
import { PrismaService } from '../../../../common/prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockAuthRepo: jest.Mocked<AuthRepository>;
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

    mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockPrisma = { $transaction: mockTransaction };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
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
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

      mockAuthRepo.createRefreshToken.mockResolvedValue({} as any);

      const result = await service.register(dto);

      expect(result.accessToken).toBe('access-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.companyId).toBe('comp-1');
      expect(result.user.roles).toEqual(['Admin']);
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
      mockTransaction.mockImplementation(
        (cb: (tx: any) => any) => cb(loginTx),
      );
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
});
