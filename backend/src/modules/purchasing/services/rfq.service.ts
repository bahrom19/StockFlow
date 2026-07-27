import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RFQStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CreateRFQDto } from '../dto/create-rfq.dto';
import { RFQQQueryDto } from '../dto/rfq-query.dto';
import { RFQEntity } from '../entities/rfq.entity';
import { RFQMapper } from '../mappers/rfq.mapper';
import { RFQRepository } from '../repositories/rfq.repository';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { PurchaseRFQCreatedEvent } from '../events/purchase-rfq-created.event';

@Injectable()
export class RFQService {
  private readonly logger = new Logger(RFQService.name);

  constructor(
    private readonly repository: RFQRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateRFQDto,
    userId: string,
    companyId: string,
  ): Promise<RFQEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const rfqNumber =
        dto.rfqNumber ??
        `RFQ-${companyId.substring(0, 8).toUpperCase()}-${Date.now()}`;
      const existing = await this.repository.findByRfqNumber(
        rfqNumber,
        companyId,
        tx,
      );
      if (existing)
        throw new BadRequestException(
          `RFQ number "${rfqNumber}" already exists`,
        );

      const itemsData = dto.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
      }));

      const rfq = await this.repository.create(
        {
          rfqNumber,
          rfqDate: dto.rfqDate ? new Date(dto.rfqDate) : new Date(),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          status: RFQStatus.DRAFT,
          notes: dto.notes,
          createdBy: userId,
          company: { connect: { id: companyId } },
          items: { create: itemsData },
        },
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'RFQ',
          entityId: rfq.id,
          action: 'CREATE',
          before: null,
          after: { rfqNumber, itemsCount: itemsData.length },
        },
        tx,
      );

      return RFQMapper.toEntity(rfq);
    });
  }

  async findAll(
    query: RFQQQueryDto,
    companyId: string,
  ): Promise<{
    items: RFQEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');

    const result = await this.repository.findAll({
      companyId,
      search: query.search,
      status: query.status as RFQStatus | undefined,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: RFQMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, companyId: string): Promise<RFQEntity> {
    const rfq = await this.repository.findById(id, companyId);
    if (!rfq) throw new NotFoundException(`RFQ ${id} not found`);
    return RFQMapper.toEntity(rfq);
  }

  async softDelete(id: string, companyId: string): Promise<void> {
    const existing = await this.repository.findById(id, companyId);
    if (!existing) throw new NotFoundException(`RFQ ${id} not found`);
    if (existing.status !== RFQStatus.DRAFT)
      throw new BadRequestException('Only DRAFT RFQs can be deleted');
    await this.repository.softDelete(id, companyId);
  }

  async transitionStatus(
    id: string,
    newStatus: RFQStatus,
    userId: string,
    companyId: string,
  ): Promise<RFQEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const rfq = await this.repository.findById(id, companyId, tx);
      if (!rfq) throw new NotFoundException(`RFQ ${id} not found`);

      const current = rfq.status as RFQStatus;
      const allowed: Record<RFQStatus, RFQStatus[]> = {
        DRAFT: ['SENT', 'CANCELLED'],
        SENT: ['RECEIVED', 'CANCELLED'],
        RECEIVED: ['CLOSED', 'CANCELLED'],
        CLOSED: [],
        CANCELLED: [],
      };
      const allowedTransitions = allowed[current] ?? [];
      if (!allowedTransitions.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${current} to ${newStatus}`,
        );
      }

      const updateData: Prisma.RFQUpdateInput = { status: newStatus };
      if (newStatus === RFQStatus.SENT && !rfq.approvedBy) {
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }

      const updated = await this.repository.update(
        id,
        updateData,
        companyId,
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'RFQ',
          entityId: id,
          action: 'TRANSITION',
          before: { status: current },
          after: { status: newStatus },
        },
        tx,
      );

      // Publish purchase.rfq.created event when sent
      if (newStatus === RFQStatus.SENT) {
        try {
          await this.eventBus.publish(
            new PurchaseRFQCreatedEvent({
              rfqId: id,
              companyId,
              rfqNumber: rfq.rfqNumber,
              rfqDate: rfq.rfqDate,
              expectedDate: rfq.expectedDate,
              createdBy: userId,
              items: (await tx.rFQItem.findMany({ where: { rfqId: id } })).map(
                (i) => ({
                  productId: i.productId,
                  quantity: i.quantity,
                }),
              ),
            }),
            { context: { transactionClient: tx } },
          );
        } catch (err) {
          this.logger.warn(
            `Failed to publish purchase.rfq.created: ${(err as Error).message}`,
          );
        }
      }

      return RFQMapper.toEntity(updated);
    });
  }
}
