import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateBankAccountDto } from '../dto/create-bank-account.dto';
import { UpdateBankAccountDto } from '../dto/update-bank-account.dto';
import { BankAccountQueryDto } from '../dto/bank-account-query.dto';
import { BankAccountEntity } from '../entities/bank-account.entity';
import { BankAccountMapper } from '../mappers/bank-account.mapper';
import { BankAccountsRepository } from '../repositories/bank-accounts.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly repository: BankAccountsRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateBankAccountDto,
    currentUser: JwtPayload,
  ): Promise<BankAccountEntity> {
    const data: Prisma.BankAccountCreateInput = {
      bankName: dto.bankName,
      accountNumber: dto.accountNumber,
      accountName: dto.accountName || null,
      iban: dto.iban || null,
      bic: dto.bic || null,
      currency: (dto.currency || 'KZT') as Currency,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
      description: dto.description || null,
      chartOfAccount: dto.chartOfAccountId
        ? { connect: { id: dto.chartOfAccountId } }
        : undefined,
      company: { connect: { id: currentUser.companyId } },
    };

    const [account] = await this.prismaService.$transaction(async (tx) => {
      const result = await this.repository.create(data, tx);
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'BankAccount',
          entityId: result.id,
          action: 'CREATE',
          before: null,
          after: result,
        },
        tx,
      );
      return [result];
    });

    return BankAccountMapper.toEntity(account);
  }

  async findAll(
    query: BankAccountQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: BankAccountEntity[];
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
      search: query.search,
      isActive: query.isActive,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: BankAccountMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    currentUser: JwtPayload,
  ): Promise<BankAccountEntity> {
    const account = await this.repository.findById(id, currentUser.companyId);
    if (!account) throw new NotFoundException('Bank account not found');
    return BankAccountMapper.toEntity(account);
  }

  async update(
    id: string,
    dto: UpdateBankAccountDto,
    currentUser: JwtPayload,
  ): Promise<BankAccountEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Bank account not found');

    const data: Prisma.BankAccountUpdateInput = {};
    if (dto.bankName !== undefined) data.bankName = dto.bankName;
    if (dto.accountNumber !== undefined) data.accountNumber = dto.accountNumber;
    if (dto.accountName !== undefined) data.accountName = dto.accountName;
    if (dto.iban !== undefined) data.iban = dto.iban;
    if (dto.bic !== undefined) data.bic = dto.bic;
    if (dto.currency !== undefined) data.currency = dto.currency as Currency;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.chartOfAccountId !== undefined) {
      data.chartOfAccount = dto.chartOfAccountId
        ? { connect: { id: dto.chartOfAccountId } }
        : { disconnect: true };
    }

    const [updated] = await this.prismaService.$transaction(async (tx) => {
      const result = await this.repository.update(
        id,
        data,
        currentUser.companyId,
        before.rowVersion,
        tx,
      );
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'BankAccount',
          entityId: id,
          action: 'UPDATE',
          before,
          after: result,
        },
        tx,
      );
      return [result];
    });
    return BankAccountMapper.toEntity(updated);
  }

  async softDelete(
    id: string,
    currentUser: JwtPayload,
  ): Promise<BankAccountEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Bank account not found');

    const [deleted] = await this.prismaService.$transaction(async (tx) => {
      const result = await this.repository.softDelete(
        id,
        currentUser.companyId,
        before.rowVersion,
        tx,
      );
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'BankAccount',
          entityId: id,
          action: 'DELETE',
          before,
          after: null,
        },
        tx,
      );
      return [result];
    });
    return BankAccountMapper.toEntity(deleted);
  }
}
