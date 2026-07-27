import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

export interface AuditLogEntry {
  companyId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  before: unknown | null;
  after: unknown | null;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prismaService: PrismaService) {}

  async log(
    entry: AuditLogEntry,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prismaService;
    await client.auditLog.create({
      data: {
        companyId: entry.companyId,
        userId: entry.userId,
        entity: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        oldValues: entry.before
          ? JSON.parse(JSON.stringify(entry.before))
          : undefined,
        newValues: entry.after
          ? JSON.parse(JSON.stringify(entry.after))
          : undefined,
      },
    });
  }
}
