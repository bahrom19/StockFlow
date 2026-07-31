import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';

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
    });
  }
}
