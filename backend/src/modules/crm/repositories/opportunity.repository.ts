import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SalesOpportunity as PrismaOpportunity, Prisma } from '@prisma/client';

@Injectable()
export class OpportunityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    companyId: string;
    skip?: number;
    take?: number;
    where?: Prisma.SalesOpportunityWhereInput;
    orderBy?: Prisma.SalesOpportunityOrderByWithRelationInput;
  }): Promise<[PrismaOpportunity[], number]> {
    const { companyId, skip, take, where, orderBy } = params;
    const [items, total] = await Promise.all([
      this.prisma.salesOpportunity.findMany({
        where: { ...where, companyId, deletedAt: null },
        skip,
        take,
        orderBy,
      }),
      this.prisma.salesOpportunity.count({
        where: { ...where, companyId, deletedAt: null },
      }),
    ]);
    return [items, total];
  }

  async findById(
    id: string,
    companyId: string,
  ): Promise<PrismaOpportunity | null> {
    return this.prisma.salesOpportunity.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async findByIdOrThrow(
    id: string,
    companyId: string,
  ): Promise<PrismaOpportunity> {
    const entity = await this.findById(id, companyId);
    if (!entity) throw new NotFoundException('Opportunity not found');
    return entity;
  }

  async create(
    data: Prisma.SalesOpportunityCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaOpportunity> {
    const prisma = tx ?? this.prisma;
    return prisma.salesOpportunity.create({ data });
  }

  async update(params: {
    id: string;
    companyId: string;
    data: Prisma.SalesOpportunityUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<PrismaOpportunity> {
    const { id, companyId, data, tx } = params;
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    return prisma.salesOpportunity.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    await prisma.salesOpportunity.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
