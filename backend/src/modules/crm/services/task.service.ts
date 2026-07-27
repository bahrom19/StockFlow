import { Inject, Injectable } from '@nestjs/common';
import { Prisma, TaskStatus, TaskPriority } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TaskRepository } from '../repositories/task.repository';
import { TaskMapper } from '../mappers/task.mapper';
import { TaskEntity } from '../entities/task.entity';
import { CreateTaskDto, UpdateTaskDto, TaskQueryDto } from '../dto/task.dto';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus, EVENT_BUS } from '../../../common/events';

@Injectable()
export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly mapper: TaskMapper,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateTaskDto,
    companyId: string,
    userId: string,
  ): Promise<TaskEntity> {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.TaskCreateInput = {
        title: dto.title,
        status: (dto.status as TaskStatus) ?? TaskStatus.TODO,
        priority: (dto.priority as TaskPriority) ?? TaskPriority.MEDIUM,
        description: dto.description,
        assignedTo: dto.assignedTo,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        company: { connect: { id: companyId } },
      };
      if (dto.customerId) data.customer = { connect: { id: dto.customerId } };
      const created = await this.repository.create(data, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'Task',
        entityId: created.id,
        action: 'CREATE',
        before: null,
        after: created,
      });
      return this.mapper.toEntity(created);
    });
  }

  async findAll(
    query: TaskQueryDto,
    companyId: string,
  ): Promise<{
    items: TaskEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      customerId,
      status,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.TaskWhereInput = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status as TaskStatus;
    if (priority) where.priority = priority as TaskPriority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.repository.findMany({
      companyId,
      skip,
      take: limit,
      where,
      orderBy: { [sortBy]: sortOrder },
    });
    return { items: this.mapper.toEntityList(items), total, page, limit };
  }

  async findOne(id: string, companyId: string): Promise<TaskEntity> {
    const entity = await this.repository.findByIdOrThrow(id, companyId);
    return this.mapper.toEntity(entity);
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    companyId: string,
    userId: string,
  ): Promise<TaskEntity> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      const data: Prisma.TaskUpdateInput = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.status !== undefined) data.status = dto.status as TaskStatus;
      if (dto.priority !== undefined)
        data.priority = dto.priority as TaskPriority;
      if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;
      if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (dto.status === 'DONE' && !before.completedAt) {
        data.completedAt = new Date();
      }
      const updated = await this.repository.update({ id, companyId, data, tx });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'Task',
        entityId: id,
        action: 'UPDATE',
        before,
        after: updated,
      });
      return this.mapper.toEntity(updated);
    });
  }

  async remove(id: string, companyId: string, userId: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      await this.repository.softDelete(id, companyId, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'Task',
        entityId: id,
        action: 'DELETE',
        before,
        after: null,
      });
    });
  }
}
