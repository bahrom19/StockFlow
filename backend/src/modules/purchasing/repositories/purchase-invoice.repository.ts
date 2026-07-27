import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseInvoice, PurchaseInvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class PurchaseInvoiceRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.PurchaseInvoiceCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice> {
    return this.getClient(tx).purchaseInvoice.create({
      data,
      include: { items: true },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice | null> {
    return this.getClient(tx).purchaseInvoice.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true },
    });
  }

  async findByInvoiceNumber(
    invoiceNumber: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice | null> {
    return this.getClient(tx).purchaseInvoice.findFirst({
      where: { invoiceNumber, companyId, deletedAt: null },
      include: { items: true },
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    purchaseOrderId?: string;
    supplierId?: string;
    status?: PurchaseInvoiceStatus;
    invoiceDateFrom?: Date;
    invoiceDateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: PurchaseInvoice[]; total: number }> {
    const {
      companyId,
      search,
      purchaseOrderId,
      supplierId,
      status,
      invoiceDateFrom,
      invoiceDateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.PurchaseInvoiceWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (search)
      where.OR = [{ invoiceNumber: { contains: search, mode: 'insensitive' } }];
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (invoiceDateFrom || invoiceDateTo) {
      where.invoiceDate = {};
      if (invoiceDateFrom) where.invoiceDate.gte = invoiceDateFrom;
      if (invoiceDateTo) where.invoiceDate.lte = invoiceDateTo;
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.purchaseInvoice.findMany({
        where,
        include: { items: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.purchaseInvoice.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.PurchaseInvoiceUpdateInput,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing)
      throw new NotFoundException(`Purchase invoice with id ${id} not found`);
    return this.getClient(tx).purchaseInvoice.update({
      where: { id },
      data,
      include: { items: true },
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing)
      throw new NotFoundException(`Purchase invoice with id ${id} not found`);
    return this.getClient(tx).purchaseInvoice.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { items: true },
    });
  }

  async updateStatus(
    id: string,
    status: PurchaseInvoiceStatus,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice> {
    return this.update(id, { status }, companyId, tx);
  }
}
