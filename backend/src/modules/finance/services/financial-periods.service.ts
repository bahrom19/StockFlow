import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinancialPeriodStatus, Prisma } from '@prisma/client';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateFinancialPeriodDto } from '../dto/create-financial-period.dto';
import { UpdateFinancialPeriodDto } from '../dto/update-financial-period.dto';
import { FinancialPeriodQueryDto } from '../dto/financial-period-query.dto';
import { FinancialPeriodEntity } from '../entities/financial-period.entity';
import { FinancialPeriodMapper } from '../mappers/financial-period.mapper';
import { FinancialPeriodsRepository } from '../repositories/financial-periods.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

@Injectable()
export class FinancialPeriodsService {
  constructor(
    private readonly repository: FinancialPeriodsRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateFinancialPeriodDto,
    currentUser: JwtPayload,
  ): Promise<FinancialPeriodEntity> {
    const existing = await this.repository.findByYearMonth(
      currentUser.companyId,
      dto.year,
      dto.month,
    );
    if (existing)
      throw new ConflictException(
        'Financial period already exists for this year/month',
      );

    const data: Prisma.FinancialPeriodCreateInput = {
      name: dto.name,
      year: dto.year,
      month: dto.month,
      startDate: dto.startDate,
      endDate: dto.endDate,
      status: 'OPEN' as FinancialPeriodStatus,
      notes: dto.notes || null,
      company: { connect: { id: currentUser.companyId } },
      openedByUser: { connect: { id: currentUser.userId } },
    };

    const [period] = await this.prismaService.$transaction(async (tx) => {
      const result = await this.repository.create(data, tx);
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'FinancialPeriod',
          entityId: result.id,
          action: 'CREATE',
          before: null,
          after: result,
        },
        tx,
      );
      return [result];
    });

    return FinancialPeriodMapper.toEntity(period);
  }

  async findAll(
    query: FinancialPeriodQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: FinancialPeriodEntity[];
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
      year: query.year,
      month: query.month,
      status: query.status,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: FinancialPeriodMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    currentUser: JwtPayload,
  ): Promise<FinancialPeriodEntity> {
    const period = await this.repository.findById(id, currentUser.companyId);
    if (!period) throw new NotFoundException('Financial period not found');
    return FinancialPeriodMapper.toEntity(period);
  }

  async update(
    id: string,
    dto: UpdateFinancialPeriodDto,
    currentUser: JwtPayload,
  ): Promise<FinancialPeriodEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Financial period not found');

    const data: Prisma.FinancialPeriodUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;

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
          entityType: 'FinancialPeriod',
          entityId: id,
          action: 'UPDATE',
          before,
          after: result,
        },
        tx,
      );
      return [result];
    });
    return FinancialPeriodMapper.toEntity(updated);
  }

  async close(
    id: string,
    currentUser: JwtPayload,
  ): Promise<FinancialPeriodEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Financial period not found');
    if (before.status === 'CLOSED')
      throw new BadRequestException('Period is already closed');
    if (before.status === 'CLOSING')
      throw new BadRequestException('Period is already being closed');

    const data: Prisma.FinancialPeriodUpdateInput = {
      status: 'CLOSED' as FinancialPeriodStatus,
      closedAt: new Date(),
      closedByUser: { connect: { id: currentUser.userId } },
    };

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
          entityType: 'FinancialPeriod',
          entityId: id,
          action: 'CLOSE',
          before,
          after: result,
        },
        tx,
      );
      return [result];
    });
    return FinancialPeriodMapper.toEntity(updated);
  }
}
