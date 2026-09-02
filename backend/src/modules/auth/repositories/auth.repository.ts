import { Injectable } from '@nestjs/common';
import {
  Company,
  CompanyMember,
  Prisma,
  RefreshToken,
  User,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class AuthRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return (tx ?? this.prismaService) as Prisma.TransactionClient;
  }

  async findUserByEmail(
    email: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User | null> {
    return this.getClient(tx).user.findUnique({ where: { email } });
  }

  async createCompany(
    name: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Company> {
    return this.getClient(tx).company.create({
      data: {
        name,
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }

  async createUser(
    data: {
      email: string;
      passwordHash: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<User> {
    return this.getClient(tx).user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        status: UserStatus.ACTIVE,
        isActive: true,
      },
    });
  }

  async createCompanyMember(
    companyId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CompanyMember> {
    return this.getClient(tx).companyMember.create({
      data: {
        companyId,
        userId,
      },
    });
  }

  async findCompanyMemberByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CompanyMember | null> {
    return this.getClient(tx).companyMember.findFirst({
      where: { userId, deletedAt: null },
    });
  }

  async findUserById(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User | null> {
    return this.getClient(tx).user.findUnique({ where: { id: userId } });
  }

  async createRefreshToken(
    userId: string,
    tokenHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RefreshToken> {
    return this.getClient(tx).refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async findRefreshTokenByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RefreshToken | null> {
    return this.getClient(tx).refreshToken.findFirst({
      where: { userId, revokedAt: null },
    });
  }

  async revokeRefreshTokens(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Load the role names assigned to a user within a specific company.
   * Queries the chain: CompanyMember → UserRole → Role.name
   */
  async findUserRoles(
    userId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const member = await this.getClient(tx).companyMember.findFirst({
      where: { userId, companyId, deletedAt: null },
      select: {
        id: true,
        userRoles: {
          include: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!member) {
      return [];
    }

    return member.userRoles.map((ur) => ur.role.name);
  }

  // ── Password Reset Tokens ──────────────────────────────────────

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findValidPasswordResetTokens(
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string; userId: string; tokenHash: string; expiresAt: Date }[]> {
    return this.getClient(tx).passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true, tokenHash: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50, // limit to avoid scanning the entire table
    });
  }

  async markPasswordResetTokenUsed(
    tokenId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
  }

  async updateUserPasswordHash(
    userId: string,
    passwordHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
