import { Injectable, NotFoundException } from '@nestjs/common';
import { GoodsReceipt, GoodsReceiptStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class GoodsReceiptRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.GoodsReceiptCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<GoodsReceipt> {
    return this.getClient(tx).goodsReceipt.create({
      data,
      include: { items: true, purchaseOrder: true, warehouse: true },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GoodsReceipt | null> {
    return this.getClient(tx).goodsReceipt.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true, purchaseOrder: true, warehouse: true },
    });
  }

  async findByReceiptNumber(
    receiptNumber: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GoodsReceipt | null> {
    return this.getClient(tx).goodsReceipt.findFirst({
      where: { receiptNumber, companyId, deletedAt: null },
      include: { items: true, purchaseOrder: true, warehouse: true },
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    purchaseOrderId?: string;
    warehouseId?: string;
    status?: GoodsReceiptStatus;
    receiptDateFrom?: Date;
    receiptDateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: GoodsReceipt[]; total: number }> {
    const {
      companyId,
      search,
      purchaseOrderId,
      warehouseId,
      status,
      receiptDateFrom,
      receiptDateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.GoodsReceiptWhereInput = { companyId, deletedAt: null };

    if (search) {
      where.OR = [{ receiptNumber: { contains: search, mode: 'insensitive' } }];
    }
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (status) where.status = status;
    if (receiptDateFrom || receiptDateTo) {
      where.receiptDate = {};
      if (receiptDateFrom) where.receiptDate.gte = receiptDateFrom;
      if (receiptDateTo) where.receiptDate.lte = receiptDateTo;
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.goodsReceipt.findMany({
        where,
        include: { items: true, purchaseOrder: true, warehouse: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.goodsReceipt.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.GoodsReceiptUpdateInput,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GoodsReceipt> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Goods receipt with id ${id} not found`);
    }
    return this.getClient(tx).goodsReceipt.update({
      where: { id },
      data,
      include: { items: true, purchaseOrder: true, warehouse: true },
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GoodsReceipt> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Goods receipt with id ${id} not found`);
    }
    return this.getClient(tx).goodsReceipt.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { items: true, purchaseOrder: true, warehouse: true },
    });
  }

  async updateStatus(
    id: string,
    status: GoodsReceiptStatus,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GoodsReceipt> {
    return this.update(id, { status }, companyId, tx);
  }
}
