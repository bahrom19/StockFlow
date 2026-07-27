import { Injectable } from '@nestjs/common';
import { Permission, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: Prisma.PermissionCreateInput): Promise<Permission> {
    return this.prismaService.permission.create({ data });
  }

  async findById(id: string): Promise<Permission | null> {
    return this.prismaService.permission.findUnique({ where: { id } });
  }

  async findByCode(code: string): Promise<Permission | null> {
    return this.prismaService.permission.findUnique({ where: { code } });
  }

  async findAll(params?: {
    module?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Permission[]; total: number }> {
    const { module, page = 1, limit = 50 } = params ?? {};

    const where: Prisma.PermissionWhereInput = {
      ...(module ? { module } : {}),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.permission.findMany({
        where,
        orderBy: { module: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.permission.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.PermissionUpdateInput,
  ): Promise<Permission> {
    return this.prismaService.permission.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prismaService.permission.delete({ where: { id } });
  }

  async upsertByCode(
    code: string,
    data: Prisma.PermissionCreateInput,
  ): Promise<Permission> {
    return this.prismaService.permission.upsert({
      where: { code },
      create: data,
      update: {
        name: data.name,
        description: data.description,
        module: data.module,
      },
    });
  }

  async findByIds(ids: string[]): Promise<Permission[]> {
    return this.prismaService.permission.findMany({
      where: { id: { in: ids } },
    });
  }
}
