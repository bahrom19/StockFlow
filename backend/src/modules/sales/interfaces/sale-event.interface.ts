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
