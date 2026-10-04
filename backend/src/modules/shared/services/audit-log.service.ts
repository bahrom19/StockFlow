import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

export interface AuditLogEntry {
  /**
   * G16-N-4 P0-A: nullable so GLOBAL resource mutations (SubscriptionPlan,
   * Permission) record truthful provenance. A platform operator acts outside
   * every tenant, so there is no owning companyId to write. Tenant actions
   * must keep passing their real companyId — a tenant audit row written with
   * NULL, or a platform row written with a tenant id, would both misstate the
   * security boundary.
   */
  companyId: string | null;
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
