import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Currency,
  FinancialTransactionType,
  Prisma,
  TransactionDirection,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateFinancialTransactionDto } from '../dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from '../dto/update-financial-transaction.dto';
import { FinancialTransactionQueryDto } from '../dto/financial-transaction-query.dto';
import { FinancialTransactionEntity } from '../entities/financial-transaction.entity';
import { FinancialTransactionMapper } from '../mappers/financial-transaction.mapper';
import { FinancialTransactionsRepository } from '../repositories/financial-transactions.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

@Injectable()
export class FinancialTransactionsService {
  constructor(
    private readonly repository: FinancialTransactionsRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateFinancialTransactionDto,
    currentUser: JwtPayload,
  ): Promise<FinancialTransactionEntity> {
    const fee = dto.fee || '0';
    const netAmount = new Decimal(dto.amount).minus(new Decimal(fee));

    const data: Prisma.FinancialTransactionCreateInput = {
      type: dto.type as FinancialTransactionType,
      direction: dto.direction as TransactionDirection,
      amount: dto.amount,
      fee: fee,
      netAmount: netAmount.toString(),
      currency: (dto.currency || 'KZT') as Currency,
      transactionDate: dto.transactionDate || new Date(),
      description: dto.description || null,
      referenceNumber: dto.referenceNumber || null,
      isReconciled: dto.isReconciled ?? false,
      cashAccount: dto.cashAccountId
        ? { connect: { id: dto.cashAccountId } }
        : undefined,
      bankAccount: dto.bankAccountId
        ? { connect: { id: dto.bankAccountId } }
        : undefined,
      referenceType: dto.referenceType || null,
      referenceId: dto.referenceId || null,
      company: { connect: { id: currentUser.companyId } },
      createdByUser: { connect: { id: currentUser.userId } },
    };

    const [tx] = await this.prismaService.$transaction(async (txCtx) => {
      const result = await this.repository.create(data, txCtx);
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'FinancialTransaction',
          entityId: result.id,
          action: 'CREATE',
          before: null,
          after: result,
        },
        txCtx,
      );
      return [result];
    });

    return FinancialTransactionMapper.toEntity(tx);
  }

  async findAll(
    query: FinancialTransactionQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: FinancialTransactionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');

    const result = await this.repository.findAll({
      companyId: currentUser.companyId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      type: query.type,
      direction: query.direction,
      cashAccountId: query.cashAccountId,
      bankAccountId: query.bankAccountId,
      isReconciled: query.isReconciled,
      search: query.search,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: FinancialTransactionMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    currentUser: JwtPayload,
  ): Promise<FinancialTransactionEntity> {
    const tx = await this.repository.findById(id, currentUser.companyId);
    if (!tx) throw new NotFoundException('Financial transaction not found');
    return FinancialTransactionMapper.toEntity(tx);
  }

  async update(
    id: string,
    dto: UpdateFinancialTransactionDto,
    currentUser: JwtPayload,
  ): Promise<FinancialTransactionEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Financial transaction not found');

    const data: Prisma.FinancialTransactionUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.referenceNumber !== undefined)
      data.referenceNumber = dto.referenceNumber;
    if (dto.isReconciled !== undefined) data.isReconciled = dto.isReconciled;
    if (dto.type !== undefined)
      data.type = dto.type as FinancialTransactionType;
    if (dto.direction !== undefined)
      data.direction = dto.direction as TransactionDirection;
    if (dto.currency !== undefined) data.currency = dto.currency as Currency;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.fee !== undefined) {
      data.fee = dto.fee;
      const fee = dto.fee || '0';
      data.netAmount = new Decimal(before.amount.toString())
        .minus(new Decimal(fee))
        .toString();
    }
    if (dto.cashAccountId !== undefined) {
      data.cashAccount = dto.cashAccountId
        ? { connect: { id: dto.cashAccountId } }
        : { disconnect: true };
    }
    if (dto.bankAccountId !== undefined) {
      data.bankAccount = dto.bankAccountId
        ? { connect: { id: dto.bankAccountId } }
        : { disconnect: true };
    }

    const [updated] = await this.prismaService.$transaction(async (txCtx) => {
      const result = await this.repository.update(
        id,
        data,
        currentUser.companyId,
        before.rowVersion,
        txCtx,
      );
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'FinancialTransaction',
          entityId: id,
          action: 'UPDATE',
          before,
          after: result,
        },
        txCtx,
      );
      return [result];
    });
    return FinancialTransactionMapper.toEntity(updated);
  }
}
