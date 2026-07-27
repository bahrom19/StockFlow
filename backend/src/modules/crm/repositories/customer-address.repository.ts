import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CustomerAddress, Prisma } from '@prisma/client';

@Injectable()
export class CustomerAddressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.CustomerAddressWhereInput;
    orderBy?: Prisma.CustomerAddressOrderByWithRelationInput;
  }): Promise<[CustomerAddress[], number]> {
    const { skip, take, where, orderBy } = params;
    const [items, total] = await Promise.all([
      this.prisma.customerAddress.findMany({
        where: { ...where, deletedAt: null },
        skip,
        take,
        orderBy,
      }),
      this.prisma.customerAddress.count({
        where: { ...where, deletedAt: null },
      }),
    ]);
    return [items, total];
  }

  async findById(
    id: string,
    companyId: string,
  ): Promise<CustomerAddress | null> {
    return this.prisma.customerAddress.findFirst({
      where: { id, customer: { companyId }, deletedAt: null },
    });
  }

  async findByIdOrThrow(
    id: string,
    companyId: string,
  ): Promise<CustomerAddress> {
    const entity = await this.findById(id, companyId);
    if (!entity) throw new NotFoundException('Customer address not found');
    return entity;
  }

  async create(
    data: Prisma.CustomerAddressCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerAddress> {
    const prisma = tx ?? this.prisma;
    return prisma.customerAddress.create({ data });
  }

  async update(params: {
    id: string;
    companyId: string;
    data: Prisma.CustomerAddressUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<CustomerAddress> {
    const { id, companyId, data, tx } = params;
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    return prisma.customerAddress.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    await prisma.customerAddress.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
