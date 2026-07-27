import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CustomerNote, Prisma } from '@prisma/client';

@Injectable()
export class CustomerNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.CustomerNoteWhereInput;
    orderBy?: Prisma.CustomerNoteOrderByWithRelationInput;
  }): Promise<[CustomerNote[], number]> {
    const { skip, take, where, orderBy } = params;
    const [items, total] = await Promise.all([
      this.prisma.customerNote.findMany({
        where: { ...where, deletedAt: null },
        skip,
        take,
        orderBy,
      }),
      this.prisma.customerNote.count({
        where: { ...where, deletedAt: null },
      }),
    ]);
    return [items, total];
  }

  async findById(id: string, companyId: string): Promise<CustomerNote | null> {
    return this.prisma.customerNote.findFirst({
      where: { id, customer: { companyId }, deletedAt: null },
    });
  }

  async findByIdOrThrow(id: string, companyId: string): Promise<CustomerNote> {
    const entity = await this.findById(id, companyId);
    if (!entity) throw new NotFoundException('Customer note not found');
    return entity;
  }

  async create(
    data: Prisma.CustomerNoteCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerNote> {
    const prisma = tx ?? this.prisma;
    return prisma.customerNote.create({ data });
  }

  async update(params: {
    id: string;
    companyId: string;
    data: Prisma.CustomerNoteUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<CustomerNote> {
    const { id, companyId, data, tx } = params;
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    return prisma.customerNote.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    await prisma.customerNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
