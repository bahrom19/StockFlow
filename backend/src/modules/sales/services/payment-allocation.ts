import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Payment methods that have an explicit cash-shift sales bucket (v1.2).
 *
 * Every shift sales column maps 1:1 to a method here. Any method outside this
 * set (e.g. legacy GIFT_CARD / STORE_CREDIT, or an unknown value) is rejected
 * with a clear 400 so a sale can never silently land in the wrong bucket and
 * break the invariant:
 *
 *     cashSales + cardSales + qrSales + bankTransferSales + mobileWalletSales
 *         == totalSales
 */
export const SHIFT_SALES_METHODS = [
  'CASH',
  'CARD',
  'QR',
  'BANK_TRANSFER',
  'MOBILE_WALLET',
] as const;

export type ShiftSalesMethod = (typeof SHIFT_SALES_METHODS)[number];

export interface ShiftSalesAllocation {
  cash: Decimal;
  card: Decimal;
  qr: Decimal;
  bankTransfer: Decimal;
  mobileWallet: Decimal;
}

type PaymentLike = { method: string; amount: Decimal | string | number };

function toDecimal(v: Decimal | string | number): Decimal {
  if (v instanceof Decimal) return v;
  return new Decimal(v);
}

/**
 * Allocate a sale's payments into explicit cash-shift buckets.
 *
 * @throws BadRequestException for any method not in {@link SHIFT_SALES_METHODS}
 */
export function allocateShiftSales(
  payments: PaymentLike[],
): ShiftSalesAllocation {
  const alloc: ShiftSalesAllocation = {
    cash: new Decimal(0),
    card: new Decimal(0),
    qr: new Decimal(0),
    bankTransfer: new Decimal(0),
    mobileWallet: new Decimal(0),
  };

  for (const p of payments) {
    const amount = toDecimal(p.amount);
    switch (p.method) {
      case 'CASH':
        alloc.cash = alloc.cash.add(amount);
        break;
      case 'CARD':
        alloc.card = alloc.card.add(amount);
        break;
      case 'QR':
        alloc.qr = alloc.qr.add(amount);
        break;
      case 'BANK_TRANSFER':
        alloc.bankTransfer = alloc.bankTransfer.add(amount);
        break;
      case 'MOBILE_WALLET':
        alloc.mobileWallet = alloc.mobileWallet.add(amount);
        break;
      default:
        throw new BadRequestException(
          `Unsupported payment method '${p.method}'. Allowed: ${SHIFT_SALES_METHODS.join(', ')}`,
        );
    }
  }
  return alloc;
}

/** cash + card + qr + bankTransfer + mobileWallet */
export function shiftSalesTotal(a: ShiftSalesAllocation): Decimal {
  return a.cash.add(a.card).add(a.qr).add(a.bankTransfer).add(a.mobileWallet);
}
