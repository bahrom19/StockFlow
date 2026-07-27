import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Task as PrismaTask, Prisma } from '@prisma/client';

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    companyId: string;
    skip?: number;
    take?: number;
    where?: Prisma.TaskWhereInput;
    orderBy?: Prisma.TaskOrderByWithRelationInput;
  }): Promise<[PrismaTask[], number]> {
    const { companyId, skip, take, where, orderBy } = params;
    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where: { ...where, companyId, deletedAt: null },
        skip,
        take,
        orderBy,
      }),
      this.prisma.task.count({
        where: { ...where, companyId, deletedAt: null },
      }),
    ]);
    return [items, total];
  }

  async findById(id: string, companyId: string): Promise<PrismaTask | null> {
    return this.prisma.task.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async findByIdOrThrow(id: string, companyId: string): Promise<PrismaTask> {
    const entity = await this.findById(id, companyId);
    if (!entity) throw new NotFoundException('Task not found');
    return entity;
  }

  async create(
    data: Prisma.TaskCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaTask> {
    const prisma = tx ?? this.prisma;
    return prisma.task.create({ data });
  }

  async update(params: {
    id: string;
    companyId: string;
    data: Prisma.TaskUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<PrismaTask> {
    const { id, companyId, data, tx } = params;
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    return prisma.task.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
