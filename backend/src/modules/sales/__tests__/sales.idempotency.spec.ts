import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import {
  createMockPrisma,
  MockIdempotencyStore,
} from '../../../infrastructure/idempotency/__tests__/idempotency.test-store';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { PrismaService } from '../../../common/prisma';
import { SalesService } from '../services/sales.service';
import { SalesRepository } from '../repositories/sales.repository';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import { CompaniesService } from '../../companies/services/companies.service';
import { CustomerCreditLedgerService } from '../../crm/services/customer-credit-ledger.service';

/**
 * G16-C-01 — keyed idempotency for POST /sales and POST /sales/:id/complete
 * (and /cancel), running the REAL Phase F1 IdempotencyService against the
 * shared in-memory emulation of the IdempotencyRecord table (unique
 * (companyId, idempotencyKey) + PostgreSQL transaction semantics).
 *
 * Business delegates (warehouse/product/saleItem/receipt/cashShift/payment/
 * auditLog) are attached to the transaction client via `extraModels` so the
 * service's `tx.*` reads run against per-transaction fakes — the same pattern
 * the goods-receipt F2 tests use.
 */
describe('SalesService — G16-C-01 keyed idempotency', () => {
  const companyId = 'comp-1';
  const userId = 'user-1';
  const warehouseId = 'wh-1';
  const productId = 'prod-1';

  let store: MockIdempotencyStore;
  let prisma: Record<string, any>;
  let salesRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    getNextSaleNumber: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };
  let saleRows: Array<Record<string, any>>;
  let service: SalesService;

  const dto = (saleNumber?: string) =>
    ({
      warehouseId,
      ...(saleNumber ? { saleNumber } : {}),
      items: [{ productId, quantity: 2, unitPrice: 10 }],
      payments: [{ method: 'CASH', amount: 20 }],
    }) as any;

  const buildTx = () => {
    const tx: Record<string, any> = {
      warehouse: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: warehouseId, companyId, isActive: true }),
      },
      product: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: productId, companyId, costPrice: null }),
      },
      saleItem: { findMany: jest.fn().mockResolvedValue([]) },
      receipt: { create: jest.fn().mockResolvedValue({}) },
      cashShift: { findFirst: jest.fn().mockResolvedValue(null) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    return tx;
  };

  beforeEach(() => {
    store = new MockIdempotencyStore();
    saleRows = [];
    prisma = createMockPrisma(store, (tx) => Object.assign(tx, buildTx())).prisma;
    eventBus = { publish: jest.fn() };
    salesRepository = {
      getNextSaleNumber: jest.fn().mockResolvedValue('SALE-COMP-0001'),
      create: jest.fn().mockImplementation(async (data: any) => {
        const row = {
          id: `sale-${saleRows.length + 1}`,
          saleNumber: data.saleNumber,
          status: SaleStatus.DRAFT,
          rowVersion: 0,
        };
        saleRows.push(row);
        return row;
      }),
      findById: jest.fn(async () => saleRows[0] ?? null),
      update: jest.fn(async (_id: string, data: any) => {
        saleRows[0] = { ...saleRows[0], ...data, rowVersion: 1 };
        return saleRows[0];
      }),
    };
    service = new SalesService(
      salesRepository as unknown as SalesRepository,
      {} as unknown as CashShiftRepository,
      prisma as unknown as PrismaService,
      new IdempotencyService(prisma as unknown as PrismaService),
      eventBus as any,
      {
        getBaseCurrency: jest.fn().mockResolvedValue('KZT'),
      } as unknown as CompaniesService,
      { spend: jest.fn() } as unknown as CustomerCreditLedgerService,
    );
  });

  // ── SALE CREATE ───────────────────────────────────────────────

  it('S1: same key + same payload replays the original sale (no second sale)', async () => {
    const first = await service.create(dto('S-0001'), userId, companyId, 'key-s1');
    const second = await service.create(dto('S-0001'), userId, companyId, 'key-s1');

    expect(salesRepository.create).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(saleRows).toHaveLength(1);
    expect(store.get(companyId, 'key-s1')).not.toBeNull();
  });

  it('S2: same key + different payload → 422 payload mismatch', async () => {
    await service.create(dto('S-0001'), userId, companyId, 'key-s2');

    await expect(
      service.create(dto('S-0009'), userId, companyId, 'key-s2'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(saleRows).toHaveLength(1);
  });

  it('S3: different key + same client saleNumber → business uniqueness 409', async () => {
    const duplicate = new ConflictException(
      'Sale number already exists. Please refresh and retry.',
    );
    salesRepository.create
      .mockRejectedValueOnce(duplicate)
      .mockRejectedValueOnce(duplicate);

    await expect(
      service.create(dto('S-DUP'), userId, companyId, 'key-a'),
    ).rejects.toBeInstanceOf(ConflictException);
    // The failed first attempt rolled back its reservation: a retry with a
    // new key starts clean (no poisoned record).
    await expect(
      service.create(dto('S-DUP'), userId, companyId, 'key-b'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(store.size()).toBe(0);
  });

  it('S4: no key + server-generated number → legacy behaviour, no record written', async () => {
    await service.create(dto(), userId, companyId);

    expect(saleRows).toHaveLength(1);
    expect(store.size()).toBe(0);
  });

  it('S5: no key + duplicate client saleNumber → legacy 409', async () => {
    salesRepository.create
      .mockResolvedValueOnce({
        id: 'sale-1',
        saleNumber: 'S-0001',
        status: SaleStatus.DRAFT,
      })
      .mockRejectedValueOnce(
        new ConflictException('Sale number already exists. Please refresh and retry.'),
      );

    await service.create(dto('S-0001'), userId, companyId);
    await expect(service.create(dto('S-0001'), userId, companyId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(store.size()).toBe(0);
  });

  it('S6: concurrent same key → one business operation, loser replays', async () => {
    const [a, b] = await Promise.all([
      service.create(dto('S-0001'), userId, companyId, 'key-s6'),
      service.create(dto('S-0001'), userId, companyId, 'key-s6'),
    ]);

    expect(salesRepository.create).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
    expect(saleRows).toHaveLength(1);
  });

  it('S7: concurrent different keys → independent operations', async () => {
    await Promise.all([
      service.create(dto('S-0001'), userId, companyId, 'key-s7a'),
      service.create(dto('S-0001'), userId, companyId, 'key-s7b'),
    ]);

    expect(salesRepository.create).toHaveBeenCalledTimes(2);
    expect(saleRows).toHaveLength(2);
  });

  it('S8: response lost after commit → retry same key returns the original response', async () => {
    const original = await service.create(dto('S-0001'), userId, companyId, 'key-s8');

    // Client never saw the first response; it retries the identical request.
    const replay = await service.create(dto('S-0001'), userId, companyId, 'key-s8');

    expect(salesRepository.create).toHaveBeenCalledTimes(1);
    expect(replay).toEqual(original);
  });

  // ── SALE COMPLETE / CANCEL ────────────────────────────────────

  const completedSale = () => {
    saleRows = [
      {
        id: 'sale-1',
        saleNumber: 'S-0001',
        status: SaleStatus.DRAFT,
        rowVersion: 0,
        warehouseId,
        currency: 'KZT',
        customerId: null,
        subtotal: '20',
        discount: '0',
        total: '20',
        paidAmount: '20',
        changeAmount: '0',
      },
    ];
  };

  it('C1: complete same key → replay original completion, side effects once', async () => {
    completedSale();
    const first = await service.transitionStatus(
      'sale-1',
      SaleStatus.COMPLETED,
      userId,
      companyId,
      'key-c1',
    );
    const second = await service.transitionStatus(
      'sale-1',
      SaleStatus.COMPLETED,
      userId,
      companyId,
      'key-c1',
    );

    expect(second).toEqual(first);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(salesRepository.update).toHaveBeenCalledTimes(1);
  });

  it('C2: different key on already COMPLETED sale → existing transition error', async () => {
    completedSale();
    await service.transitionStatus(
      'sale-1',
      SaleStatus.COMPLETED,
      userId,
      companyId,
      'key-c2a',
    );

    await expect(
      service.transitionStatus('sale-1', SaleStatus.COMPLETED, userId, companyId, 'key-c2b'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('C3: concurrent complete with different keys → CAS/state stays authoritative', async () => {
    completedSale();
    await service.transitionStatus(
      'sale-1',
      SaleStatus.COMPLETED,
      userId,
      companyId,
      'key-c3a',
    );
    // The second racing request observed COMPLETED (CAS won by the first).
    await expect(
      service.transitionStatus('sale-1', SaleStatus.COMPLETED, userId, companyId, 'key-c3b'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('C4: complete response lost → retry same key replays original', async () => {
    completedSale();
    const original = await service.transitionStatus(
      'sale-1',
      SaleStatus.COMPLETED,
      userId,
      companyId,
      'key-c4',
    );
    const replay = await service.transitionStatus(
      'sale-1',
      SaleStatus.COMPLETED,
      userId,
      companyId,
      'key-c4',
    );

    expect(replay).toEqual(original);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('X1: cancel same key → replay original cancellation', async () => {
    completedSale();
    const first = await service.transitionStatus(
      'sale-1',
      SaleStatus.CANCELLED,
      userId,
      companyId,
      'key-x1',
    );
    const second = await service.transitionStatus(
      'sale-1',
      SaleStatus.CANCELLED,
      userId,
      companyId,
      'key-x1',
    );

    expect(second).toEqual(first);
    expect(salesRepository.update).toHaveBeenCalledTimes(1);
  });

  it('X2: concurrent cancel with different keys → one wins, other rejects', async () => {
    completedSale();
    await service.transitionStatus(
      'sale-1',
      SaleStatus.CANCELLED,
      userId,
      companyId,
      'key-x2a',
    );

    await expect(
      service.transitionStatus('sale-1', SaleStatus.CANCELLED, userId, companyId, 'key-x2b'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('X3: invalid terminal transition is rejected deterministically', async () => {
    completedSale();
    await service.transitionStatus(
      'sale-1',
      SaleStatus.CANCELLED,
      userId,
      companyId,
      'key-x3a',
    );

    await expect(
      service.transitionStatus('sale-1', SaleStatus.COMPLETED, userId, companyId, 'key-x3b'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no key on complete/cancel keeps legacy behaviour (no record)', async () => {
    completedSale();
    await service.transitionStatus('sale-1', SaleStatus.COMPLETED, userId, companyId);

    expect(store.size()).toBe(0);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('missing sale with a key → NotFound rolls the reservation back', async () => {
    await expect(
      service.transitionStatus('ghost', SaleStatus.COMPLETED, userId, companyId, 'key-ghost'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(store.size()).toBe(0);
  });
});
