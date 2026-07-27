import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, Prisma, Sale, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

const saleInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  payments: true,
  receipts: true,
};

@Injectable()
export class SalesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.SaleCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Sale> {
    return this.getClient(tx).sale.create({
      data,
      include: saleInclude,
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Sale | null> {
    return this.getClient(tx).sale.findFirst({
      where: { id, companyId, deletedAt: null },
      include: saleInclude,
    });
  }

  async findBySaleNumber(
    saleNumber: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Sale | null> {
    return this.getClient(tx).sale.findFirst({
      where: { saleNumber, companyId, deletedAt: null },
      include: saleInclude,
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    warehouseId?: string;
    cashierId?: string;
    customerId?: string;
    status?: SaleStatus;
    paymentMethod?: PaymentMethod;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: Sale[]; total: number }> {
    const {
      companyId,
      search,
      warehouseId,
      cashierId,
      customerId,
      status,
      paymentMethod,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.SaleWhereInput = { companyId, deletedAt: null };

    if (search) {
      where.OR = [{ saleNumber: { contains: search, mode: 'insensitive' } }];
    }
    if (warehouseId) where.warehouseId = warehouseId;
    if (cashierId) where.cashierId = cashierId;
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }
    if (paymentMethod) {
      where.payments = { some: { method: paymentMethod } };
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.sale.findMany({
        where,
        include: saleInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.sale.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.SaleUpdateInput,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Sale> {
    const client = this.getClient(tx);

    // If rowVersion is provided, use optimistic locking
    if (rowVersion !== undefined) {
      const result = await client.sale.updateMany({
        where: { id, companyId, rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.sale.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Sale with id ${id} not found`);
        }
        throw new ConflictException(
          `Sale ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      return client.sale.findUnique({
        where: { id },
        include: saleInclude,
      }) as unknown as Sale;
    }

    // Legacy path without rowVersion (for create-only flows)
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Sale with id ${id} not found`);
    }
    return client.sale.update({
      where: { id },
      data,
      include: saleInclude,
    });
  }

  async updateStatus(
    id: string,
    status: SaleStatus,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Sale> {
    return this.update(id, { status }, companyId, rowVersion, tx);
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Sale> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.sale.updateMany({
        where: { id, companyId, rowVersion },
        data: { deletedAt: new Date(), rowVersion: { increment: 1 } },
      });
      if (result.count === 0) {
        const existing = await client.sale.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Sale with id ${id} not found`);
        }
        throw new ConflictException(
          `Sale ${id} was modified by another user. Please refresh and retry.`,
        );
      }
      return client.sale.findUnique({
        where: { id },
        include: saleInclude,
      }) as unknown as Sale;
    }

    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Sale with id ${id} not found`);
    }
    return client.sale.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: saleInclude,
    });
  }

  async getNextSaleNumber(companyId: string): Promise<string> {
    const count = await this.prismaService.sale.count({ where: { companyId } });
    return `SALE-${companyId.substring(0, 8).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;
  }

  async getReceiptBySaleId(
    saleId: string,
    companyId: string,
  ): Promise<Sale | null> {
    return this.prismaService.sale.findFirst({
      where: { id: saleId, companyId, deletedAt: null },
      include: { ...saleInclude, receipts: true },
    });
  }
}
