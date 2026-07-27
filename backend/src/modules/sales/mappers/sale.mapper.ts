import { Payment, Receipt, Sale, SaleItem } from '@prisma/client';
import {
  PaymentEntity,
  ReceiptEntity,
  SaleEntity,
  SaleItemEntity,
} from '../entities/sale.entity';

type DecimalValue = { toString(): string } | string | number | null | undefined;

function toMoney(value: DecimalValue): string {
  if (value == null) return '0.0000';
  return typeof value === 'string' ? value : value.toString();
}

function toMoneyNullable(value: DecimalValue): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : value.toString();
}

export class SaleMapper {
  static toItemEntity(item: SaleItem): SaleItemEntity {
    return {
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: toMoney(item.unitPrice),
      costPrice: toMoney(item.costPrice),
      discount: toMoney(item.discount),
      subtotal: toMoney(item.subtotal),
      total: toMoney(item.total),
      margin: toMoney(item.margin),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  static toItemEntityList(items: SaleItem[]): SaleItemEntity[] {
    return items.map((i) => SaleMapper.toItemEntity(i));
  }

  static toPaymentEntity(payment: Payment): PaymentEntity {
    return {
      id: payment.id,
      saleId: payment.saleId,
      method: payment.method,
      amount: toMoney(payment.amount),
      reference: payment.reference,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  static toPaymentEntityList(payments: Payment[]): PaymentEntity[] {
    return payments.map((p) => SaleMapper.toPaymentEntity(p));
  }

  static toReceiptEntity(receipt: Receipt): ReceiptEntity {
    return {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      saleId: receipt.saleId,
      status: receipt.status,
      printed: receipt.printed,
      emailed: receipt.emailed,
      pdfUrl: receipt.pdfUrl,
      qrCode: receipt.qrCode,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
    };
  }

  static toReceiptEntityList(receipts: Receipt[]): ReceiptEntity[] {
    return receipts.map((r) => SaleMapper.toReceiptEntity(r));
  }

  static toEntity(
    sale: Sale & {
      items?: SaleItem[];
      payments?: Payment[];
      receipts?: Receipt[];
    },
  ): SaleEntity {
    return {
      id: sale.id,
      companyId: sale.companyId,
      warehouseId: sale.warehouseId,
      cashierId: sale.cashierId,
      customerId: sale.customerId,
      saleNumber: sale.saleNumber,
      status: sale.status,
      subtotal: toMoney(sale.subtotal),
      discount: toMoney(sale.discount),
      tax: toMoney(sale.tax),
      total: toMoney(sale.total),
      paidAmount: toMoney(sale.paidAmount),
      changeAmount: toMoney(sale.changeAmount),
      currency: sale.currency,
      notes: sale.notes,
      rowVersion: sale.rowVersion ?? 0,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      deletedAt: sale.deletedAt,
      items: sale.items ? SaleMapper.toItemEntityList(sale.items) : undefined,
      payments: sale.payments
        ? SaleMapper.toPaymentEntityList(sale.payments)
        : undefined,
      receipts: sale.receipts
        ? SaleMapper.toReceiptEntityList(sale.receipts)
        : undefined,
    };
  }

  static toEntityList(
    sales: (Sale & {
      items?: SaleItem[];
      payments?: Payment[];
      receipts?: Receipt[];
    })[],
  ): SaleEntity[] {
    return sales.map((s) => SaleMapper.toEntity(s));
  }
}
