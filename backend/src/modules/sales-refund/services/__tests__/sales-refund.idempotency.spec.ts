import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import {
  createMockPrisma,
  MockIdempotencyStore,
} from '../../../../infrastructure/idempotency/__tests__/idempotency.test-store';
import { IdempotencyService } from '../../../../infrastructure/idempotency/idempotency.service';
import { PrismaService } from '../../../../common/prisma';
import { SalesRefundService } from '../sales-refund.service';
import { SalesRefundRepository } from '../../repositories/sales-refund.repository';
import { SalesRepository } from '../../../sales/repositories/sales.repository';
import { CashShiftRepository } from '../../../sales/repositories/cash-shift.repository';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { DocumentSequenceService } from '../../../shared/services/document-sequence.service';
import { CustomerCreditLedgerService } from '../../../crm/services/customer-credit-ledger.service';
import { EventBus, EVENT_BUS } from '../../../../common/events';

/**
 * G16-C-02 — keyed idempotency for POST /sales/:id/refund (R1–R5).
 *
 * Runs the REAL Phase F1 IdempotencyService against the shared in-memory
 * IdempotencyRecord emulation. The refund aggregate itself is stubbed at the
 * `createRefundInTransaction` seam (prototype patch): its concurrency and
 * integrity semantics are covered by the G11-E/G16-B suites — this spec
 * proves the idempotency envelope around it.
 */
describe('SalesRefundService — G16-C-02 keyed idempotency (R1–R5)', () => {
  const COMPANY = 'comp-1';
  const USER = 'user-1';

  let store: MockIdempotencyStore;
  let prisma: Record<string, any>;
  let refundRows: Array<Record<string, any>>;
  let service: SalesRefundService;
  let aggregate: jest.Mock;

  const refundBody = (qty = 1) => ({ items: [{ saleItemId: 'item-1', quantity: qty }] });

  beforeEach(() => {
    store = new MockIdempotencyStore();
    refundRows = [];
    prisma = createMockPrisma(store).prisma;

    aggregate = jest.fn().mockImplementation(async (saleId: string, dto: any) => {
      const row = {
        id: `refund-${refundRows.length + 1}`,
        saleId,
        refundNumber: `REF-000${refundRows.length + 1}`,
        total: dto.items?.[0]?.quantity ?? 1,
      };
      refundRows.push(row);
      return row;
    });

    service = new SalesRefundService(
      prisma as unknown as PrismaService,
      new IdempotencyService(prisma as unknown as PrismaService),
      {} as unknown as SalesRepository,
      {} as unknown as CashShiftRepository,
      {
        create: aggregate,
      } as unknown as SalesRefundRepository,
      {
        nextNumber: jest.fn().mockResolvedValue(1),
      } as unknown as DocumentSequenceService,
      { log: jest.fn() } as unknown as AuditLogService,
      { publish: jest.fn() } as unknown as EventBus,
      {} as unknown as CustomerCreditLedgerService,
    );
    // Stub the aggregate seam (private createRefundInTransaction) — the
    // envelope under test is the idempotency layer, not the aggregate.
    (service as any).createRefundInTransaction = aggregate;
  });

  it('R1: same key + same payload → replay the original refund', async () => {
    const first = await service.createRefund('sale-1', refundBody(2), USER, COMPANY, 'key-r1');
    const second = await service.createRefund('sale-1', refundBody(2), USER, COMPANY, 'key-r1');

    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(refundRows).toHaveLength(1);
  });

  it('R2: same key + different payload → 422 payload mismatch', async () => {
    await service.createRefund('sale-1', refundBody(1), USER, COMPANY, 'key-r2');

    await expect(
      service.createRefund('sale-1', refundBody(2), USER, COMPANY, 'key-r2'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(refundRows).toHaveLength(1);
  });

  it('R3: concurrent different keys, same sale → CAS/aggregate stays authoritative', async () => {
    await Promise.all([
      service.createRefund('sale-1', refundBody(1), USER, COMPANY, 'key-r3a'),
      service.createRefund('sale-1', refundBody(2), USER, COMPANY, 'key-r3b'),
    ]);

    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(refundRows).toHaveLength(2);
  });

  it('R3-fail: aggregate ConflictException rolls the reservation back (clean retry)', async () => {
    aggregate
      .mockRejectedValueOnce(new ConflictException('modified by another user'))
      .mockResolvedValueOnce({ id: 'refund-1', refundNumber: 'REF-0001' });

    await expect(
      service.createRefund('sale-1', refundBody(1), USER, COMPANY, 'key-r3f'),
    ).rejects.toBeInstanceOf(ConflictException);
    // A retry with the SAME key starts clean after the rollback and commits.
    const retried = await service.createRefund(
      'sale-1',
      refundBody(1),
      USER,
      COMPANY,
      'key-r3f',
    );

    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(store.size()).toBe(1); // only the committed retry's reservation
    expect(retried).toMatchObject({ id: 'refund-1', refundNumber: 'REF-0001' });
  });

  it('R4: response lost after commit → retry same key returns the original refund', async () => {
    const original = await service.createRefund('sale-1', refundBody(3), USER, COMPANY, 'key-r4');
    const replay = await service.createRefund('sale-1', refundBody(3), USER, COMPANY, 'key-r4');

    expect(replay).toEqual(original);
    expect(refundRows).toHaveLength(1);
  });

  it('R5: same key in another tenant → independent reservation, no cross-tenant replay', async () => {
    const companyB = await service.createRefund(
      'sale-1',
      refundBody(1),
      USER,
      'comp-2',
      'key-r5',
    );
    const companyA = await service.createRefund('sale-1', refundBody(1), USER, COMPANY, 'key-r5');

    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(companyB).not.toBe(companyA);
    expect(store.get('comp-2', 'key-r5')).not.toBeNull();
    expect(store.get(COMPANY, 'key-r5')).not.toBeNull();
  });

  it('no key → legacy behaviour without any IdempotencyRecord', async () => {
    await service.createRefund('sale-1', refundBody(1), USER, COMPANY);

    expect(store.size()).toBe(0);
    expect(refundRows).toHaveLength(1);
  });

  it('aggregate BadRequest (remaining=0) rolls back and keeps retrying clean', async () => {
    aggregate
      .mockRejectedValueOnce(new BadRequestException('already fully refunded'))
      .mockRejectedValueOnce(new BadRequestException('already fully refunded'));

    await expect(
      service.createRefund('sale-1', refundBody(1), USER, COMPANY, 'key-rb'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createRefund('sale-1', refundBody(1), USER, COMPANY, 'key-rb'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.size()).toBe(0);
  });
});
