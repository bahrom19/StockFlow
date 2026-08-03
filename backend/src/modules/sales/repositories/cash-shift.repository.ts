import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashShift, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

// Scalar field names of the CashShift model — used to separate scalar updates
// from relation writes in update() because updateMany accepts only scalar
// fields (CashShiftUpdateManyMutationInput).
const CASH_SHIFT_SCALAR_KEYS = new Set<string>(
  Object.values(Prisma.CashShiftScalarFieldEnum),
);

@Injectable()
export class CashShiftRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.CashShiftCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CashShift> {
    return this.getClient(tx).cashShift.create({ data });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CashShift | null> {
    return this.getClient(tx).cashShift.findFirst({
      where: { id, companyId },
    });
  }

  async findOpenShift(
    warehouseId: string,
    cashierId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CashShift | null> {
    return this.getClient(tx).cashShift.findFirst({
      where: { warehouseId, cashierId, companyId, status: 'OPEN' },
    });
  }

  /**
   * Optimistic-locking update (Blocker B1 pattern): uses updateMany with a
   * rowVersion guard so concurrent writers cannot silently overwrite each
   * other (lost updates). Relation writes are applied via a separate
   * cashShift.update after the lock check succeeds, because updateMany
   * accepts only scalar fields.
   */
  async update(
    id: string,
    data: Prisma.CashShiftUpdateInput,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CashShift> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const scalarData: Record<string, unknown> = {};
      const relationData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (CASH_SHIFT_SCALAR_KEYS.has(key)) {
          scalarData[key] = value;
        } else {
          relationData[key] = value;
        }
      }

      const result = await client.cashShift.updateMany({
        where: { id, companyId, rowVersion },
        data: { ...scalarData, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.cashShift.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Cash shift with id ${id} not found`);
        }
        throw new ConflictException(
          `Cash shift ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      if (Object.keys(relationData).length > 0) {
        await client.cashShift.update({ where: { id }, data: relationData });
      }

      return client.cashShift.findUnique({
        where: { id },
      }) as unknown as CashShift;
    }

    // Legacy path without rowVersion
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Cash shift with id ${id} not found`);
    }
    return client.cashShift.update({ where: { id }, data });
  }

  async listByCompany(
    companyId: string,
    params: {
      warehouseId?: string;
      cashierId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ items: CashShift[]; total: number }> {
    const { warehouseId, cashierId, status, page = 1, limit = 20 } = params;
    const where: Prisma.CashShiftWhereInput = { companyId };
    if (warehouseId) where.warehouseId = warehouseId;
    if (cashierId) where.cashierId = cashierId;
    if (status) where.status = status as 'OPEN' | 'CLOSED';

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.cashShift.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.cashShift.count({ where }),
    ]);
    return { items, total };
  }
}
