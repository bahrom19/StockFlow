import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product, UnitOfMeasure, Warehouse } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';

/**
 * Relations included on every product read so the mapper can report the unit
 * NAME (not the raw unitId UUID) and the real stock quantity.
 */
const PRODUCT_INCLUDE = {
  unit: { select: { name: true } },
  stocks: { select: { quantity: true } },
} as const;

@Injectable()
export class ProductsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private toDecimal(
    value: Decimal | string | number | null | undefined,
  ): Decimal | null | undefined {
    if (value === null || value === undefined) {
      // Preserve `undefined` so Prisma skips the field on partial updates
      // instead of erroring with "Argument price must not be null".
      return value;
    }

    if (value instanceof Decimal) {
      return value;
    }

    return new Decimal(value);
  }

  private normalizeDecimalPayload<
    T extends Prisma.ProductCreateInput | Prisma.ProductUpdateInput,
  >(data: T): T {
    const payload = { ...(data as Record<string, unknown>) };

    if (
      Object.prototype.hasOwnProperty.call(payload, 'price') &&
      payload.price !== undefined
    ) {
      payload.price = this.toDecimal(
        payload.price as Decimal | string | number | null | undefined,
      ) as Decimal | null | undefined;
    }

    if (
      Object.prototype.hasOwnProperty.call(payload, 'costPrice') &&
      payload.costPrice !== undefined
    ) {
      payload.costPrice = this.toDecimal(
        payload.costPrice as Decimal | string | number | null | undefined,
      ) as Decimal | null | undefined;
    }

    return payload as T;
  }

  async create(data: Prisma.ProductCreateInput): Promise<Product> {
    return this.prismaService.product.create({
      data: this.normalizeDecimalPayload(data) as Prisma.ProductCreateInput,
      include: PRODUCT_INCLUDE,
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Product | null> {
    const client = tx ?? this.prismaService;
    return client.product.findFirst({
      where: {
        id,
        deletedAt: null,
        companyId,
      },
      include: PRODUCT_INCLUDE,
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    name?: string;
    sku?: string;
    barcode?: string;
    category?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'price' | 'stockQuantity';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: Product[]; total: number }> {
    const {
      companyId,
      search,
      name,
      sku,
      barcode,
      category,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      companyId,
      ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
      ...(sku ? { sku: { contains: sku, mode: 'insensitive' } } : {}),
      ...(barcode
        ? { barcode: { contains: barcode, mode: 'insensitive' } }
        : {}),
      ...(category
        ? { category: { contains: category, mode: 'insensitive' } }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.product.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.ProductUpdateInput,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Product> {
    const client = tx ?? this.prismaService;

    if (rowVersion !== undefined) {
      const result = await client.product.updateMany({
        where: { id, companyId, rowVersion },
        data: {
          ...(this.normalizeDecimalPayload(data) as Record<string, unknown>),
          rowVersion: { increment: 1 },
        },
      });

      if (result.count === 0) {
        const existing = await client.product.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Product with id ${id} not found`);
        }
        throw new ConflictException(
          `Product ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      return client.product.findUnique({
        where: { id },
        include: PRODUCT_INCLUDE,
      }) as Promise<Product>;
    }

    // Legacy path without rowVersion
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return client.product.update({
      where: { id },
      data: this.normalizeDecimalPayload(data) as Prisma.ProductUpdateInput,
      include: PRODUCT_INCLUDE,
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Product> {
    const client = tx ?? this.prismaService;

    if (rowVersion !== undefined) {
      const result = await client.product.updateMany({
        where: { id, companyId, rowVersion },
        data: {
          deletedAt: new Date(),
          isActive: false,
          rowVersion: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const existing = await client.product.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Product with id ${id} not found`);
        }
        throw new ConflictException(
          `Product ${id} was modified by another user. Please refresh and retry.`,
        );
      }
      return client.product.findUnique({
        where: { id },
        include: PRODUCT_INCLUDE,
      }) as Promise<Product>;
    }

    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return client.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
      include: PRODUCT_INCLUDE,
    });
  }

  /**
   * Find the company's unit of measure by name or create it. UnitOfMeasure has
   * a unique constraint on [companyId, name], so this is idempotent.
   */
  async findOrCreateUnitByName(
    name: string,
    companyId: string,
  ): Promise<{ id: string }> {
    const existing = await this.prismaService.unitOfMeasure.findFirst({
      where: { companyId, name, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing;

    return this.prismaService.unitOfMeasure.create({
      data: {
        companyId,
        name,
        abbreviation: name.slice(0, 20),
        decimalPlaces: 2,
        isActive: true,
      },
      select: { id: true },
    });
  }

  /**
   * Find the company's default (or first) active warehouse used to attribute
   * the initial stock quantity requested at product creation.
   */
  async findDefaultWarehouse(
    companyId: string,
  ): Promise<Pick<Warehouse, 'id'> | null> {
    return this.prismaService.warehouse.findFirst({
      where: { companyId, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
  }

  /**
   * Create (or top up) the Stock row for a product+warehouse and record an
   * OPENING_BALANCE movement. Used to persist the initial stockQuantity sent
   * with CreateProductDto.
   */
  async createInitialStock(params: {
    productId: string;
    warehouseId: string;
    companyId: string;
    quantity: number;
    userId?: string;
  }): Promise<void> {
    const { productId, warehouseId, companyId, quantity, userId } = params;

    await this.prismaService.$transaction(async (tx) => {
      const existing = await tx.stock.findFirst({
        where: { productId, warehouseId, companyId },
      });
      const beforeQuantity = existing?.quantity ?? 0;

      await tx.stock.upsert({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        create: {
          companyId,
          productId,
          warehouseId,
          quantity,
          reservedQuantity: 0,
          availableQuantity: quantity,
        },
        update: {
          quantity: { increment: quantity },
          availableQuantity: { increment: quantity },
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          warehouseId,
          type: 'OPENING_BALANCE',
          quantity,
          beforeQuantity,
          afterQuantity: beforeQuantity + quantity,
          referenceType: 'PRODUCT',
          referenceId: productId,
          comment: 'Initial stock on product creation',
          createdBy: userId,
        },
      });
    });
  }
}
