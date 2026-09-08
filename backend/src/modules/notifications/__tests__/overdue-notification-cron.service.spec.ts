import { OverdueNotificationCronService } from '../scheduler/overdue-notification-cron.service';
import { NotificationsService } from '../notifications.service';
import { OverdueInvoiceRepository } from '../repositories/overdue-invoice.repository';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PrismaService } from '../../../common/prisma';

describe('OverdueNotificationCronService — daily scan, dedupe bucket, error isolation', () => {
  let cron: OverdueNotificationCronService;
  let redis: { acquireLock: jest.Mock; releaseLock: jest.Mock };
  let prisma: { company: { findMany: jest.Mock } };
  let overdueRepo: { findOverdueInvoices: jest.Mock };
  let service: { notifyOverdueInvoice: jest.Mock };

  const invoice = (id: string, companyId: string) => ({
    companyId,
    invoiceId: id,
    invoiceNumber: `PI-${id}`,
    supplierId: 'sup-1',
    supplierName: 'Acme',
    dueDate: new Date('2026-09-01'),
    currency: 'KZT',
    outstanding: '5000.0000',
    daysOverdue: 5,
  });

  beforeEach(() => {
    jest
      .spyOn(
        OverdueNotificationCronService.prototype as unknown as Record<
          string,
          () => Date
        >,
        'getScanStart',
      )
      .mockReturnValue(new Date(2026, 8, 6, 0, 0, 0)); // 2026-09-06 local
    redis = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      company: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'comp-1' }, { id: 'comp-2' }]),
      },
    };
    overdueRepo = { findOverdueInvoices: jest.fn().mockResolvedValue([]) };
    service = { notifyOverdueInvoice: jest.fn().mockResolvedValue(2) };
    cron = new OverdueNotificationCronService(
      redis as unknown as RedisService,
      prisma as unknown as PrismaService,
      overdueRepo as unknown as OverdueInvoiceRepository,
      service as unknown as NotificationsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('scans active companies and notifies overdue invoices with the day bucket', async () => {
    overdueRepo.findOverdueInvoices.mockResolvedValueOnce([invoice('inv-1', 'comp-1')]);

    await cron.scanOverdueInvoices();

    expect(overdueRepo.findOverdueInvoices).toHaveBeenCalledWith(
      'comp-1',
      new Date(2026, 8, 6, 0, 0, 0),
    );
    expect(service.notifyOverdueInvoice).toHaveBeenCalledWith(
      invoice('inv-1', 'comp-1'),
      '2026-09-06',
    );
  });

  it('same-day repeat → identical dedupe keys (DB constraint prevents duplicates)', async () => {
    prisma.company.findMany.mockResolvedValue([{ id: 'comp-1' }]);
    overdueRepo.findOverdueInvoices
      .mockResolvedValueOnce([invoice('inv-1', 'comp-1')])
      .mockResolvedValueOnce([invoice('inv-1', 'comp-1')]);

    await cron.scanOverdueInvoices();
    await cron.scanOverdueInvoices();

    const [first, second] = service.notifyOverdueInvoice.mock.calls;
    expect(first).toEqual(second); // same invoice + same bucket → same key
  });

  it('next day → new day bucket (legitimate re-alert)', async () => {
    prisma.company.findMany.mockResolvedValue([{ id: 'comp-1' }]);
    overdueRepo.findOverdueInvoices.mockResolvedValue([
      invoice('inv-1', 'comp-1'),
    ]);

    await cron.scanOverdueInvoices();
    jest
      .spyOn(
        OverdueNotificationCronService.prototype as unknown as Record<
          string,
          () => Date
        >,
        'getScanStart',
      )
      .mockReturnValue(new Date(2026, 8, 7, 0, 0, 0));
    await cron.scanOverdueInvoices();

    const buckets = service.notifyOverdueInvoice.mock.calls.map((c) => c[1]);
    expect(buckets).toEqual(['2026-09-06', '2026-09-07']);
  });

  it('one failing company does not stop the scan (per-company error isolation)', async () => {
    overdueRepo.findOverdueInvoices
      .mockRejectedValueOnce(new Error('comp-1 db timeout'))
      .mockResolvedValueOnce([invoice('inv-2', 'comp-2')]);

    await expect(cron.scanOverdueInvoices()).resolves.toBeUndefined();
    expect(service.notifyOverdueInvoice).toHaveBeenCalledTimes(1);
    expect(service.notifyOverdueInvoice).toHaveBeenCalledWith(
      invoice('inv-2', 'comp-2'),
      '2026-09-06',
    );
  });

  it('one failing invoice does not stop the remaining invoices', async () => {
    prisma.company.findMany.mockResolvedValue([{ id: 'comp-1' }]);
    overdueRepo.findOverdueInvoices.mockResolvedValue([
      invoice('inv-1', 'comp-1'),
      invoice('inv-3', 'comp-1'),
    ]);
    service.notifyOverdueInvoice
      .mockRejectedValueOnce(new Error('fan-out failed'))
      .mockResolvedValueOnce(2);

    await expect(cron.scanOverdueInvoices()).resolves.toBeUndefined();
    expect(service.notifyOverdueInvoice).toHaveBeenCalledTimes(2);
  });

  it('lock not acquired → scan skipped; lock released even on failure', async () => {
    redis.acquireLock.mockResolvedValue(false);
    await cron.scanOverdueInvoices();
    expect(prisma.company.findMany).not.toHaveBeenCalled();

    redis.acquireLock.mockResolvedValue(true);
    prisma.company.findMany.mockRejectedValue(new Error('boom'));
    await cron.scanOverdueInvoices();
    expect(redis.releaseLock).toHaveBeenCalled();
  });
});
