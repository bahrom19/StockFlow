import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierAddress } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class SupplierAddressesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  async findAllBySupplier(
    supplierId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress[]> {
    return this.getClient(tx).supplierAddress.findMany({
      where: { supplierId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findById(
    id: string,
    supplierId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress | null> {
    return this.getClient(tx).supplierAddress.findFirst({
      where: { id, supplierId, deletedAt: null },
    });
  }

  async create(
    data: Prisma.SupplierAddressCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress> {
    try {
      // NOTE: `await` (not bare `return`) is required so a rejected
      // Prisma promise is caught by this try/catch.
      return await this.getClient(tx).supplierAddress.create({ data });
    } catch (error: unknown) {
      // Prisma P2002: partial unique index violation — another active
      // default address already exists for this supplier (concurrent
      // assignment). Map to ConflictException; other errors propagate.
      const err = error as { code?: string };
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'Another default address already exists for this supplier',
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    supplierId: string,
    data: Prisma.SupplierAddressUpdateInput,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress> {
    const client = this.getClient(tx);

    try {
      // NOTE: `await` each Prisma call so rejections are caught below.
      if (rowVersion !== undefined) {
        const result = await client.supplierAddress.updateMany({
          where: { id, supplierId, rowVersion, deletedAt: null },
          data: { ...data, rowVersion: { increment: 1 } },
        });

        if (result.count === 0) {
          const existing = await client.supplierAddress.findFirst({
            where: { id, supplierId },
          });
          if (!existing) {
            throw new NotFoundException(
              `Supplier address with id ${id} not found`,
            );
          }
          throw new ConflictException(
            `Address ${id} was modified by another user. Please refresh and retry.`,
          );
        }

        return (await client.supplierAddress.findUnique({
          where: { id },
        })) as unknown as SupplierAddress;
      }

      return await client.supplierAddress.update({ where: { id }, data });
    } catch (error: unknown) {
      // Prisma P2002: partial unique index violation — another active
      // default address already exists for this supplier (concurrent
      // assignment on either the CAS or the plain path).
      const err = error as { code?: string };
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'Another default address already exists for this supplier',
        );
      }
      throw error;
    }
  }

  async softDelete(
    id: string,
    supplierId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.supplierAddress.updateMany({
        where: { id, supplierId, rowVersion, deletedAt: null },
        data: {
          deletedAt: new Date(),
          rowVersion: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const existing = await client.supplierAddress.findFirst({
          where: { id, supplierId },
        });
        if (!existing) {
          throw new NotFoundException(
            `Supplier address with id ${id} not found`,
          );
        }
        throw new ConflictException(
          `Address ${id} was modified by another user. Please refresh and retry.`,
        );
      }
      return client.supplierAddress.findUnique({
        where: { id },
      }) as unknown as SupplierAddress;
    }

    return client.supplierAddress.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findActiveDefault(
    supplierId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress | null> {
    return this.getClient(tx).supplierAddress.findFirst({
      where: {
        supplierId,
        isDefault: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async clearDefault(
    supplierId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).supplierAddress.updateMany({
      where: {
        supplierId,
        isDefault: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isDefault: false },
    });
  }
}
