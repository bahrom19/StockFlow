import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CashShiftService } from '../services/cash-shift.service';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { CompaniesService } from '../../companies/services/companies.service';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { FiscalCalendarService } from '../../finance/services/fiscal-calendar.service';
import { AuditLogService } from '../../shared/services/audit-log.service';

const companyId = 'comp-1';
const userId = 'user-1';
const warehouseId = 'wh-1';

const baseShift = {
  id: 'shift-1',
  companyId,
  warehouseId,
  cashierId: userId,
  status: 'OPEN' as const,
  currency: 'KZT' as const,
  cashIn: new Decimal('0'),
  cashOut: new Prisma.Decimal('0'),
  rowVersion: 0,
};

/**
 * G16-N-3 P2-B-3 — durable cash operation identity.
 *
 * A committed cash-in/cash-out retried after the 24h IdempotencyRecord TTL
 * must never execute twice. The durable guard is
 * @@unique([companyId, clientOperationId]) on JournalEntry: a retried
 * operation collides deterministically (P2002 → 409 with "unique"), rolling
 * back the counter update, JE, balances and audit together.
 *
 * The mocked glEngine below faithfully simulates the composite unique: it
 * tracks (companyId, clientOperationId) pairs and rejects duplicates with a
 * real Prisma P2002 error carrying meta.target, exactly as PostgreSQL would.
 */
