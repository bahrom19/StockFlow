import { Injectable } from '@nestjs/common';
import { CreditLimit as PrismaCreditLimit } from '@prisma/client';
import { CreditLimitEntity } from '../entities/credit-limit.entity';

@Injectable()
export class CreditLimitMapper {
  toEntity(prisma: PrismaCreditLimit): CreditLimitEntity {
    return new CreditLimitEntity({
      id: prisma.id,
      customerId: prisma.customerId,
      amount: prisma.amount.toNumber().toFixed(2),
      currency: prisma.currency,
      approvedBy: prisma.approvedBy ?? undefined,
      approvedAt: prisma.approvedAt ?? undefined,
      notes: prisma.notes ?? undefined,
      rowVersion: prisma.rowVersion,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  toEntityList(prismaList: PrismaCreditLimit[]): CreditLimitEntity[] {
    return prismaList.map((p) => this.toEntity(p));
  }
}
