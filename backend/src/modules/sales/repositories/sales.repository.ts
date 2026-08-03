import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, Prisma, Sale, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import {
  DocumentSequenceService,
  DocumentSequenceType,
} from '../../shared/services/document-sequence.service';

const saleInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  payments: true,
  receipts: true,
};

// Scalar field names of the Sale model — used to separate scalar updates from
// relation writes in update() because updateMany accepts only scalar fields
// (SaleUpdateManyMutationInput).
const SALE_SCALAR_KEYS = new Set<string>(
  Object.values(Prisma.SaleScalarFieldEnum),
);

@Injectable()
export class SalesRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly documentSequenceService: DocumentSequenceService,
  ) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.SaleCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Sale> {
    try {
      return await this.getClient(tx).sale.create({
        data,
        include: saleInclude,
      });
    } catch (err) {
      // M2: a user-supplied saleNumber colliding with an existing one (or any
      // other unique violation on Sale) is a concurrency conflict → 409, not a
      // generic 400/500 from the global Prisma filter.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        Array.isArray(err.meta?.target) &&
        err.meta.target.includes('saleNumber')
      ) {
        throw new ConflictException(
          'Sale number already exists. Please refresh and retry.',
        );
      }
      throw err;
    }
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
      // updateMany only accepts scalar fields (SaleUpdateManyMutationInput).
      // Relation writes (e.g. cashShift: { connect }) must be applied via
      // sale.update after the optimistic-lock check succeeds, otherwise
      // Prisma throws "Unknown argument `cashShift`" (Blocker B1).
      const scalarData: Record<string, unknown> = {};
      const relationData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (SALE_SCALAR_KEYS.has(key)) {
          scalarData[key] = value;
        } else {
          relationData[key] = value;
        }
      }

      const result = await client.sale.updateMany({
        where: { id, companyId, rowVersion },
        data: { ...scalarData, rowVersion: { increment: 1 } },
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

      // Apply relation writes (updateMany cannot touch relations)
      if (Object.keys(relationData).length > 0) {
        await client.sale.update({ where: { id }, data: relationData });
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
    // M2: atomic per-company counter — two parallel calls always get distinct
    // numbers (the old count+1 raced and one caller hit P2002 → HTTP 400).
    const seq = await this.documentSequenceService.nextNumber(
      companyId,
      DocumentSequenceType.SALE,
    );
    return `SALE-${companyId.substring(0, 8).toUpperCase()}-${String(seq).padStart(4, '0')}`;
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
