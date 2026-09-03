import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class SuppliersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  async create(
    data: Prisma.SupplierCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Supplier> {
    return this.getClient(tx).supplier.create({ data });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'companyName' | 'email';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: Supplier[]; total: number }> {
    const {
      companyId,
      search,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      companyId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.supplier.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.supplier.count({ where }),
    ]);

    return { items, total };
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Supplier | null> {
    return this.getClient(tx).supplier.findFirst({
      where: {
        id,
        deletedAt: null,
        companyId,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.SupplierUpdateInput,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Supplier> {
    const client = this.getClient(tx);

    // If rowVersion is provided, use optimistic locking
    if (rowVersion !== undefined) {
      const result = await client.supplier.updateMany({
        where: { id, companyId, rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.supplier.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Supplier with id ${id} not found`);
        }
        throw new ConflictException(
          `Supplier ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      return client.supplier.findUnique({
        where: { id },
      }) as unknown as Supplier;
    }

    // Legacy path without rowVersion (for create-only flows)
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Supplier with id ${id} not found`);
    }
    return client.supplier.update({ where: { id }, data });
  }

  // ── Duplicate checks (G1) ─────────────────────────────────────

  async findActiveByEmail(
    email: string,
    companyId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Supplier | null> {
    const client = this.getClient(tx);
    return client.supplier.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        companyId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findActiveByPhone(
    phone: string,
    companyId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Supplier | null> {
    const client = this.getClient(tx);
    return client.supplier.findFirst({
      where: {
        phone: { equals: phone, mode: 'insensitive' },
        companyId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findActiveByBin(
    bin: string,
    companyId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Supplier | null> {
    const client = this.getClient(tx);
    return client.supplier.findFirst({
      where: {
        bin: { equals: bin, mode: 'insensitive' },
        companyId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Supplier> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.supplier.updateMany({
        where: { id, companyId, rowVersion },
        data: {
          deletedAt: new Date(),
          isActive: false,
          rowVersion: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const existing = await client.supplier.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Supplier with id ${id} not found`);
        }
        throw new ConflictException(
          `Supplier ${id} was modified by another user. Please refresh and retry.`,
        );
      }
      return client.supplier.findUnique({
        where: { id },
      }) as unknown as Supplier;
    }

    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Supplier with id ${id} not found`);
    }
    return client.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}
