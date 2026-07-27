import { Injectable } from '@nestjs/common';
import { Task as PrismaTask } from '@prisma/client';
import { TaskEntity } from '../entities/task.entity';

@Injectable()
export class TaskMapper {
  toEntity(prisma: PrismaTask): TaskEntity {
    return new TaskEntity({
      id: prisma.id,
      companyId: prisma.companyId,
      customerId: prisma.customerId ?? undefined,
      title: prisma.title,
      description: prisma.description ?? undefined,
      status: prisma.status,
      priority: prisma.priority,
      dueDate: prisma.dueDate ?? undefined,
      assignedTo: prisma.assignedTo ?? undefined,
      completedAt: prisma.completedAt ?? undefined,
      notes: prisma.notes ?? undefined,
      rowVersion: prisma.rowVersion,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deletedAt: prisma.deletedAt ?? undefined,
    });
  }

  toEntityList(prismaList: PrismaTask[]): TaskEntity[] {
    return prismaList.map((p) => this.toEntity(p));
  }
}
