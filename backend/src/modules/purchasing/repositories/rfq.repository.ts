import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RFQ, RFQStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class RFQRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.RFQCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RFQ> {
    return this.getClient(tx).rFQ.create({
      data,
      include: { items: true },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RFQ | null> {
    return this.getClient(tx).rFQ.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true, quotations: true },
    });
  }

  async findByRfqNumber(
    rfqNumber: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RFQ | null> {
    return this.getClient(tx).rFQ.findFirst({
      where: { rfqNumber, companyId, deletedAt: null },
      include: { items: true, quotations: true },
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    status?: RFQStatus;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: RFQ[]; total: number }> {
    const {
      companyId,
      search,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.RFQWhereInput = { companyId, deletedAt: null };

    if (search)
      where.OR = [{ rfqNumber: { contains: search, mode: 'insensitive' } }];
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.rfqDate = {};
      if (dateFrom) where.rfqDate.gte = dateFrom;
      if (dateTo) where.rfqDate.lte = dateTo;
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.rFQ.findMany({
        where,
        include: { items: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.rFQ.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.RFQUpdateInput,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RFQ> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing) throw new NotFoundException(`RFQ with id ${id} not found`);
    return this.getClient(tx).rFQ.update({
      where: { id },
      data,
      include: { items: true },
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RFQ> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing) throw new NotFoundException(`RFQ with id ${id} not found`);
    return this.getClient(tx).rFQ.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { items: true },
    });
  }

  async updateStatus(
    id: string,
    status: RFQStatus,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RFQ> {
    return this.update(id, { status }, companyId, tx);
  }
}
