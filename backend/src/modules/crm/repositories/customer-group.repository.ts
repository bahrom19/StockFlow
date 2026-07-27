import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CustomerGroup as PrismaCustomerGroup, Prisma } from '@prisma/client';

@Injectable()
export class CustomerGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    companyId: string;
    skip?: number;
    take?: number;
    where?: Prisma.CustomerGroupWhereInput;
    orderBy?: Prisma.CustomerGroupOrderByWithRelationInput;
  }): Promise<[PrismaCustomerGroup[], number]> {
    const { companyId, skip, take, where, orderBy } = params;
    const [items, total] = await Promise.all([
      this.prisma.customerGroup.findMany({
        where: { ...where, companyId, deletedAt: null },
        skip,
        take,
        orderBy,
      }),
      this.prisma.customerGroup.count({
        where: { ...where, companyId, deletedAt: null },
      }),
    ]);
    return [items, total];
  }

  async findById(
    id: string,
    companyId: string,
  ): Promise<PrismaCustomerGroup | null> {
    return this.prisma.customerGroup.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async findByIdOrThrow(
    id: string,
    companyId: string,
  ): Promise<PrismaCustomerGroup> {
    const entity = await this.findById(id, companyId);
    if (!entity) throw new NotFoundException('Customer group not found');
    return entity;
  }

  async create(
    data: Prisma.CustomerGroupCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaCustomerGroup> {
    const prisma = tx ?? this.prisma;
    return prisma.customerGroup.create({ data });
  }

  async update(params: {
    id: string;
    companyId: string;
    data: Prisma.CustomerGroupUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<PrismaCustomerGroup> {
    const { id, companyId, data, tx } = params;
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    return prisma.customerGroup.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    await prisma.customerGroup.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
