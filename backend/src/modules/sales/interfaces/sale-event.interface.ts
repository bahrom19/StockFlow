export interface SaleItemEvent {
  productId: string;
  quantity: number;
  unitPrice: string;
  costPrice: string;
  discount: string;
  subtotal: string;
  total: string;
  margin: string;
}

export interface PaymentEvent {
  method: string;
  amount: string;
}

export interface SaleCompletedEventPayload {
  saleId: string;
  companyId: string;
  warehouseId: string;
  cashierId: string;
  customerId: string | null;
  saleNumber: string;
  subtotal: string;
  discount: string;
  total: string;
  paidAmount: string;
  changeAmount: string;
  currency: string;
  items: SaleItemEvent[];
  payments: PaymentEvent[];
}

export interface SaleRefundedEventPayload {
  saleId: string;
  companyId: string;
  warehouseId: string;
  cashierId: string;
  saleNumber: string;
  total: string;
  currency: string;
  items: SaleItemEvent[];
  payments: PaymentEvent[];
}

/**
 * G11-E E3 — payload of `sale.partially_refunded`.
 *
 * `items` mirror the canonical `SalesRefundItem` facts (NOT the original
 * SaleItem quantities), so every consumer restores exactly what was refunded:
 * - `saleItemId` links the line back to the refunded SaleItem
 * - `quantity`  is the refunded quantity (never the sold quantity)
 * - `fifoCost`  is the canonical historical cost of the refunded quantity,
 *   already materialized per-line by E2 (final-line remainder conservation
 *   included). Monetary values cross the event boundary as strings.
 */
export interface SalePartiallyRefundedItemEvent {
  productId: string;
  saleItemId: string;
  quantity: number;
  unitPrice: string;
  total: string;
  fifoCost: string;
}

export interface SalePartiallyRefundedEventPayload {
  saleId: string;
  companyId: string;
  warehouseId: string;
  refundId: string;
  refundNumber: string;
  saleNumber: string;
  total: string;
  currency: string;
  createdBy: string;
  items: SalePartiallyRefundedItemEvent[];
}
