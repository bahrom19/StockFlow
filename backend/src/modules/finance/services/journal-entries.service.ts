import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JournalEntryStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from '../dto/update-journal-entry.dto';
import { JournalEntryQueryDto } from '../dto/journal-entry-query.dto';
import { JournalEntryEntity } from '../entities/journal-entry.entity';
import { JournalEntryMapper } from '../mappers/journal-entry.mapper';
import { JournalEntriesRepository } from '../repositories/journal-entries.repository';
import { FinancialPeriodsRepository } from '../repositories/financial-periods.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

@Injectable()
export class JournalEntriesService {
  constructor(
    private readonly repository: JournalEntriesRepository,
    private readonly periodsRepository: FinancialPeriodsRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateJournalEntryDto,
    currentUser: JwtPayload,
  ): Promise<JournalEntryEntity> {
    // Atomic transaction: validate period + generate entry number + create entry + audit log
    const entry = await this.prismaService.$transaction(async (tx) => {
      const period = await this.periodsRepository.findById(
        dto.financialPeriodId,
        currentUser.companyId,
        tx,
      );
      if (!period) throw new NotFoundException('Financial period not found');
      if (period.status !== 'OPEN')
        throw new BadRequestException('Financial period is not open');

      let totalDebit = new Decimal(0);
      let totalCredit = new Decimal(0);

      for (const line of dto.lines) {
        totalDebit = totalDebit.add(new Decimal(line.debit || 0));
        totalCredit = totalCredit.add(new Decimal(line.credit || 0));
      }

      if (!totalDebit.equals(totalCredit)) {
        throw new BadRequestException(
          `Journal entry is unbalanced: debit=${totalDebit.toString()}, credit=${totalCredit.toString()}`,
        );
      }

      const entryNumber = await this.repository.getNextEntryNumberInTransaction(
        tx,
        currentUser.companyId,
        dto.financialPeriodId,
      );

      const result = await this.repository.createInTransaction(tx, {
        entryNumber,
        entryDate: dto.entryDate || new Date(),
        description: dto.description || null,
        status: 'DRAFT',
        totalDebit: totalDebit.toString(),
        totalCredit: totalCredit.toString(),
        referenceType: dto.referenceType || null,
        referenceId: dto.referenceId || null,
        companyId: currentUser.companyId,
        financialPeriodId: dto.financialPeriodId,
        createdBy: currentUser.userId,
        lines: dto.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit || '0',
          credit: l.credit || '0',
          description: l.description || null,
        })),
      });

      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'JournalEntry',
          entityId: result.id,
          action: 'CREATE',
          before: null,
          after: result,
        },
        tx,
      );

      return result;
    });

    return JournalEntryMapper.toEntity(entry);
  }

  async findAll(
    query: JournalEntryQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: JournalEntryEntity[];
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
      financialPeriodId: query.financialPeriodId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      status: query.status,
      search: query.search,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: JournalEntryMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    currentUser: JwtPayload,
  ): Promise<JournalEntryEntity> {
    const entry = await this.repository.findById(id, currentUser.companyId);
    if (!entry) throw new NotFoundException('Journal entry not found');
    return JournalEntryMapper.toEntity(entry);
  }

  async update(
    id: string,
    dto: UpdateJournalEntryDto,
    currentUser: JwtPayload,
  ): Promise<JournalEntryEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Journal entry not found');
    if (before.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT entries can be updated');

    const data: Prisma.JournalEntryUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;

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
          entityType: 'JournalEntry',
          entityId: id,
          action: 'UPDATE',
          before,
          after: result,
        },
        tx,
      );
      return [result];
    });
    return JournalEntryMapper.toEntity(updated);
  }

  async post(id: string, currentUser: JwtPayload): Promise<JournalEntryEntity> {
    // Atomic transaction: validate period status + update + audit log
    const [updated] = await this.prismaService.$transaction(async (tx) => {
      const before = await this.repository.findById(
        id,
        currentUser.companyId,
        tx,
      );
      if (!before) throw new NotFoundException('Journal entry not found');
      if (before.status !== 'DRAFT')
        throw new BadRequestException('Only DRAFT entries can be posted');

      const period = await this.periodsRepository.findById(
        before.financialPeriodId,
        currentUser.companyId,
        tx,
      );
      if (!period || period.status !== 'OPEN')
        throw new BadRequestException('Financial period is not open');

      const data: Prisma.JournalEntryUpdateInput = {
        status: 'POSTED' as JournalEntryStatus,
        postedAt: new Date(),
        postedByUser: { connect: { id: currentUser.userId } },
      };

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
          entityType: 'JournalEntry',
          entityId: id,
          action: 'POST',
          before,
          after: result,
        },
        tx,
      );
      return [result];
    });
    return JournalEntryMapper.toEntity(updated);
  }
}
