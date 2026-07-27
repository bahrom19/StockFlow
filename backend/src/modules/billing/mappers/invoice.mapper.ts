import { Invoice, InvoiceLine } from '@prisma/client';
import { InvoiceEntity, InvoiceLineEntity } from '../entities/invoice.entity';

type DecimalValue = { toString(): string } | string | number | null | undefined;

function toMoney(value: DecimalValue): string {
  if (value == null) return '0.0000';
  return typeof value === 'string' ? value : value.toString();
}

export class InvoiceMapper {
  static toLineEntity(line: InvoiceLine): InvoiceLineEntity {
    return {
      id: line.id,
      invoiceId: line.invoiceId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: toMoney(line.unitPrice),
      discountAmount: toMoney(line.discountAmount),
      taxAmount: toMoney(line.taxAmount),
      total: toMoney(line.total),
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
    };
  }

  static toLineEntityList(lines: InvoiceLine[]): InvoiceLineEntity[] {
    return lines.map((l) => InvoiceMapper.toLineEntity(l));
  }

  static toEntity(
    invoice: Invoice & { lines?: InvoiceLine[] },
  ): InvoiceEntity {
    return {
      id: invoice.id,
      companyId: invoice.companyId,
      subscriptionId: invoice.subscriptionId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      subtotal: toMoney(invoice.subtotal),
      discountAmount: toMoney(invoice.discountAmount),
      taxAmount: toMoney(invoice.taxAmount),
      totalAmount: toMoney(invoice.totalAmount),
      paidAmount: toMoney(invoice.paidAmount),
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      providerInvoiceId: invoice.providerInvoiceId,
      notes: invoice.notes,
      rowVersion: invoice.rowVersion ?? 0,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      deletedAt: invoice.deletedAt,
      lines: invoice.lines ? InvoiceMapper.toLineEntityList(invoice.lines) : undefined,
    };
  }

  static toEntityList(
    invoices: (Invoice & { lines?: InvoiceLine[] })[],
  ): InvoiceEntity[] {
    return invoices.map((i) => InvoiceMapper.toEntity(i));
  }
}
