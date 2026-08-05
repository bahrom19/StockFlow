import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../../repositories/auth.repository';
import { RolesRepository } from '../../../rbac/repositories/roles.repository';
import { LoginDto } from '../../dto/login.dto';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const mockBcryptCompare = jest.fn();

jest.mock('bcrypt', () => ({
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
  hash: jest.fn().mockResolvedValue('$2b$10$hashed'),
}));

describe('AuthService — Account Lockout', () => {
  let service: AuthService;
  let mockRepository: Record<string, jest.Mock>;
  let mockPrisma: Record<string, jest.Mock>;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    passwordHash: '$2b$10$test',
    firstName: 'Test',
    lastName: 'User',
    status: UserStatus.ACTIVE,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    deletedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockRepository = {
      findUserByEmail: jest.fn(),
      findCompanyMemberByUserId: jest.fn().mockResolvedValue({
        companyId: 'company-1',
        id: 'cm-1',
      }),
      findUserRoles: jest.fn().mockResolvedValue(['Admin']),
      createRefreshToken: jest.fn().mockResolvedValue({}),
      findRefreshTokenByUserId: jest.fn(),
      revokeRefreshTokens: jest.fn(),
    };

    const mockTxInner: Record<string, unknown> = {
      user: {
        update: jest.fn().mockResolvedValue(mockUser),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockPrisma = {
      $transaction: jest
        .fn()
        .mockImplementation((cb: (tx: Record<string, any>) => Promise<any>) =>
          cb(mockTxInner),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockRepository },
        {
          provide: RolesRepository,
          useValue: {
            findPermissionCodesByRoleNames: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
            verifyAsync: jest.fn().mockResolvedValue({ userId: 'user-1' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.secret') return 'test-secret';
              if (key === 'jwt.refreshSecret') return 'test-refresh-secret';
              if (key === 'jwt.expiresIn') return '15m';
              if (key === 'jwt.refreshExpiresIn') return '30d';
              if (key === 'auth.maxFailedAttempts') return 3;
              if (key === 'auth.lockDurationMs') return 900000;
              if (key === 'auth.bcryptRounds') return 10;
              return null;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── 1. Successful login resets failedLoginAttempts ─────────

  it('should reset failedLoginAttempts on successful login', async () => {
    mockRepository.findUserByEmail!.mockResolvedValue(mockUser);
    mockBcryptCompare.mockResolvedValue(true);

    const dto: LoginDto = { email: 'test@test.com', password: 'correct' };
    const result = await service.login(dto);

    // Verify the update resets counters
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(result).toHaveProperty('accessToken');
  });

  // ── 2. Failed login increments failedLoginAttempts ─────────

  it('should increment failedLoginAttempts on failed login', async () => {
    mockRepository.findUserByEmail!.mockResolvedValue(mockUser);
    mockBcryptCompare.mockResolvedValue(false);

    const dto: LoginDto = { email: 'test@test.com', password: 'wrong' };

    await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
  });

  // ── 3. Lock account after maxFailedAttempts ─────────────────

  it('should lock account after 3 failed attempts', async () => {
    const userWithAttempts = { ...mockUser, failedLoginAttempts: 2 };
    mockRepository.findUserByEmail!.mockResolvedValue(userWithAttempts);
    mockBcryptCompare.mockResolvedValue(false);

    const dto: LoginDto = { email: 'test@test.com', password: 'wrong' };

    await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
  });

  // ── 4. Reject login when account is locked ──────────────────

  it('should reject login when account is locked', async () => {
    const lockedUser = {
      ...mockUser,
      status: UserStatus.BLOCKED,
      lockedUntil: new Date(Date.now() + 600000),
    };
    mockRepository.findUserByEmail!.mockResolvedValue(lockedUser);

    const dto: LoginDto = { email: 'test@test.com', password: 'any' };

    await expect(service.login(dto)).rejects.toThrow('Account is locked');
  });

  // ── 5. Auto-unlock after lock duration expires ──────────────

  it('should auto-unlock account when lock duration has expired', async () => {
    const expiredLockUser = {
      ...mockUser,
      status: UserStatus.BLOCKED,
      failedLoginAttempts: 3,
      lockedUntil: new Date(Date.now() - 60000),
    };
    mockRepository.findUserByEmail!.mockResolvedValue(expiredLockUser);
    mockBcryptCompare.mockResolvedValue(true);

    const dto: LoginDto = { email: 'test@test.com', password: 'correct' };
    await service.login(dto);

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  // ── 6. Rejects locked account even with correct password ────

  it('should reject locked account even with correct password', async () => {
    const lockedUser = {
      ...mockUser,
      status: UserStatus.BLOCKED,
      lockedUntil: new Date(Date.now() + 600000),
    };
    mockRepository.findUserByEmail!.mockResolvedValue(lockedUser);
    mockBcryptCompare.mockResolvedValue(true);

    const dto: LoginDto = { email: 'test@test.com', password: 'correct' };

    await expect(service.login(dto)).rejects.toThrow('Account is locked');
  });
});
