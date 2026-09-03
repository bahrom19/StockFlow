import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierContact } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class SupplierContactsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  async findAllBySupplier(
    supplierId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierContact[]> {
    return this.getClient(tx).supplierContact.findMany({
      where: { supplierId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findById(
    id: string,
    supplierId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierContact | null> {
    return this.getClient(tx).supplierContact.findFirst({
      where: { id, supplierId, deletedAt: null },
    });
  }

  async create(
    data: Prisma.SupplierContactCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierContact> {
    return this.getClient(tx).supplierContact.create({ data });
  }

  async update(
    id: string,
    supplierId: string,
    data: Prisma.SupplierContactUpdateInput,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierContact> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.supplierContact.updateMany({
        where: { id, supplierId, rowVersion, deletedAt: null },
        data: { ...data, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.supplierContact.findFirst({
          where: { id, supplierId },
        });
        if (!existing) {
          throw new NotFoundException(
            `Supplier contact with id ${id} not found`,
          );
        }
        throw new ConflictException(
          `Contact ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      return client.supplierContact.findUnique({
        where: { id },
      }) as unknown as SupplierContact;
    }

    return client.supplierContact.update({
      where: { id },
      data,
    });
  }

  async softDelete(
    id: string,
    supplierId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierContact> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.supplierContact.updateMany({
        where: { id, supplierId, rowVersion, deletedAt: null },
        data: {
          deletedAt: new Date(),
          rowVersion: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const existing = await client.supplierContact.findFirst({
          where: { id, supplierId },
        });
        if (!existing) {
          throw new NotFoundException(
            `Supplier contact with id ${id} not found`,
          );
        }
        throw new ConflictException(
          `Contact ${id} was modified by another user. Please refresh and retry.`,
        );
      }
      return client.supplierContact.findUnique({
        where: { id },
      }) as unknown as SupplierContact;
    }

    return client.supplierContact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findActivePrimary(
    supplierId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierContact | null> {
    return this.getClient(tx).supplierContact.findFirst({
      where: {
        supplierId,
        isPrimary: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async clearPrimary(
    supplierId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).supplierContact.updateMany({
      where: {
        supplierId,
        isPrimary: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isPrimary: false },
    });
  }
}
