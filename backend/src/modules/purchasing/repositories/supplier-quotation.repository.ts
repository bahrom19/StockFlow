import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuotationStatus, SupplierQuotation } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class SupplierQuotationRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.SupplierQuotationCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierQuotation> {
    return this.getClient(tx).supplierQuotation.create({
      data,
      include: { items: true, supplier: true },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierQuotation | null> {
    return this.getClient(tx).supplierQuotation.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true, supplier: true },
    });
  }

  async findByQuotationNumber(
    quotationNumber: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierQuotation | null> {
    return this.getClient(tx).supplierQuotation.findFirst({
      where: { quotationNumber, companyId, deletedAt: null },
      include: { items: true, supplier: true },
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    rfqId?: string;
    supplierId?: string;
    status?: QuotationStatus;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: SupplierQuotation[]; total: number }> {
    const {
      companyId,
      search,
      rfqId,
      supplierId,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.SupplierQuotationWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (search)
      where.OR = [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
      ];
    if (rfqId) where.rfqId = rfqId;
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.quotationDate = {};
      if (dateFrom) where.quotationDate.gte = dateFrom;
      if (dateTo) where.quotationDate.lte = dateTo;
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.supplierQuotation.findMany({
        where,
        include: { items: true, supplier: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.supplierQuotation.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.SupplierQuotationUpdateInput,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierQuotation> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing)
      throw new NotFoundException(`Supplier quotation with id ${id} not found`);
    return this.getClient(tx).supplierQuotation.update({
      where: { id },
      data,
      include: { items: true, supplier: true },
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierQuotation> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing)
      throw new NotFoundException(`Supplier quotation with id ${id} not found`);
    return this.getClient(tx).supplierQuotation.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { items: true, supplier: true },
    });
  }

  async updateStatus(
    id: string,
    status: QuotationStatus,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierQuotation> {
    return this.update(id, { status }, companyId, tx);
  }
}
