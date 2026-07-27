export interface SubscriptionCreatedPayload {
  companyId: string;
  subscriptionId: string;
  planCode: string;
  status: string;
  trialEndsAt: string | null;
}

export interface SubscriptionChangedPayload {
  companyId: string;
  subscriptionId: string;
  oldPlan: string;
  newPlan: string;
  reason: string;
}

export interface SubscriptionCancelledPayload {
  companyId: string;
  subscriptionId: string;
  reason: string | null;
}

export interface SubscriptionExpiredPayload {
  companyId: string;
  subscriptionId: string;
}

export interface PaymentSucceededPayload {
  companyId: string;
  invoiceId: string;
  amount: string;
  currency: string;
  provider: string;
}

export interface PaymentFailedPayload {
  companyId: string;
  invoiceId: string;
  amount: string;
  currency: string;
  reason: string;
}

export interface InvoiceGeneratedPayload {
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
}
