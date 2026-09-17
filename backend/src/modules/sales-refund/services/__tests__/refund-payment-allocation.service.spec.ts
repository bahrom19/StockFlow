import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, SaleStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { RefundPaymentAllocationService } from '../refund-payment-allocation.service';

/**
 * G11-E5 — RefundPaymentAllocationService.
 *
 * The service is exercised against an in-memory payment/allocation ledger that
 * faithfully models the transaction semantics: `payment.findMany` reflects the
 * Sale's immutable Payment rows, `salesRefund.findMany` the sale's refunds, and
 * `refundPaymentAllocation.findMany` the allocation rows written in prior
 * refund transactions (cumulative-cap verification) — while `createMany`
 * appends this refund's rows.
 */

const COMPANY = 'company-1';

interface LedgerRow {
  companyId: string;
  salesRefundId: string;
  method: PaymentMethod;
  amount: Decimal;
  currency?: string;
}

const payment = (method: PaymentMethod, amount: string) => ({
  method,
  amount: new Decimal(amount),
});

const sale = (overrides: Record<string, unknown> = {}) => ({
  id: 'sale-1',
  saleNumber: 'SALE-COMPANY1-0001',
  status: SaleStatus.PARTIALLY_REFUNDED as SaleStatus,
  companyId: COMPANY,
  warehouseId: 'wh-1',
  cashierId: 'user-1',
  total: new Decimal('10000.0000') as Decimal,
  changeAmount: new Decimal('0.0000') as Decimal,
  currency: 'KZT' as const,
  rowVersion: 0,
  // unused structural padding so the fixture also satisfies wider Sale types
  notes: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  ...overrides,
});

