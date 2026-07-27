import { Decimal } from '@prisma/client/runtime/library';

export function toDecimal(value: unknown): Decimal | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Decimal) return value;
  if (typeof value === 'number') return new Decimal(value);
  if (typeof value === 'string') return new Decimal(value);
  return undefined;
}

export function toDecimalOrZero(value: unknown): Decimal {
  const d = toDecimal(value);
  return d ?? new Decimal(0);
}

export function decimalToString(value: Decimal | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return value.toString();
}