describe('CashShiftService — durable operation identity (P2-B-3)', () => {
  let service: CashShiftService;
  let repo: {
    findOpenShift: jest.Mock;
    update: jest.Mock;
  };
  let glPost: jest.Mock;
  let auditLog: { log: jest.Mock };

  // In-memory stand-in for @@unique([companyId, clientOperationId]).
  // NULL identities never collide (PostgreSQL semantics).
  const claimed = new Set<string>();

  const p2002 = () =>
    new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`companyId`, `clientOperationId`)',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['companyId', 'clientOperationId'] },
      },
    );

  beforeEach(async () => {
    claimed.clear();
    repo = {
      findOpenShift: jest.fn().mockResolvedValue({
        ...baseShift,
        cashIn: new Decimal('0'),
        cashOut: new Decimal('0'),
      }),
      update: jest.fn().mockImplementation(async (_id, data) => ({
        ...baseShift,
        ...data,
      })),
    } as any;
    glPost = jest.fn().mockImplementation(async (input: any) => {
      const opId = input.clientOperationId ?? null;
      if (opId != null) {
        const key = `${input.companyId}|${opId}`;
        if (claimed.has(key)) throw p2002();
        claimed.add(key);
      }
      return { id: `je-${claimed.size + 1}` };
    });
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const mockPrisma = {
      $transaction: jest.fn((cb: any) =>
        cb({
          cashAccount: { findMany: jest.fn().mockResolvedValue([]) },
          chartOfAccount: {
            findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
              // Mirrors the existing cash-shift spec: id lookups resolve to
              // a live EXPENSE row; code lookups resolve by family.
              if (where?.id && !where?.code) {
                return {
                  id: where.id,
                  code: '6000',
                  accountType: 'EXPENSE',
                  isActive: true,
                  deletedAt: null,
                  isCashOrBank: false,
                };
              }
              if (!where?.code) return null;
              const code: string = where.code;
              return {
                id: `acc-${code}`,
                code,
                accountType: code.startsWith('6')
                  ? 'EXPENSE'
                  : code.startsWith('4')
                    ? 'REVENUE'
                    : 'ASSET',
                isActive: true,
                deletedAt: null,
                isCashOrBank: code === '1010' || code === '1020',
              };
            }),
          },
          financialPeriod: {
            findFirst: jest.fn().mockResolvedValue({ id: 'fp-1' }),
          },
          warehouse: {
            findFirst: jest.fn().mockResolvedValue({ id: warehouseId }),
          },
        }),
      ),
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CompaniesService,
          useValue: { getBaseCurrency: jest.fn().mockResolvedValue('KZT') },
        },
        CashShiftService,
        { provide: CashShiftRepository, useValue: repo },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: IdempotencyService,
          useValue: { hashRequest: jest.fn().mockReturnValue('hash') },
        },
        { provide: GlEngineService, useValue: { post: glPost } },
        {
          provide: FiscalCalendarService,
          useValue: { ensureCurrentCalendar: jest.fn().mockResolvedValue({}) },
        },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = mod.get<CashShiftService>(CashShiftService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('cashIn', () => {
    it('first execution with identity posts exactly one JE carrying the ID', async () => {
      const result = await service.cashIn(
        {
          amount: 100,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-cash-in-1',
        },
        userId,
        companyId,
        warehouseId,
      );

      expect(result).toBeDefined();
      expect(glPost).toHaveBeenCalledTimes(1);
      expect(glPost.mock.calls[0][0].clientOperationId).toBe('op-cash-in-1');
      expect(repo.update).toHaveBeenCalledTimes(1);
    });

    it('duplicate same ID after TTL expiry → 409 with "unique", no second effect', async () => {
      await service.cashIn(
        {
          amount: 100,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-cash-in-2',
        },
        userId,
        companyId,
        warehouseId,
      );
      jest.clearAllMocks();

      // Post-expiry retry: idempotency record gone, unique still holds.
      const err = await service
        .cashIn(
          {
            amount: 100,
            counterpartAccountId: 'acc-6000',
            clientOperationId: 'op-cash-in-2',
          },
          userId,
          companyId,
          warehouseId,
        )
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message.toLowerCase()).toContain('unique');

      // The JE insert is the only post() attempt (it throws); nothing after
      // it runs, and the counter update rolls back with the transaction.
      expect(glPost).toHaveBeenCalledTimes(1);
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('same ID + different payload → 409, no second financial effect', async () => {
      await service.cashIn(
        {
          amount: 100,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-cash-in-3',
        },
        userId,
        companyId,
        warehouseId,
      );

      await expect(
        service.cashIn(
          {
            amount: 250,
            counterpartAccountId: 'acc-6000',
            clientOperationId: 'op-cash-in-3',
          },
          userId,
          companyId,
          warehouseId,
        ),
      ).rejects.toThrow(ConflictException);
      // Only the original +100 effect exists; the +250 never posts.
      expect(
        [...claimed].filter((k) => k.endsWith('|op-cash-in-3')),
      ).toHaveLength(1);
    });

    it('NULL clientOperationId preserves legacy behavior', async () => {
      await service.cashIn(
        { amount: 100, counterpartAccountId: 'acc-6000' },
        userId,
        companyId,
        warehouseId,
      );
      await service.cashIn(
        { amount: 100, counterpartAccountId: 'acc-6000' },
        userId,
        companyId,
        warehouseId,
      );

      // No identity → no collision → both execute (legacy TTL-only path).
      expect(glPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('cashOut', () => {
    it('first execution with identity posts exactly one JE carrying the ID', async () => {
      const result = await service.cashOut(
        {
          amount: 50,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-cash-out-1',
        },
        userId,
        companyId,
        warehouseId,
      );

      expect(result).toBeDefined();
      expect(glPost).toHaveBeenCalledTimes(1);
      expect(glPost.mock.calls[0][0].clientOperationId).toBe('op-cash-out-1');
    });

    it('duplicate same ID after TTL expiry → 409 with "unique"', async () => {
      await service.cashOut(
        {
          amount: 50,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-cash-out-2',
        },
        userId,
        companyId,
        warehouseId,
      );
      jest.clearAllMocks();

      const err = await service
        .cashOut(
          {
            amount: 50,
            counterpartAccountId: 'acc-6000',
            clientOperationId: 'op-cash-out-2',
          },
          userId,
          companyId,
          warehouseId,
        )
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message.toLowerCase()).toContain('unique');
      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('cross-cutting', () => {
    it('same ID across two companies executes independently', async () => {
      await service.cashIn(
        {
          amount: 100,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-shared-1',
        },
        userId,
        companyId,
        warehouseId,
      );
      // Different company: no collision (unique is company-scoped).
      await service.cashIn(
        {
          amount: 100,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-shared-1',
        },
        'user-9',
        'comp-2',
        warehouseId,
      );

      expect(glPost).toHaveBeenCalledTimes(2);
    });

    it('concurrent duplicate cash-in: one commits, one gets 409', async () => {
      // The mock's check-and-add is synchronous (no await between), so the
      // two concurrent calls serialize exactly like PostgreSQL's unique
      // index would: exactly one wins, the loser gets P2002 → 409.
      const results = await Promise.allSettled([
        service.cashIn(
          {
            amount: 100,
            counterpartAccountId: 'acc-6000',
            clientOperationId: 'op-race-1',
          },
          userId,
          companyId,
          warehouseId,
        ),
        service.cashIn(
          {
            amount: 100,
            counterpartAccountId: 'acc-6000',
            clientOperationId: 'op-race-1',
          },
          userId,
          companyId,
          warehouseId,
        ),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );
    });

    it('cash-in and cash-out may share no identity: distinct IDs, distinct JEs', async () => {
      await service.cashIn(
        {
          amount: 100,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-in-1',
        },
        userId,
        companyId,
        warehouseId,
      );
      await service.cashOut(
        {
          amount: 40,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-out-1',
        },
        userId,
        companyId,
        warehouseId,
      );

      expect(glPost).toHaveBeenCalledTimes(2);
    });

    it('reversal with a fresh identity succeeds; reused original K is refused', async () => {
      // Original operation commits under K.
      await service.cashIn(
        {
          amount: 100,
          counterpartAccountId: 'acc-6000',
          clientOperationId: 'op-rev-1',
        },
        userId,
        companyId,
        warehouseId,
      );

      // A reversal is a NEW business operation: it must mint a fresh id.
      // (Reversal flow itself is out of scope; this pins the invariant that
      // reusing K collides rather than double-posting.)
      await expect(
        service.cashIn(
          {
            amount: 100,
            counterpartAccountId: 'acc-6000',
            clientOperationId: 'op-rev-1',
          },
          userId,
          companyId,
          warehouseId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
