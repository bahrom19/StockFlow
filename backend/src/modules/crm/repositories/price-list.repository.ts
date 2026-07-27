import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PriceList, Prisma } from '@prisma/client';

@Injectable()
export class PriceListRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PriceListWhereInput;
    orderBy?: Prisma.PriceListOrderByWithRelationInput;
  }): Promise<[PriceList[], number]> {
    const { skip, take, where, orderBy } = params;
    const [items, total] = await Promise.all([
      this.prisma.priceList.findMany({
        where: { ...where, deletedAt: null },
        skip,
        take,
        orderBy,
      }),
      this.prisma.priceList.count({
        where: { ...where, deletedAt: null },
      }),
    ]);
    return [items, total];
  }

  async findById(id: string, companyId: string): Promise<PriceList | null> {
    return this.prisma.priceList.findFirst({
      where: { id, customer: { companyId }, deletedAt: null },
    });
  }

  async findByIdOrThrow(id: string, companyId: string): Promise<PriceList> {
    const entity = await this.findById(id, companyId);
    if (!entity) throw new NotFoundException('Price list not found');
    return entity;
  }

  async create(
    data: Prisma.PriceListCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PriceList> {
    const prisma = tx ?? this.prisma;
    return prisma.priceList.create({ data });
  }

  async update(params: {
    id: string;
    companyId: string;
    data: Prisma.PriceListUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<PriceList> {
    const { id, companyId, data, tx } = params;
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    return prisma.priceList.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    await prisma.priceList.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
