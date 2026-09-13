import { SupplierPaymentAllocation } from '@prisma/client';
import { SupplierPaymentAllocationEntity } from '../entities/supplier-payment-allocation.entity';

function toMoney(value: unknown): string {
  return value == null ? '0.0000' : String(value);
}

export function toAllocationEntity(allocation: SupplierPaymentAllocation): SupplierPaymentAllocationEntity {
  return {
    id: allocation.id,
    companyId: allocation.companyId,
    supplierId: allocation.supplierId,
    paymentId: allocation.paymentId,
    purchaseInvoiceId: allocation.purchaseInvoiceId,
    amount: toMoney(allocation.amount),
    rowVersion: allocation.rowVersion,
    createdAt: allocation.createdAt,
    updatedAt: allocation.updatedAt,
    deletedAt: allocation.deletedAt,
  };
}
