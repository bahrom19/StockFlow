import { Injectable } from '@nestjs/common';
import { Prisma, RefundStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

const refundInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
};

/** Sum of COMPLETED refund facts recorded so far for one SaleItem. */
export interface SalesRefundPreviousAggregate {
  quantity: number;
  fifoCost: Prisma.Decimal;
  total: Prisma.Decimal;
}

/**
 * G11-E E2: tenant-scoped persistence for the SalesRefund aggregate.
 *
 * Every read/write is scoped by `companyId`; nothing is ever looked up by id
 * alone when tenant ownership matters.
 */
@Injectable()
export class SalesRefundRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  async create(
    data: Prisma.SalesRefundUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    return this.getClient(tx).salesRefund.create({
      data,
      include: refundInclude,
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.getClient(tx).salesRefund.findFirst({
      where: { id, companyId, deletedAt: null },
      include: refundInclude,
    });
  }

  async findBySaleId(
    saleId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.getClient(tx).salesRefund.findMany({
      where: { saleId, companyId, deletedAt: null },
      include: refundInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Aggregate the durable COMPLETED refund facts per SaleItem for one Sale.
   *
   * This is the single source of truth for "how much has already been
   * refunded" (quantity) and "how much historical cost has already been
   * refunded" (fifoCost) — no denormalized `refundedQuantity` column exists.
   *
   * Scoped by companyId AND saleId, so a foreign tenant can never contribute.
   */
  async aggregateCompletedBySaleItem(
    saleId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Map<string, SalesRefundPreviousAggregate>> {
    const rows = await this.getClient(tx).salesRefundItem.groupBy({
      by: ['saleItemId'],
      where: {
        salesRefund: {
          saleId,
          companyId,
          status: RefundStatus.COMPLETED,
          deletedAt: null,
        },
      },
      _sum: { quantity: true, fifoCost: true, total: true },
    });

    const aggregates = new Map<string, SalesRefundPreviousAggregate>();
    for (const row of rows) {
      aggregates.set(row.saleItemId, {
        quantity: row._sum.quantity ?? 0,
        fifoCost: row._sum.fifoCost ?? new Prisma.Decimal(0),
        total: row._sum.total ?? new Prisma.Decimal(0),
      });
    }
    return aggregates;
  }
}