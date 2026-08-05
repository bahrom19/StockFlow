import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  allocateShiftSales,
  shiftSalesTotal,
  SHIFT_SALES_METHODS,
} from '../payment-allocation';

describe('allocateShiftSales (v1.2 explicit payment allocation)', () => {
  it('allocates each supported method into its own bucket', () => {
    const alloc = allocateShiftSales([
      { method: 'CASH', amount: 1000 },
      { method: 'CARD', amount: 500 },
      { method: 'QR', amount: 400 },
      { method: 'BANK_TRANSFER', amount: 200 },
      { method: 'MOBILE_WALLET', amount: 300 },
    ]);
    expect(alloc.cash.toString()).toBe('1000');
    expect(alloc.card.toString()).toBe('500');
    expect(alloc.qr.toString()).toBe('400');
    expect(alloc.bankTransfer.toString()).toBe('200');
    expect(alloc.mobileWallet.toString()).toBe('300');
  });

  it('sums to the total sales across all buckets', () => {
    const alloc = allocateShiftSales([
      { method: 'CASH', amount: 1000 },
      { method: 'CARD', amount: 500 },
      { method: 'QR', amount: 400 },
      { method: 'BANK_TRANSFER', amount: 200 },
      { method: 'MOBILE_WALLET', amount: 300 },
    ]);
    expect(shiftSalesTotal(alloc).toString()).toBe('2400');
  });

  it('handles Decimal amounts without mutation', () => {
    const amount = new Decimal('250.5000');
    const alloc = allocateShiftSales([{ method: 'QR', amount }]);
    expect(alloc.qr.toString()).toBe('250.5');
    // original Decimal untouched
    expect(amount.toString()).toBe('250.5');
  });

  it('throws BadRequestException for unknown methods (legacy GIFT_CARD)', () => {
    expect(() =>
      allocateShiftSales([{ method: 'GIFT_CARD', amount: 900 }]),
    ).toThrow(BadRequestException);
    expect(() =>
      allocateShiftSales([{ method: 'STORE_CREDIT', amount: 100 }]),
    ).toThrow(BadRequestException);
  });

  it('throws BadRequestException for a completely unknown method', () => {
    expect(() => allocateShiftSales([{ method: 'CRYPTO', amount: 1 }])).toThrow(
      BadRequestException,
    );
  });

  it('throws on the first offending method and lists allowed methods', () => {
    try {
      allocateShiftSales([
        { method: 'CASH', amount: 100 },
        { method: 'GIFT_CARD', amount: 50 },
      ]);
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const msg = (e as BadRequestException).message;
      expect(msg).toContain('GIFT_CARD');
      for (const m of SHIFT_SALES_METHODS) {
        expect(msg).toContain(m);
      }
    }
  });

  it('empty payments produce a zero allocation', () => {
    const alloc = allocateShiftSales([]);
    expect(shiftSalesTotal(alloc).isZero()).toBe(true);
  });
});
