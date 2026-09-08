import { Prisma } from '@prisma/client';
import { NotificationRepository } from '../repositories/notification.repository';
import { PrismaService } from '../../../common/prisma';

describe('NotificationRepository — scoping, dedupe primitives, tx passthrough', () => {
  let repo: NotificationRepository;
  let prisma: {
    companyMember: { findMany: jest.Mock };
    notification: {
      createMany: jest.Mock;
      upsert: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  const notificationRow = {
    companyId: 'comp-1',
    userId: 'user-1',
    type: 'LOW_STOCK' as never,
    titleKey: 't',
    dedupeKey: 'low_stock:p1:w1:user-1',
  };

  beforeEach(() => {
    prisma = {
      companyMember: { findMany: jest.fn() },
      notification: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ id: 'n-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    repo = new NotificationRepository(prisma as unknown as PrismaService);
  });

  it('findActiveMemberIds: only active members, company-scoped, actor excluded', async () => {
    prisma.companyMember.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
    ]);

    const ids = await repo.findActiveMemberIds('comp-1', undefined, 'user-2');

    expect(prisma.companyMember.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'comp-1',
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      select: { userId: true },
    });
    // deleted/inactive/blocked users never reach this list (filtered by the
    // user relation criteria above); the actor is excluded in JS.
    expect(ids).toEqual(['user-1', 'user-3']);
  });

  it('createMany uses skipDuplicates (ON CONFLICT DO NOTHING) and honours tx', async () => {
    const tx = {
      notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as Prisma.TransactionClient;

    await repo.createMany([notificationRow], tx);

    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [notificationRow],
      skipDuplicates: true,
    });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('createMany with empty rows performs no query', async () => {
    await repo.createMany([]);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('upsertByDedupeKey: compound where + update branch touches only updatedAt', async () => {
    await repo.upsertByDedupeKey(notificationRow);

    expect(prisma.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_dedupeKey: {
            companyId: 'comp-1',
            dedupeKey: 'low_stock:p1:w1:user-1',
          },
        },
        update: { updatedAt: expect.any(Date) },
      }),
    );
    // create branch carries the full row; update branch never touches readAt
    const call = prisma.notification.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject(notificationRow);
    expect(call.update).not.toHaveProperty('readAt');
  });

  it('markReadForUser: scoped by id+companyId+userId, reports not-found as false', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repo.markReadForUser('comp-1', 'user-1', 'n-404'),
    ).resolves.toBe(false);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n-404', companyId: 'comp-1', userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });

    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    await expect(repo.markReadForUser('comp-1', 'user-1', 'n-1')).resolves.toBe(
      true,
    );
  });

  it('countUnreadForUser filters readAt null (tenant+user scoped)', async () => {
    await repo.countUnreadForUser('comp-1', 'user-1');
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { companyId: 'comp-1', userId: 'user-1', readAt: null },
    });
  });

  it('findForUser: pagination + unread/type filters, company+user scoped', async () => {
    prisma.notification.count.mockResolvedValue(3);
    await repo.findForUser('comp-1', 'user-1', {
      page: 2,
      limit: 25,
      unreadOnly: true,
      type: 'LOW_STOCK' as never,
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'comp-1',
          userId: 'user-1',
          readAt: null,
          type: 'LOW_STOCK',
        },
        skip: 25,
        take: 25,
      }),
    );
  });
});
