import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

const roleInclude = {
  permissions: {
    include: {
      permission: {
        select: { id: true, code: true, name: true },
      },
    },
  },
} as const;

@Injectable()
export class RolesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return (tx ?? this.prismaService) as Prisma.TransactionClient;
  }

  async create(
    data: Prisma.RoleCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Role> {
    return this.getClient(tx).role.create({ data });
  }

  async findById(id: string, companyId: string): Promise<Role | null> {
    return this.prismaService.role.findFirst({
      where: { id, companyId, deletedAt: null },
      include: roleInclude,
    });
  }

  async findByName(name: string, companyId: string): Promise<Role | null> {
    return this.prismaService.role.findFirst({
      where: { name, companyId, deletedAt: null },
    });
  }

  async findAllByCompany(
    companyId: string,
    params?: {
      page?: number;
      limit?: number;
      isActive?: boolean;
    },
  ): Promise<{ items: Role[]; total: number }> {
    const { page = 1, limit = 20, isActive } = params ?? {};

    const where: Prisma.RoleWhereInput = {
      companyId,
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.role.findMany({
        where,
        include: roleInclude,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.role.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.RoleUpdateInput,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Role> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.role.updateMany({
        where: { id, companyId, rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.role.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Role with id ${id} not found`);
        }
        throw new ConflictException(
          `Role ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      const updated = await client.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: {
              permission: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });
      return updated as Role;
    }

    const role = await this.findById(id, companyId);
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    return client.role.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Role> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.role.updateMany({
        where: { id, companyId, rowVersion },
        data: {
          deletedAt: new Date(),
          isActive: false,
          rowVersion: { increment: 1 },
        },
      });

      if (result.count === 0) {
        const existing = await client.role.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Role with id ${id} not found`);
        }
        throw new ConflictException(
          `Role ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      const updated = await client.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: {
              permission: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });
      return updated as Role;
    }

    const role = await this.findById(id, companyId);
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    return client.role.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /**
   * Assign a permission to a role (skip if already assigned).
   */
  async assignPermission(
    roleId: string,
    permissionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const existing = await this.getClient(tx).rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (!existing) {
      await this.getClient(tx).rolePermission.create({
        data: { roleId, permissionId },
      });
    }
  }

  /**
   * Remove a permission from a role.
   */
  async removePermission(
    roleId: string,
    permissionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).rolePermission.deleteMany({
      where: { roleId, permissionId },
    });
  }

  /**
   * Replace all permissions of a role with a new set.
   */
  async setPermissions(
    roleId: string,
    permissionIds: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.getClient(tx);
    await client.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length > 0) {
      await client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      });
    }
  }

  /**
   * Get all role names for a company member (user in a company).
   */
  async findRoleNamesByCompanyMemberId(
    companyMemberId: string,
  ): Promise<string[]> {
    const userRoles = await this.prismaService.userRole.findMany({
      where: { companyMemberId },
      include: { role: { select: { name: true } } },
    });
    return userRoles.map((ur) => ur.role.name);
  }

  /**
   * Load all permission codes (strings) for a given set of role names within a company.
   * Used by RolesGuard to check @RequirePermission access.
   */
  async findPermissionCodesByRoleNames(
    roleNames: string[],
    companyId: string,
  ): Promise<string[]> {
    const rolePermissions = await this.prismaService.rolePermission.findMany({
      where: {
        role: {
          name: { in: roleNames },
          companyId,
          isActive: true,
          deletedAt: null,
        },
      },
      include: {
        permission: {
          select: { code: true },
        },
      },
    });
    return rolePermissions.map((rp) => rp.permission.code);
  }

  /**
   * Get the companyMemberId for a user in a company.
   */
  async findCompanyMemberId(
    userId: string,
    companyId: string,
  ): Promise<string | null> {
    const member = await this.prismaService.companyMember.findFirst({
      where: { userId, companyId, deletedAt: null },
      select: { id: true },
    });
    return member?.id ?? null;
  }

  /**
   * Assign a role to a company member.
   */
  async assignRoleToUser(
    companyMemberId: string,
    roleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const existing = await this.getClient(tx).userRole.findUnique({
      where: { companyMemberId_roleId: { companyMemberId, roleId } },
    });
    if (!existing) {
      await this.getClient(tx).userRole.create({
        data: { companyMemberId, roleId },
      });
    }
  }

  /**
   * Unassign a role from a company member.
   */
  async removeRoleFromUser(
    companyMemberId: string,
    roleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).userRole.deleteMany({
      where: { companyMemberId, roleId },
    });
  }

  /**
   * Get all users with their role IDs for a company.
   */
  async findUsersByCompany(
    companyId: string,
  ): Promise<{ companyMemberId: string; userId: string; roleIds: string[] }[]> {
    const members = await this.prismaService.companyMember.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        userRoles: { select: { roleId: true } },
      },
    });
    return members.map((m) => ({
      companyMemberId: m.id,
      userId: m.userId,
      roleIds: m.userRoles.map((ur) => ur.roleId),
    }));
  }
}
