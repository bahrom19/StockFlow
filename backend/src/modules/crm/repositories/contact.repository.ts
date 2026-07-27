import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CustomerContact as PrismaContact, Prisma } from '@prisma/client';

@Injectable()
export class ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    companyId: string;
    skip?: number;
    take?: number;
    where?: Prisma.CustomerContactWhereInput;
    orderBy?: Prisma.CustomerContactOrderByWithRelationInput;
  }): Promise<[PrismaContact[], number]> {
    const { skip, take, where, orderBy } = params;
    const [items, total] = await Promise.all([
      this.prisma.customerContact.findMany({
        where: { ...where, deletedAt: null },
        skip,
        take,
        orderBy,
      }),
      this.prisma.customerContact.count({
        where: { ...where, deletedAt: null },
      }),
    ]);
    return [items, total];
  }

  async findById(id: string, companyId: string): Promise<PrismaContact | null> {
    return this.prisma.customerContact.findFirst({
      where: { id, customer: { companyId }, deletedAt: null },
    });
  }

  async findByIdOrThrow(id: string, companyId: string): Promise<PrismaContact> {
    const entity = await this.findById(id, companyId);
    if (!entity) throw new NotFoundException('Contact not found');
    return entity;
  }

  async create(
    data: Prisma.CustomerContactCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaContact> {
    const prisma = tx ?? this.prisma;
    return prisma.customerContact.create({ data });
  }

  async update(params: {
    id: string;
    companyId: string;
    data: Prisma.CustomerContactUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<PrismaContact> {
    const { id, companyId, data, tx } = params;
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    return prisma.customerContact.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    await prisma.customerContact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
