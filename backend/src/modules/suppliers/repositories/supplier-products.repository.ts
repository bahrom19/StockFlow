import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierProduct } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

type SupplierProductWithProduct = SupplierProduct & { product: { id: string; name: string; sku: string | null } };

@Injectable()
export class SupplierProductsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  private readonly productInclude = {
    product: {
      select: {
        id: true,
        name: true,
        sku: true,
      },
    },
  };

  async findMany(
    companyId: string,
    supplierId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isPreferred?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
    tx?: Prisma.TransactionClient,
  ): Promise<{ items: SupplierProductWithProduct[]; total: number }> {
    const client = this.getClient(tx);
    const { page = 1, limit = 20, search, isPreferred, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const where: Prisma.SupplierProductWhereInput = {
      companyId,
      supplierId,
      deletedAt: null,
    };

    if (isPreferred !== undefined) {
      where.isPreferred = isPreferred;
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { product: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { product: { sku: { contains: searchTerm, mode: 'insensitive' } } },
        { supplierSku: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Whitelist sort fields
    const allowedSortFields = new Set([
      'purchasePrice',
      'lastPurchaseAt',
      'createdAt',
      'updatedAt',
      'isPreferred',
    ]);
    const sortField = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';

    const orderBy: Prisma.SupplierProductOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [items, total] = await Promise.all([
      client.supplierProduct.findMany({
        where,
        include: this.productInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      client.supplierProduct.count({ where }),
    ]);

    return { items, total };
  }

  async findById(
    id: string,
    companyId: string,
    supplierId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierProductWithProduct | null> {
    return this.getClient(tx).supplierProduct.findFirst({
      where: { id, companyId, supplierId, deletedAt: null },
      include: this.productInclude,
    }) as Promise<SupplierProductWithProduct | null>;
  }

  async findBySupplierAndProduct(
    supplierId: string,
    productId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierProduct | null> {
    return this.getClient(tx).supplierProduct.findFirst({
      where: { supplierId, productId, companyId, deletedAt: null },
    });
  }

  async create(
    data: Prisma.SupplierProductCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierProductWithProduct> {
    return this.getClient(tx).supplierProduct.create({
      data,
      include: this.productInclude,
    }) as Promise<SupplierProductWithProduct>;
  }

  async update(
    id: string,
    companyId: string,
    data: Prisma.SupplierProductUpdateInput,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierProductWithProduct> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.supplierProduct.updateMany({
        where: { id, companyId, rowVersion, deletedAt: null },
        data: { ...data, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.supplierProduct.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Supplier product with id ${id} not found`);
        }
        throw new ConflictException(
          `Supplier product ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      return client.supplierProduct.findUnique({
        where: { id },
        include: this.productInclude,
      }) as unknown as SupplierProductWithProduct;
    }

    return client.supplierProduct.update({
      where: { id },
      data,
      include: this.productInclude,
    }) as unknown as SupplierProductWithProduct;
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.supplierProduct.updateMany({
        where: { id, companyId, rowVersion, deletedAt: null },
        data: { deletedAt: new Date(), rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.supplierProduct.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Supplier product with id ${id} not found`);
        }
        throw new ConflictException(
          `Supplier product ${id} was modified by another user. Please refresh and retry.`,
        );
      }
      return;
    }

    await client.supplierProduct.updateMany({
      where: { id, companyId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async clearPreferred(
    productId: string,
    companyId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).supplierProduct.updateMany({
      where: {
        productId,
        companyId,
        isPreferred: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isPreferred: false },
    });
  }

  async countBySupplier(
    supplierId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.getClient(tx).supplierProduct.count({
      where: { supplierId, companyId, deletedAt: null },
    });
  }
}
