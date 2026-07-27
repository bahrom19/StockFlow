import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, NormalBalance, Prisma } from '@prisma/client';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateChartOfAccountDto } from '../dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from '../dto/update-chart-of-account.dto';
import { ChartOfAccountQueryDto } from '../dto/chart-of-account-query.dto';
import { ChartOfAccountEntity } from '../entities/chart-of-account.entity';
import { ChartOfAccountMapper } from '../mappers/chart-of-account.mapper';
import { ChartOfAccountsRepository } from '../repositories/chart-of-accounts.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

@Injectable()
export class ChartOfAccountsService {
  constructor(
    private readonly repository: ChartOfAccountsRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateChartOfAccountDto,
    currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    const data: Prisma.ChartOfAccountCreateInput = {
      code: dto.code,
      name: dto.name,
      description: dto.description || null,
      accountType: dto.accountType as AccountType,
      normalBalance: dto.normalBalance as NormalBalance,
      isActive: dto.isActive ?? true,
      isSystem: dto.isSystem ?? false,
      isCashOrBank: dto.isCashOrBank ?? false,
      parent: dto.parentId ? { connect: { id: dto.parentId } } : undefined,
      level: dto.level ?? 0,
      sortOrder: dto.sortOrder ?? 0,
      company: { connect: { id: currentUser.companyId } },
    };

    const [account] = await this.prismaService.$transaction(async (tx) => {
      const result = await this.repository.create(data, tx);
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'ChartOfAccount',
          entityId: result.id,
          action: 'CREATE',
          before: null,
          after: result,
        },
        tx,
      );
      return [result];
    });

    return ChartOfAccountMapper.toEntity(account);
  }

  async findAll(
    query: ChartOfAccountQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: ChartOfAccountEntity[];
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
      accountType: query.accountType,
      isActive: query.isActive,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: ChartOfAccountMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    const account = await this.repository.findById(id, currentUser.companyId);
    if (!account) throw new NotFoundException('Chart of account not found');
    return ChartOfAccountMapper.toEntity(account);
  }

  async update(
    id: string,
    dto: UpdateChartOfAccountDto,
    currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Chart of account not found');

    const data: Prisma.ChartOfAccountUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.accountType !== undefined)
      data.accountType = dto.accountType as AccountType;
    if (dto.normalBalance !== undefined)
      data.normalBalance = dto.normalBalance as NormalBalance;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isSystem !== undefined) data.isSystem = dto.isSystem;
    if (dto.isCashOrBank !== undefined) data.isCashOrBank = dto.isCashOrBank;
    if (dto.parentId !== undefined) {
      data.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
        : { disconnect: true };
    }
    if (dto.level !== undefined) data.level = dto.level;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

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
          entityType: 'ChartOfAccount',
          entityId: id,
          action: 'UPDATE',
          before,
          after: result,
        },
        tx,
      );
      return [result];
    });
    return ChartOfAccountMapper.toEntity(updated);
  }

  async softDelete(
    id: string,
    currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Chart of account not found');

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
          entityType: 'ChartOfAccount',
          entityId: id,
          action: 'DELETE',
          before,
          after: null,
        },
        tx,
      );
      return [result];
    });
    return ChartOfAccountMapper.toEntity(deleted);
  }
}
