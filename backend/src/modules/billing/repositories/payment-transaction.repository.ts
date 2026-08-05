import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentTransaction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class PaymentTransactionRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.PaymentTransactionCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentTransaction> {
    return this.getClient(tx).paymentTransaction.create({ data });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentTransaction | null> {
    return this.getClient(tx).paymentTransaction.findFirst({
      where: { id, companyId },
    });
  }

  async findByInvoice(
    invoiceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentTransaction[]> {
    return this.getClient(tx).paymentTransaction.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: Prisma.PaymentTransactionUpdateInput,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentTransaction> {
    const client = this.getClient(tx);
    if (rowVersion !== undefined) {
      const result = await client.paymentTransaction.updateMany({
        where: { id, companyId, rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });
      if (result.count === 0) {
        const existing = await client.paymentTransaction.findFirst({
          where: { id, companyId },
        });
        if (!existing)
          throw new NotFoundException(`PaymentTransaction ${id} not found`);
        throw new ConflictException(
          `PaymentTransaction ${id} was modified by another user`,
        );
      }
      return client.paymentTransaction.findUnique({
        where: { id },
      }) as unknown as PaymentTransaction;
    }
    const existing = await this.findById(id, companyId, tx);
    if (!existing)
      throw new NotFoundException(`PaymentTransaction ${id} not found`);
    return client.paymentTransaction.update({ where: { id }, data });
  }
}
