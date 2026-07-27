import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashAccountType, Currency, Prisma } from '@prisma/client';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateCashAccountDto } from '../dto/create-cash-account.dto';
import { UpdateCashAccountDto } from '../dto/update-cash-account.dto';
import { CashAccountQueryDto } from '../dto/cash-account-query.dto';
import { CashAccountEntity } from '../entities/cash-account.entity';
import { CashAccountMapper } from '../mappers/cash-account.mapper';
import { CashAccountsRepository } from '../repositories/cash-accounts.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

@Injectable()
export class CashAccountsService {
  constructor(
    private readonly repository: CashAccountsRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateCashAccountDto,
    currentUser: JwtPayload,
  ): Promise<CashAccountEntity> {
    const data: Prisma.CashAccountCreateInput = {
      name: dto.name,
      type: (dto.type || 'REGISTER') as CashAccountType,
      currency: (dto.currency || 'KZT') as Currency,
      isActive: dto.isActive ?? true,
      description: dto.description || null,
      warehouse: dto.warehouseId
        ? { connect: { id: dto.warehouseId } }
        : undefined,
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
          entityType: 'CashAccount',
          entityId: result.id,
          action: 'CREATE',
          before: null,
          after: result,
        },
        tx,
      );
      return [result];
    });

    return CashAccountMapper.toEntity(account);
  }

  async findAll(
    query: CashAccountQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: CashAccountEntity[];
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
      items: CashAccountMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    currentUser: JwtPayload,
  ): Promise<CashAccountEntity> {
    const account = await this.repository.findById(id, currentUser.companyId);
    if (!account) throw new NotFoundException('Cash account not found');
    return CashAccountMapper.toEntity(account);
  }

  async update(
    id: string,
    dto: UpdateCashAccountDto,
    currentUser: JwtPayload,
  ): Promise<CashAccountEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Cash account not found');

    const data: Prisma.CashAccountUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type as CashAccountType;
    if (dto.currency !== undefined) data.currency = dto.currency as Currency;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.warehouseId !== undefined) {
      data.warehouse = dto.warehouseId
        ? { connect: { id: dto.warehouseId } }
        : { disconnect: true };
    }
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
          entityType: 'CashAccount',
          entityId: id,
          action: 'UPDATE',
          before,
          after: result,
        },
        tx,
      );
      return [result];
    });
    return CashAccountMapper.toEntity(updated);
  }

  async softDelete(
    id: string,
    currentUser: JwtPayload,
  ): Promise<CashAccountEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Cash account not found');

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
          entityType: 'CashAccount',
          entityId: id,
          action: 'DELETE',
          before,
          after: null,
        },
        tx,
      );
      return [result];
    });
    return CashAccountMapper.toEntity(deleted);
  }
}
