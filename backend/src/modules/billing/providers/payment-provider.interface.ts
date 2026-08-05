/**
 * Payment provider abstraction for the billing module.
 *
 * Implementations (Stripe, manual, test) are swapped via dependency injection.
 * All money values are strings (Decimal serialization) — never numbers.
 */
export interface PaymentProvider {
  readonly name: string;

  /** Create a Checkout Session for subscription purchase */
  createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<CheckoutSessionResult>;

  /** Create a Billing Portal session for managing payment methods */
  createBillingPortalSession(
    params: PortalSessionParams,
  ): Promise<PortalSessionResult>;

  /** Retrieve a Checkout Session by id */
  retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult>;

  /** Create a refund for a payment */
  createRefund(params: RefundParams): Promise<RefundResult>;

  /** Retrieve customer by provider customer id */
  retrieveCustomer(
    providerCustomerId: string,
  ): Promise<ProviderCustomer | null>;

  /** Create or retrieve a customer in the payment provider */
  ensureCustomer(params: EnsureCustomerParams): Promise<ProviderCustomer>;

  /** Cancel a subscription at the provider level */
  cancelProviderSubscription(providerSubscriptionId: string): Promise<void>;

  /** Check if the provider is operational (for health checks) */
  ping(): Promise<boolean>;
}

export interface CheckoutSessionParams {
  companyId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  planCode: string;
  planName: string;
  priceAmount: string;
  currency: string;
  trialDays: number;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired';
  customerId: string | null;
  subscriptionId: string | null;
  paymentIntentId: string | null;
  amountTotal: string;
  currency: string;
  metadata: Record<string, string>;
}

export interface PortalSessionParams {
  customerId: string;
  returnUrl: string;
}

export interface PortalSessionResult {
  id: string;
  url: string;
}

export interface RefundParams {
  paymentIntentId: string;
  amount?: string;
  reason?: string;
  metadata?: Record<string, string>;
}

export interface RefundResult {
  id: string;
  status: 'succeeded' | 'pending' | 'failed';
  amount: string;
  reason?: string;
}

export interface ProviderCustomer {
  id: string;
  email: string;
  name: string;
}

export interface EnsureCustomerParams {
  email: string;
  name: string;
  companyId: string;
  metadata?: Record<string, string>;
}
