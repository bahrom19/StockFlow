import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountType, NormalBalance, Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../common/prisma';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { LogoutDto } from '../dto/logout.dto';
import { AuthResponse, AuthUser } from '../interfaces/auth-response.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthRepository } from '../repositories/auth.repository';
import { RolesRepository } from '../../rbac/repositories/roles.repository';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS_DEFAULT = 5;
const LOCK_DURATION_MS_DEFAULT = FIFTEEN_MINUTES_MS;
const BCRYPT_ROUNDS_DEFAULT = 12;

@Injectable()
export class AuthService {
  private readonly maxFailedAttempts: number;
  private readonly lockDurationMs: number;
  private readonly bcryptRounds: number;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly rolesRepository: RolesRepository,
  ) {
    this.maxFailedAttempts =
      this.configService.get<number>('auth.maxFailedAttempts') ??
      MAX_FAILED_ATTEMPTS_DEFAULT;
    this.lockDurationMs =
      this.configService.get<number>('auth.lockDurationMs') ??
      LOCK_DURATION_MS_DEFAULT;
    this.bcryptRounds =
      this.configService.get<number>('auth.bcryptRounds') ??
      BCRYPT_ROUNDS_DEFAULT;
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    return this.prismaService.$transaction(async (tx) => {
      const existingUser = await this.authRepository.findUserByEmail(
        registerDto.email,
        tx,
      );

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const company = await this.authRepository.createCompany(
        registerDto.companyName,
        tx,
      );

      // Create default Chart of Accounts for the new company
      await this.seedChartOfAccounts(company.id, tx);

      const passwordHash = await bcrypt.hash(registerDto.password, this.bcryptRounds);

      const user = await this.authRepository.createUser(
        {
          email: registerDto.email,
          passwordHash,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          phone: registerDto.phone,
        },
        tx,
      );

      const companyMember = await this.authRepository.createCompanyMember(
        company.id,
        user.id,
        tx,
      );

      // Create a default 'Admin' role for the new company with full permissions
      const adminRole = await tx.role.create({
        data: {
          name: 'Admin',
          description: 'Full system access',
          isSystem: true,
          companyId: company.id,
        },
      });

      // Assign all existing permissions to the Admin role
      const allPermissions = await tx.permission.findMany({
        select: { id: true },
      });
      if (allPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: allPermissions.map((p) => ({
            roleId: adminRole.id,
            permissionId: p.id,
          })),
        });
      }

      // Assign the Admin role to the registering user
      await tx.userRole.create({
        data: {
          companyMemberId: companyMember.id,
          roleId: adminRole.id,
        },
      });

      const roles = ['Admin'];
      const payload: JwtPayload = {
        userId: user.id,
        companyId: company.id,
        roles,
        email: user.email,
      };

      const permissions = await this.loadPermissions(roles, company.id);

      const accessToken = await this.signAccessToken(payload);
      const refreshToken = await this.signRefreshToken(payload);
      await this.storeRefreshToken(user.id, refreshToken, tx);

      return {
        accessToken,
        refreshToken,
        expiresIn: this.configService.get<string>('jwt.expiresIn') ?? '15m',
        refreshExpiresIn:
          this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d',
        user: this.buildAuthUser({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyId: company.id,
          roles,
          permissions,
        }),
      };
    });
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    return this.prismaService.$transaction(async (tx) => {
      const user = await this.authRepository.findUserByEmail(
        loginDto.email,
        tx,
      );

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // ── Account Lockout Check ──────────────────────────────────
      // If the account is locked and lock duration hasn't expired, reject
      if (
        user.status === UserStatus.BLOCKED &&
        user.lockedUntil &&
        user.lockedUntil > new Date()
      ) {
        const remainingMs = user.lockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        throw new UnauthorizedException(
          `Account is locked. Try again in ${remainingMin} minute(s).`,
        );
      }

      // If lock has expired, unlock the account automatically
      if (
        user.status === UserStatus.BLOCKED &&
        user.lockedUntil &&
        user.lockedUntil <= new Date()
      ) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.ACTIVE,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
      }

      // ── Password Validation ────────────────────────────────────
      const isPasswordValid = await bcrypt.compare(
        loginDto.password,
        user.passwordHash,
      );

      if (!isPasswordValid) {
        // Increment failed attempts
        const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
        const shouldLock = newAttempts >= this.maxFailedAttempts;

        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newAttempts,
            ...(shouldLock
              ? {
                  status: UserStatus.BLOCKED,
                  lockedUntil: new Date(Date.now() + this.lockDurationMs),
                }
              : {}),
          },
        });

        // Audit log for failed login (companyId is empty string because
        // login happens before company context is established)
        await tx.auditLog.create({
          data: {
            userId: user.id,
            entity: 'User',
            entityId: user.id,
            action: shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
            newValues: {
              failedLoginAttempts: newAttempts,
              ...(shouldLock ? { status: 'BLOCKED' } : {}),
            },
            companyId: '00000000-0000-0000-0000-000000000000',
          },
        });

        throw new UnauthorizedException('Invalid credentials');
      }

      // ── Successful Login — Reset counters ──────────────────────
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
      });

      const companyMember = await this.authRepository.findCompanyMemberByUserId(
        user.id,
        tx,
      );

      if (!companyMember) {
        throw new UnauthorizedException('User is not assigned to any company');
      }

      // Load roles dynamically from the database
      const roles = await this.authRepository.findUserRoles(
        user.id,
        companyMember.companyId,
      );

      const permissions = await this.loadPermissions(roles, companyMember.companyId);

      const payload: JwtPayload = {
        userId: user.id,
        companyId: companyMember.companyId,
        roles,
        email: user.email,
      };

      const accessToken = await this.signAccessToken(payload);
      const refreshToken = await this.signRefreshToken(payload);
      await this.storeRefreshToken(user.id, refreshToken, tx);

      return {
        accessToken,
        refreshToken,
        expiresIn: this.configService.get<string>('jwt.expiresIn') ?? '15m',
        refreshExpiresIn:
          this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d',
        user: this.buildAuthUser({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyId: companyMember.companyId,
          roles,
          permissions,
        }),
      };
    });
  }

  async refresh(refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);
    const user = await this.authRepository.findUserById(payload.userId);

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const companyMember = await this.authRepository.findCompanyMemberByUserId(
      user.id,
    );

    if (!companyMember) {
      throw new UnauthorizedException('User is not assigned to any company');
    }

    // Load roles dynamically from the database
    const roles = await this.authRepository.findUserRoles(
      user.id,
      companyMember.companyId,
    );

    const permissions = await this.loadPermissions(roles, companyMember.companyId);

    const newPayload: JwtPayload = {
      userId: user.id,
      companyId: companyMember.companyId,
      roles,
      email: user.email,
    };

    return this.prismaService.$transaction(async (tx) => {
      const accessToken = await this.signAccessToken(newPayload);
      const refreshToken = await this.signRefreshToken(newPayload);
      await this.revokeRefreshTokens(user.id, tx);
      await this.storeRefreshToken(user.id, refreshToken, tx);

      return {
        accessToken,
        refreshToken,
        expiresIn: this.configService.get<string>('jwt.expiresIn') ?? '15m',
        refreshExpiresIn:
          this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d',
        user: this.buildAuthUser({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyId: companyMember.companyId,
          roles,
          permissions,
        }),
      };
    });
  }

  async logout(logoutDto: LogoutDto): Promise<{ message: string }> {
    const payload = await this.verifyRefreshToken(logoutDto.refreshToken);
    await this.prismaService.$transaction(async (tx) => {
      await this.revokeRefreshTokens(payload.userId, tx);
    });

    return { message: 'Logged out successfully' };
  }

  private async signAccessToken(payload: JwtPayload): Promise<string> {
    const secret = this.configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '15m' as const,
    });
  }

  private async signRefreshToken(payload: JwtPayload): Promise<string> {
    const secret = this.configService.get<string>('jwt.refreshSecret');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is required');
    }
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '30d' as const,
    });
  }

  private async storeRefreshToken(
    userId: string,
    token: string,
    tx?: Parameters<AuthRepository['createRefreshToken']>[2],
  ): Promise<void> {
    const tokenHash = await bcrypt.hash(token, this.bcryptRounds);
    await this.authRepository.createRefreshToken(userId, tokenHash, tx);
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const secret =
        this.configService.get<string>('jwt.refreshSecret') ??
        this.configService.get<string>('jwt.secret');
      if (!secret) {
        throw new Error('JWT_SECRET is required');
      }
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      const refreshTokenRecord =
        await this.authRepository.findRefreshTokenByUserId(payload.userId);

      if (!refreshTokenRecord) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isValid = await bcrypt.compare(token, refreshTokenRecord.tokenHash);

      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async revokeRefreshTokens(
    userId: string,
    tx?: Parameters<AuthRepository['revokeRefreshTokens']>[1],
  ): Promise<void> {
    await this.authRepository.revokeRefreshTokens(userId, tx);
  }

  /**
   * Get the current user's profile information.
   * Called by GET /auth/me.
   */
  async getProfile(userId: string, companyId: string): Promise<AuthUser> {
    const user = await this.authRepository.findUserById(userId);
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const roles = await this.authRepository.findUserRoles(userId, companyId);
    const permissions = await this.loadPermissions(roles, companyId);

    return this.buildAuthUser({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId,
      roles,
      permissions,
    });
  }

  /**
   * Seed default Chart of Accounts for a new company.
   * Creates standard accounts needed for sales, purchasing, and inventory accounting.
   */
  private async seedChartOfAccounts(
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const defaultAccounts: Array<{
      code: string;
      name: string;
      description: string;
      accountType: AccountType;
      normalBalance: NormalBalance;
      isCashOrBank?: boolean;
      isSystem?: boolean;
      sortOrder: number;
    }> = [
      {
        code: '1010',
        name: 'Cash on hand',
        description: 'Cash and cash equivalents',
        accountType: AccountType.ASSET,
        normalBalance: NormalBalance.DEBIT,
        isCashOrBank: true,
        isSystem: true,
        sortOrder: 1,
      },
      {
        code: '1020',
        name: 'Bank accounts',
        description: 'Bank accounts and card settlement accounts',
        accountType: AccountType.ASSET,
        normalBalance: NormalBalance.DEBIT,
        isCashOrBank: true,
        isSystem: true,
        sortOrder: 2,
      },
      {
        code: '1200',
        name: 'Accounts Receivable',
        description: 'Receivables from customers',
        accountType: AccountType.ASSET,
        normalBalance: NormalBalance.DEBIT,
        isSystem: true,
        sortOrder: 3,
      },
      {
        code: '1300',
        name: 'Inventory',
        description: 'Inventory on hand',
        accountType: AccountType.ASSET,
        normalBalance: NormalBalance.DEBIT,
        isSystem: true,
        sortOrder: 4,
      },
      {
        code: '2100',
        name: 'Accounts Payable',
        description: 'Payables to suppliers',
        accountType: AccountType.LIABILITY,
        normalBalance: NormalBalance.CREDIT,
        isSystem: true,
        sortOrder: 5,
      },
      {
        code: '4000',
        name: 'Sales Revenue',
        description: 'Revenue from sales',
        accountType: AccountType.REVENUE,
        normalBalance: NormalBalance.CREDIT,
        isSystem: true,
        sortOrder: 6,
      },
      {
        code: '5000',
        name: 'Cost of Goods Sold',
        description: 'Cost of goods sold',
        accountType: AccountType.EXPENSE,
        normalBalance: NormalBalance.DEBIT,
        isSystem: true,
        sortOrder: 7,
      },
      {
        code: '5100',
        name: 'Inventory Adjustment',
        description: 'Inventory adjustments and write-offs',
        accountType: AccountType.EXPENSE,
        normalBalance: NormalBalance.DEBIT,
        isSystem: true,
        sortOrder: 8,
      },
      {
        code: '5200',
        name: 'Purchase Discounts and Write-Offs',
        description: 'Purchase discounts, inventory write-offs and adjustments',
        accountType: AccountType.EXPENSE,
        normalBalance: NormalBalance.DEBIT,
        isSystem: true,
        sortOrder: 9,
      },
    ];

    for (const account of defaultAccounts) {
      await tx.chartOfAccount.create({
        data: {
          ...account,
          companyId,
          isActive: true,
          level: 0,
        },
      });
    }
  }

  private async loadPermissions(
    roleNames: string[],
    companyId: string,
  ): Promise<string[]> {
    if (roleNames.length === 0) return [];
    return this.rolesRepository.findPermissionCodesByRoleNames(roleNames, companyId);
  }

  private buildAuthUser(params: AuthUser): AuthUser {
    return params;
  }
}