describe('RefundPaymentAllocationService — G11-E5', () => {
  let service: RefundPaymentAllocationService;
  let payments: Array<{ method: PaymentMethod; amount: Decimal }>;
  let refunds: Array<{ id: string }>;
  let allocationLedger: LedgerRow[];
  let mockTx: any;

  beforeEach(() => {
    service = new RefundPaymentAllocationService();
    payments = [];
    refunds = [];
    allocationLedger = [];

    mockTx = {
      payment: { findMany: jest.fn(async () => payments) },
      salesRefund: { findMany: jest.fn(async () => refunds) },
      refundPaymentAllocation: {
        findMany: jest.fn(
          async ({ where }: any) =>
            allocationLedger.filter(
              (row) =>
                row.companyId === where.companyId &&
                where.salesRefundId.in.includes(row.salesRefundId),
            ),
        ),
        createMany: jest.fn(async ({ data }: any) => {
          allocationLedger.push(...data);
          return { count: data.length };
        }),
      },
    };
  });

  const run = (
    refundTotal: string,
    saleOverrides: Record<string, unknown> = {},
    salesRefundId = 'refund-1',
  ) =>
    service.createForRefund(mockTx, {
      sale: sale(saleOverrides),
      salesRefundId,
      refundTotal: new Decimal(refundTotal),
      userId: 'user-1',
    });

  const persisted = () =>
    new Map<PaymentMethod, Decimal>(
      allocationLedger
        .filter((row) => row.salesRefundId === 'refund-1')
        .map((row) => [row.method, row.amount]),
    );

  // ── 1. cash-only proportional allocation ────────────────────
  it('allocates a cash-only sale entirely to CASH', async () => {
    payments = [payment(PaymentMethod.CASH, '10000')];
    const facts = await run('4000');
    expect(facts).toEqual([
      { method: PaymentMethod.CASH, amount: new Decimal('4000.0000') },
    ]);
    expect(persisted().get(PaymentMethod.CASH)!.toString()).toBe('4000');
  });

  // ── 2. cash + card proportional split ───────────────────────
  it('splits 4000 of a 6000 CASH / 4000 CARD sale proportionally (2400/1600)', async () => {
    payments = [
      payment(PaymentMethod.CASH, '6000'),
      payment(PaymentMethod.CARD, '4000'),
    ];
    const facts = await run('4000');
    const byMethod = new Map(facts.map((f) => [f.method, f.amount]));
    expect(byMethod.get(PaymentMethod.CASH)!.toString()).toBe('2400');
    expect(byMethod.get(PaymentMethod.CARD)!.toString()).toBe('1600');
  });

  // ── 3. cash + card, multiple partial refunds (cumulative cap) ──
  it('second partial refund allocates against the remaining bucket capacity', async () => {
    payments = [
      payment(PaymentMethod.CASH, '6000'),
      payment(PaymentMethod.CARD, '4000'),
    ];
    refunds = [{ id: 'refund-0' }];
    allocationLedger = [
      {
        companyId: COMPANY,
        salesRefundId: 'refund-0',
        method: PaymentMethod.CASH,
        amount: new Decimal('1800.0000'),
      },
      {
        companyId: COMPANY,
        salesRefundId: 'refund-0',
        method: PaymentMethod.CARD,
        amount: new Decimal('1200.0000'),
      },
    ];
    await run('2000', {}, 'refund-1');
    const byMethod = persisted();
    // proportional: 1200/800 — cumulative 3000 CASH / 2000 CARD within caps
    expect(byMethod.get(PaymentMethod.CASH)!.toString()).toBe('1200');
    expect(byMethod.get(PaymentMethod.CARD)!.toString()).toBe('800');
  });

  // ── 4. full refund path unaffected (integration in refund service spec) ──
  it('handles a final (full-remaining) partial refund across all buckets exactly', async () => {
    payments = [
      payment(PaymentMethod.CASH, '6000'),
      payment(PaymentMethod.CARD, '4000'),
    ];
    const facts = await run('10000');
    const total = facts.reduce((acc, f) => acc.add(f.amount), new Decimal(0));
    expect(total.toString()).toBe('10000');
  });

  // ── 5. multiple payments of the same method aggregate ───────
  it('aggregates several payments of one method into a single bucket', async () => {
    payments = [
      payment(PaymentMethod.CASH, '3000'),
      payment(PaymentMethod.CASH, '2000'),
      payment(PaymentMethod.CARD, '5000'),
    ];
    const facts = await run('5000');
    const byMethod = new Map(facts.map((f) => [f.method, f.amount]));
    // single allocation row per method, not per Payment row
    expect(facts).toHaveLength(2);
    expect(byMethod.get(PaymentMethod.CASH)!.toString()).toBe('2500');
    expect(byMethod.get(PaymentMethod.CARD)!.toString()).toBe('2500');
  });

  // ── 6. all seven PaymentMethod values ───────────────────────
  it('allocates across all seven PaymentMethod buckets by equal value', async () => {
    payments = [
      payment(PaymentMethod.CASH, '2000'),
      payment(PaymentMethod.CARD, '2000'),
      payment(PaymentMethod.QR, '2000'),
      payment(PaymentMethod.BANK_TRANSFER, '2000'),
      payment(PaymentMethod.MOBILE_WALLET, '2000'),
      payment(PaymentMethod.STORE_CREDIT, '2000'),
      payment(PaymentMethod.GIFT_CARD, '2000'),
    ];
    // buckets must reconcile with the sale total (G11-E5 §4 invariant)
    const sevenWaySale = { total: new Decimal('14000.0000') };
    // refund 7 of the 14000 sale → every bucket gets exactly 1.0000
    const facts = await run('7', sevenWaySale);
    expect(facts).toHaveLength(7);
    const total = facts.reduce((acc, f) => acc.add(f.amount), new Decimal(0));
    expect(total.toString()).toBe('7');
    for (const method of [
      PaymentMethod.CASH,
      PaymentMethod.CARD,
      PaymentMethod.QR,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.MOBILE_WALLET,
      PaymentMethod.STORE_CREDIT,
      PaymentMethod.GIFT_CARD,
    ]) {
      expect(facts.find((f) => f.method === method)!.amount.toString()).toBe('1');
    }
  });

  it('splits a non-terminating 1/7 proportion across seven buckets exactly', async () => {
    payments = [
      payment(PaymentMethod.CASH, '2000'),
      payment(PaymentMethod.CARD, '2000'),
      payment(PaymentMethod.QR, '2000'),
      payment(PaymentMethod.BANK_TRANSFER, '2000'),
      payment(PaymentMethod.MOBILE_WALLET, '2000'),
      payment(PaymentMethod.STORE_CREDIT, '2000'),
      payment(PaymentMethod.GIFT_CARD, '2000'),
    ];
    // refund 1 of 14000 → floor share 0.1428 per bucket (6×0.1428=0.9996),
    // remainder 0.0004 distributed in fixed order → first 4 buckets get +0.0001
    const facts = await run('1', { total: new Decimal('14000.0000') });
    expect(facts).toHaveLength(7);
    const total = facts.reduce((acc, f) => acc.add(f.amount), new Decimal(0));
    expect(total.toString()).toBe('1');
    expect(facts.find((f) => f.method === PaymentMethod.CASH)!.amount.toString()).toBe('0.1429');
    expect(facts.find((f) => f.method === PaymentMethod.CARD)!.amount.toString()).toBe('0.1429');
    expect(facts.find((f) => f.method === PaymentMethod.QR)!.amount.toString()).toBe('0.1429');
    expect(facts.find((f) => f.method === PaymentMethod.BANK_TRANSFER)!.amount.toString()).toBe('0.1429');
    expect(facts.find((f) => f.method === PaymentMethod.MOBILE_WALLET)!.amount.toString()).toBe('0.1428');
    expect(facts.find((f) => f.method === PaymentMethod.STORE_CREDIT)!.amount.toString()).toBe('0.1428');
    expect(facts.find((f) => f.method === PaymentMethod.GIFT_CARD)!.amount.toString()).toBe('0.1428');
  });

  // ── 7. changeAmount cash clamp ──────────────────────────────
  it('clamps the CASH bucket by the dispensed change (cashEffective = max(0, raw - change))', async () => {
    // 8000 cash + 3000 card tendered for a 10000 sale; 1000 change given back
    // in cash → the drawer effectively took 7000 cash + 3000 card = 10000.
    payments = [
      payment(PaymentMethod.CASH, '8000'),
      payment(PaymentMethod.CARD, '3000'),
    ];
    const facts = await run('3000', {
      changeAmount: new Decimal('1000.0000'),
    });
    const byMethod = new Map(facts.map((f) => [f.method, f.amount]));
    expect(byMethod.get(PaymentMethod.CASH)!.toString()).toBe('2100'); // 3000 × 7000/10000
    expect(byMethod.get(PaymentMethod.CARD)!.toString()).toBe('900');
  });

  it('fails fast when change exceeds the cash tendered (drawn from float)', async () => {
    payments = [
      payment(PaymentMethod.CASH, '500'),
      payment(PaymentMethod.CARD, '9500'),
    ];
    // effective buckets: cash 0 + card 9500 = 9500 != sale total 10000 → invariant fails
    await expect(
      run('100', { changeAmount: new Decimal('1500.0000') }),
    ).rejects.toThrow(BadRequestException);
    expect(allocationLedger).toHaveLength(0);
  });

  // ── 8. Decimal precision / proportional rounding ────────────
  it('keeps Decimal precision for non-terminating proportions (1/3 style)', async () => {
    payments = [
      payment(PaymentMethod.CASH, '10000'),
      payment(PaymentMethod.CARD, '20000'),
    ];
    // refund 10 of the 30000 sale → cash 3.3333 (floor), card 6.6666 (floor);
    // remainder 0.0001 goes to CASH first (fixed order)
    const facts = await run('10', { total: new Decimal('30000.0000') });
    const byMethod = new Map(facts.map((f) => [f.method, f.amount]));
    // floor shares: cash 3.3333, card 6.6666; remainder 0.0001 → CASH (fixed order) → 3.3334
    expect(byMethod.get(PaymentMethod.CASH)!.toString()).toBe('3.3334');
    expect(byMethod.get(PaymentMethod.CARD)!.toString()).toBe('6.6666');
  });

  // ── 9. fixed-order remainder ────────────────────────────────
  it('distributes the remainder in the fixed method order (CASH first)', async () => {
    payments = [
      payment(PaymentMethod.CASH, '5000'),
      payment(PaymentMethod.CARD, '5000'),
    ];
    // refund 0.0003 of 10000: floor shares are 0.0001/0.0001, remainder 0.0001 → CASH
    const facts = await run('0.0003');
    const byMethod = new Map(facts.map((f) => [f.method, f.amount]));
    expect(byMethod.get(PaymentMethod.CASH)!.toString()).toBe('0.0002');
    expect(byMethod.get(PaymentMethod.CARD)!.toString()).toBe('0.0001');
  });

  // ── 10. remainder cannot overflow a bucket ──────────────────
  it('skips an at-capacity bucket when distributing the remainder and never overflows it', async () => {
    payments = [
      payment(PaymentMethod.CASH, '1'),
      payment(PaymentMethod.CARD, '9999'),
    ];
    // refund the full 10000: cash floor share 0.0001; card floor 9998.9999;
    // remainder 0.0001 — cash is at capacity (1.0000), so it must go to CARD.
    const facts = await run('10000');
    const byMethod = new Map(facts.map((f) => [f.method, f.amount]));
    expect(byMethod.get(PaymentMethod.CASH)!.toString()).toBe('1');
    expect(byMethod.get(PaymentMethod.CARD)!.toString()).toBe('9999');
  });

  // ── 11/12. conservation and cumulative caps ─────────────────
  it('asserts Σ allocations == refund.total before persistence', async () => {
    payments = [payment(PaymentMethod.CASH, '10000')];
    const facts = await run('1234.5678');
    expect(
      facts.reduce((acc, f) => acc.add(f.amount), new Decimal(0)).toString(),
    ).toBe('1234.5678');
    expect(persisted().size).toBe(1);
  });

  it('fails fast when previous allocations already exceed the bucket capacity', async () => {
    payments = [payment(PaymentMethod.CASH, '5000')];
    refunds = [{ id: 'refund-0' }];
    allocationLedger = [
      {
        companyId: COMPANY,
        salesRefundId: 'refund-0',
        method: PaymentMethod.CASH,
        amount: new Decimal('6000.0000'), // > 5000 capacity
      },
    ];
    await expect(run('100')).rejects.toThrow(BadRequestException);
    expect(mockTx.refundPaymentAllocation.createMany).not.toHaveBeenCalled();
  });

  it('fails fast when the current refund would exceed the remaining bucket capacity', async () => {
    payments = [payment(PaymentMethod.CASH, '5000')];
    refunds = [{ id: 'refund-0' }];
    allocationLedger = [
      {
        companyId: COMPANY,
        salesRefundId: 'refund-0',
        method: PaymentMethod.CASH,
        amount: new Decimal('4500.0000'),
      },
    ];
    // remaining capacity 500; refund 600 cannot fit any bucket
    await expect(run('600')).rejects.toThrow(BadRequestException);
    expect(mockTx.refundPaymentAllocation.createMany).not.toHaveBeenCalled();
  });

  // ── 13. zero rows omitted ───────────────────────────────────
  it('omits zero-value allocations (tiny refund of one dominant bucket)', async () => {
    payments = [
      payment(PaymentMethod.CASH, '9999'),
      payment(PaymentMethod.CARD, '1'),
    ];
    // refund 0.0001: card floor share = 0.0000 (rounded down) and remainder step goes to CASH → CARD row omitted entirely
    const facts = await run('0.0001');
    expect(facts.map((f) => f.method)).toEqual([PaymentMethod.CASH]);
  });

  // ── 14. invalid inputs fail ─────────────────────────────────
  it('fails fast on a non-positive refund total', async () => {
    payments = [payment(PaymentMethod.CASH, '10000')];
    await expect(run('0')).rejects.toThrow(BadRequestException);
    await expect(run('-5')).rejects.toThrow(BadRequestException);
    expect(allocationLedger).toHaveLength(0);
  });

  it('fails fast when the sale has no payments', async () => {
    payments = [];
    await expect(run('100')).rejects.toThrow(BadRequestException);
    expect(allocationLedger).toHaveLength(0);
  });

  // ── 15. currency invariant ──────────────────────────────────
  it('persists the sale currency on every allocation row (no FX)', async () => {
    payments = [
      payment(PaymentMethod.CASH, '6000'),
      payment(PaymentMethod.CARD, '4000'),
    ];
    await run('4000');
    expect(mockTx.refundPaymentAllocation.createMany).toHaveBeenCalledTimes(1);
    const payload = mockTx.refundPaymentAllocation.createMany.mock.calls[0][0]
      .data as Array<{ currency: string; companyId: string }>;
    expect(payload.every((row) => row.currency === 'KZT')).toBe(true);
    expect(payload.every((row) => row.companyId === COMPANY)).toBe(true);
  });

  // ── 16. tenant isolation ────────────────────────────────────
  it('scopes previous-allocation reads to the sale company', async () => {
    payments = [payment(PaymentMethod.CASH, '10000')];
    refunds = [{ id: 'refund-0' }];
    allocationLedger = [
      {
        companyId: 'company-OTHER',
        salesRefundId: 'refund-0',
        method: PaymentMethod.CASH,
        amount: new Decimal('9000.0000'),
      },
    ];
    // another company's allocations must be invisible → no cap breach
    const facts = await run('4000');
    expect(facts[0]!.amount.toString()).toBe('4000');
  });

  // ── 17. rollback atomicity ──────────────────────────────────
  it('throws before any persistence when validation fails (atomicity guard)', async () => {
    payments = [payment(PaymentMethod.CASH, '10000')];
    // violation discovered during the cumulative cap check
    refunds = [{ id: 'refund-0' }];
    allocationLedger = [
      {
        companyId: COMPANY,
        salesRefundId: 'refund-0',
        method: PaymentMethod.CASH,
        amount: new Decimal('10000.0000'),
      },
    ];
    await expect(run('100')).rejects.toThrow(BadRequestException);
    expect(mockTx.refundPaymentAllocation.createMany).not.toHaveBeenCalled();
  });

  // ── persistence shape ───────────────────────────────────────
  it('persists insert-only rows keyed to the refund with the acting user', async () => {
    payments = [
      payment(PaymentMethod.CASH, '6000'),
      payment(PaymentMethod.STORE_CREDIT, '4000'),
    ];
    await run('2500', {}, 'refund-77');
    const payload = mockTx.refundPaymentAllocation.createMany.mock
      .calls[0][0].data as Array<{
      salesRefundId: string;
      createdBy: string;
      companyId: string;
      currency: string;
      method: PaymentMethod;
      amount: Decimal;
    }>;
    expect(payload).toHaveLength(2);
    for (const row of payload) {
      expect(row.salesRefundId).toBe('refund-77');
      expect(row.createdBy).toBe('user-1');
      expect(row.companyId).toBe(COMPANY);
      expect(row.currency).toBe('KZT');
    }
    expect(
      payload.find((r) => r.method === PaymentMethod.CASH)!.amount.toString(),
    ).toBe('1500');
    expect(
      payload.find((r) => r.method === PaymentMethod.STORE_CREDIT)!.amount.toString(),
    ).toBe('1000');
  });
});
