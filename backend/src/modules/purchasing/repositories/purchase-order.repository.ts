import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrder, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class PurchaseOrderRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.PurchaseOrderCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseOrder> {
    return this.getClient(tx).purchaseOrder.create({
      data,
      include: {
        items: true,
        supplier: true,
      },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseOrder | null> {
    return this.getClient(tx).purchaseOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        items: true,
        supplier: true,
      },
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    supplierId?: string;
    status?: PurchaseOrderStatus;
    orderDateFrom?: Date;
    orderDateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: PurchaseOrder[]; total: number }> {
    const {
      companyId,
      search,
      supplierId,
      status,
      orderDateFrom,
      orderDateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        {
          supplier: { companyName: { contains: search, mode: 'insensitive' } },
        },
      ];
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status) {
      where.status = status;
    }

    if (orderDateFrom || orderDateTo) {
      where.orderDate = {};
      if (orderDateFrom) {
        where.orderDate.gte = orderDateFrom;
      }
      if (orderDateTo) {
        where.orderDate.lte = orderDateTo;
      }
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.purchaseOrder.findMany({
        where,
        include: {
          items: true,
          supplier: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.purchaseOrder.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.PurchaseOrderUpdateInput,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseOrder> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.purchaseOrder.updateMany({
        where: { id, companyId, rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.purchaseOrder.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Purchase order with id ${id} not found`);
        }
        throw new ConflictException(
          `Purchase order ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      return client.purchaseOrder.findUnique({
        where: { id },
        include: { items: true, supplier: true },
      }) as unknown as PurchaseOrder;
    }

    // Legacy: findById + update
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Purchase order with id ${id} not found`);
    }
    return client.purchaseOrder.update({
      where: { id },
      data,
      include: { items: true, supplier: true },
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseOrder> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.purchaseOrder.updateMany({
        where: { id, companyId, rowVersion },
        data: { deletedAt: new Date(), rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.purchaseOrder.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Purchase order with id ${id} not found`);
        }
        throw new ConflictException(
          `Purchase order ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      return client.purchaseOrder.findUnique({
        where: { id },
        include: { items: true, supplier: true },
      }) as unknown as PurchaseOrder;
    }

    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Purchase order with id ${id} not found`);
    }
    return client.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { items: true, supplier: true },
    });
  }

  async findByOrderNumber(
    orderNumber: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseOrder | null> {
    return this.getClient(tx).purchaseOrder.findFirst({
      where: { orderNumber, companyId, deletedAt: null },
      include: {
        items: true,
        supplier: true,
      },
    });
  }

  async updateStatus(
    id: string,
    status: PurchaseOrderStatus,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseOrder> {
    return this.update(id, { status }, companyId, rowVersion, tx);
  }

  async countByCompany(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.getClient(tx).purchaseOrder.count({
      where: { companyId },
    });
  }
}
