import { Injectable, NotFoundException } from '@nestjs/common';
import { CashShift, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

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
  ): Promise<CashShift | null> {
    return this.prismaService.cashShift.findFirst({
      where: { warehouseId, cashierId, companyId, status: 'OPEN' },
    });
  }

  async update(
    id: string,
    data: Prisma.CashShiftUpdateInput,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CashShift> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Cash shift with id ${id} not found`);
    }
    return this.getClient(tx).cashShift.update({ where: { id }, data });
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
