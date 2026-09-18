import { CustomerCreditTransaction as PrismaCustomerCreditTransaction } from '@prisma/client';
import { CustomerCreditTransactionEntity } from '../entities/customer-credit-transaction.entity';

/** G11-F2 — Prisma row → API entity. Decimal amounts leave as strings
 * (project-wide convention for monetary values across the API boundary). */
export class CustomerCreditTransactionMapper {
  static toEntity(
    prisma: PrismaCustomerCreditTransaction,
  ): CustomerCreditTransactionEntity {
    return new CustomerCreditTransactionEntity({
      id: prisma.id,
      companyId: prisma.companyId,
      customerId: prisma.customerId,
      direction: prisma.direction,
      amount: prisma.amount.toString(),
      currency: prisma.currency,
      referenceType: prisma.referenceType as CustomerCreditTransactionEntity['referenceType'],
      referenceId: prisma.referenceId,
      createdBy: prisma.createdBy,
      reason: prisma.reason,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deletedAt: prisma.deletedAt,
    });
  }

  static toEntityList(
    prismaList: PrismaCustomerCreditTransaction[],
  ): CustomerCreditTransactionEntity[] {
    return prismaList.map((row) => this.toEntity(row));
  }
}
