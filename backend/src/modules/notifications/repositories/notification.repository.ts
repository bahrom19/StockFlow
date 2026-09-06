import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

/** Flat notification row (no nested relations) — per-user dedupeKey included. */
export type NotificationCreateRow = Prisma.NotificationUncheckedCreateInput;

export interface NotificationQuery {
  page: number;
  limit: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

/**
 * Data access for the Notification table (N3).
 *
 * Every user-facing query is scoped by `companyId` AND `userId` — both come
 * from the JWT payload at the service layer, never from a body/entity.
 */
@Injectable()
export class NotificationRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  /**
   * Resolve notification recipients: all ACTIVE members of the company.
   *
   * Activity criteria mirror JwtStrategy.validate() exactly — a user is
   * active when `user.isActive === true` and `user.deletedAt` is null
   * (BLOCKED/DELETED users fail these checks). Membership itself must be
   * soft-deleted-free (`CompanyMember.deletedAt = null`).
   */
  async findActiveMemberIds(
    companyId: string,
    tx?: Prisma.TransactionClient,
    excludeUserId?: string | null,
  ): Promise<string[]> {
    const members = await this.getClient(tx).companyMember.findMany({
      where: {
        companyId,
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    return excludeUserId ? ids.filter((id) => id !== excludeUserId) : ids;
  }

  /**
   * Bulk fan-out create. `skipDuplicates` maps to ON CONFLICT DO NOTHING on
   * PostgreSQL — rows whose (companyId, dedupeKey) already exist are skipped,
   * so a repeated event can never create a duplicate notification.
   */
  async createMany(
    rows: NotificationCreateRow[],
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await this.getClient(tx).notification.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Single-row upsert primitive keyed by the company-scoped dedupe key.
   * The update branch only touches `updatedAt` — `readAt` is preserved so a
   * duplicate event never marks an unread notification as read.
   */
  async upsertByDedupeKey(
    data: NotificationCreateRow,
    tx?: Prisma.TransactionClient,
  ) {
    const { companyId, dedupeKey, ...rest } = data;
    return this.getClient(tx).notification.upsert({
      where: { companyId_dedupeKey: { companyId, dedupeKey } },
      create: { companyId, dedupeKey, ...rest },
      update: { updatedAt: new Date() },
    });
  }

  /**
   * Bump `updatedAt` for existing rows (LOW_STOCK re-alert freshness) without
   * resetting `readAt`.
   */
  async touchByDedupeKeys(
    companyId: string,
    dedupeKeys: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (dedupeKeys.length === 0) return;
    await this.getClient(tx).notification.updateMany({
      where: { companyId, dedupeKey: { in: dedupeKeys } },
      data: { updatedAt: new Date() },
    });
  }

  /** Paged list for one user (companyId + userId mandatory). */
  async findForUser(
    companyId: string,
    userId: string,
    query: NotificationQuery,
  ): Promise<{ items: unknown[]; total: number; page: number; limit: number }> {
    const where: Prisma.NotificationWhereInput = {
      companyId,
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [items, total] = await Promise.all([
      this.prismaService.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          titleKey: true,
          bodyKey: true,
          params: true,
          entityType: true,
          entityId: true,
          readAt: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prismaService.notification.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Unread counter for one user (companyId + userId mandatory). */
  async countUnreadForUser(companyId: string, userId: string): Promise<number> {
    return this.prismaService.notification.count({
      where: { companyId, userId, readAt: null },
    });
  }

  /**
   * Mark one notification as read for one user. Returns false when the row
   * does not exist for this (companyId, userId, id) — cross-tenant or
   * cross-user reads are impossible by construction.
   */
  async markReadForUser(
    companyId: string,
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    const result = await this.prismaService.notification.updateMany({
      where: { id: notificationId, companyId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count > 0;
  }
}
