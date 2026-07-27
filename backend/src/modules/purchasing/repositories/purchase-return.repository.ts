import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseReturn, PurchaseReturnStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class PurchaseReturnRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.PurchaseReturnCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseReturn> {
    return this.getClient(tx).purchaseReturn.create({
      data,
      include: { items: true, supplier: true, warehouse: true },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseReturn | null> {
    return this.getClient(tx).purchaseReturn.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true, supplier: true, warehouse: true },
    });
  }

  async findByReturnNumber(
    returnNumber: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseReturn | null> {
    return this.getClient(tx).purchaseReturn.findFirst({
      where: { returnNumber, companyId, deletedAt: null },
      include: { items: true, supplier: true, warehouse: true },
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    supplierId?: string;
    warehouseId?: string;
    status?: PurchaseReturnStatus;
    returnDateFrom?: Date;
    returnDateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: PurchaseReturn[]; total: number }> {
    const {
      companyId,
      search,
      supplierId,
      warehouseId,
      status,
      returnDateFrom,
      returnDateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.PurchaseReturnWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { returnNumber: { contains: search, mode: 'insensitive' } },
        {
          supplier: { companyName: { contains: search, mode: 'insensitive' } },
        },
      ];
    }
    if (supplierId) where.supplierId = supplierId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (status) where.status = status;
    if (returnDateFrom || returnDateTo) {
      where.returnDate = {};
      if (returnDateFrom) where.returnDate.gte = returnDateFrom;
      if (returnDateTo) where.returnDate.lte = returnDateTo;
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.purchaseReturn.findMany({
        where,
        include: { items: true, supplier: true, warehouse: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.purchaseReturn.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.PurchaseReturnUpdateInput,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseReturn> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Purchase return with id ${id} not found`);
    }
    return this.getClient(tx).purchaseReturn.update({
      where: { id },
      data,
      include: { items: true, supplier: true, warehouse: true },
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseReturn> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Purchase return with id ${id} not found`);
    }
    return this.getClient(tx).purchaseReturn.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { items: true, supplier: true, warehouse: true },
    });
  }

  async updateStatus(
    id: string,
    status: PurchaseReturnStatus,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseReturn> {
    return this.update(id, { status }, companyId, tx);
  }
}
