import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface PurchaseInvoicePostedPayload {
  purchaseInvoiceId: string;
  companyId: string;
  purchaseOrderId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: string;
    total: string;
  }>;
}

export class PurchaseInvoicePostedEvent implements DomainEvent<PurchaseInvoicePostedPayload> {
  readonly eventName = 'purchase.invoice.posted';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: PurchaseInvoicePostedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
