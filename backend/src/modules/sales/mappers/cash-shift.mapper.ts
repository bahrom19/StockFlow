import { CashShift } from '@prisma/client';
import { CashShiftEntity } from '../entities/cash-shift.entity';

type DecimalValue = { toString(): string } | string | number | null | undefined;

function toMoney(value: DecimalValue): string {
  if (value == null) return '0.0000';
  return typeof value === 'string' ? value : value.toString();
}

export class CashShiftMapper {
  static toEntity(shift: CashShift): CashShiftEntity {
    return {
      id: shift.id,
      companyId: shift.companyId,
      warehouseId: shift.warehouseId,
      cashierId: shift.cashierId,
      status: shift.status,
      currency: shift.currency,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingBalance: toMoney(shift.openingBalance),
      closingBalance: toMoney(shift.closingBalance),
      cashSales: toMoney(shift.cashSales),
      cardSales: toMoney(shift.cardSales),
      qrSales: toMoney(shift.qrSales),
      bankTransferSales: toMoney(shift.bankTransferSales),
      mobileWalletSales: toMoney(shift.mobileWalletSales),
      totalSales: toMoney(shift.totalSales),
      cashIn: toMoney(shift.cashIn),
      cashOut: toMoney(shift.cashOut),
      expectedClosing: toMoney(shift.expectedClosing),
      difference: toMoney(shift.difference),
      notes: shift.notes,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
      rowVersion: shift.rowVersion ?? 0,
    };
  }

  static toEntityList(shifts: CashShift[]): CashShiftEntity[] {
    return shifts.map((s) => CashShiftMapper.toEntity(s));
  }
}
