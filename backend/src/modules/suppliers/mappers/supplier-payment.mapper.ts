import { SupplierPayment } from '@prisma/client';
import { SupplierPaymentEntity } from '../entities/supplier-payment.entity';

function toMoney(value: unknown): string {
  return value == null ? '0.0000' : String(value);
}

export function toPaymentEntity(payment: SupplierPayment): SupplierPaymentEntity {
  return {
    id: payment.id,
    companyId: payment.companyId,
    supplierId: payment.supplierId,
    purchaseInvoiceId: payment.purchaseInvoiceId,
    paymentNumber: payment.paymentNumber,
    paymentDate: payment.paymentDate,
    amount: toMoney(payment.amount),
    method: payment.method,
    cashAccountId: payment.cashAccountId,
    bankAccountId: payment.bankAccountId,
    currency: payment.currency,
    reference: payment.reference,
    notes: payment.notes,
    createdBy: payment.createdBy,
    rowVersion: payment.rowVersion,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    deletedAt: payment.deletedAt,
  };
}
