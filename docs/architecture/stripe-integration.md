# ⚡ StockFlow Enterprise — Stripe Integration v1.0

**Status:** Architecture Design — Ready for Implementation  
**Date:** July 26, 2026  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Payment Provider Abstraction](#2-payment-provider-abstraction)
3. [Stripe Provider Implementation](#3-stripe-provider-implementation)
4. [Webhook Architecture](#4-webhook-architecture)
5. [Webhook Event Catalog](#5-webhook-event-catalog)
6. [Idempotency Strategy](#6-idempotency-strategy)
7. [Outbox Pattern Integration](#7-outbox-pattern-integration)
8. [Retry & Reliability Strategy](#8-retry--reliability-strategy)
9. [Failure Scenarios & Recovery](#9-failure-scenarios--recovery)
10. [Checkout Flow](#10-checkout-flow)
11. [Subscription Lifecycle Integration](#11-subscription-lifecycle-integration)
12. [Stripe Tax Integration](#12-stripe-tax-integration)
13. [Security Considerations](#13-security-considerations)
14. [Testing Strategy](#14-testing-strategy)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              StockFlow Backend                               │
│                                                                               │
│  ┌─────────────────────────────┐         ┌────────────────────────────────┐  │
│  │   BillingService             │         │   BillingCronService           │  │
│  │   (orchestrates payments)   │         │   (scheduled jobs)             │  │
│  └───────────┬─────────────────┘         └────────────────────────────────┘  │
│              │                                                               │
│              │ calls                                                         │
│              ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     IPaymentProvider Interface                         │   │
│  │  createCustomer │ createSubscription │ charge │ refund │ ...          │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                        │
│              ┌──────────────────────┼──────────────────────┐                 │
│              ▼                      ▼                      ▼                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  StripeProvider   │  │  (PayPalProvider) │  │  (KaspiProvider) │          │
│  │  (v1)             │  │  (future)         │  │  (future)         │          │
│  └────────┬─────────┘  └──────────────────┘  └──────────────────┘          │
│           │                                                                 │
│           │ HTTPS                                                           │
│           ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                          Stripe API                                    │   │
│  │  • Customers         • Subscriptions      • Invoices                  │   │
│  │  • PaymentIntents    • PaymentMethods     • Checkout Sessions         │   │
│  │  • Webhook Events    • Tax               • Coupons/Discounts          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌─────────────────────────────┐         ┌────────────────────────────────┐  │
│  │   Stripe Webhook Controller │         │   Idempotency Store            │  │
│  │   (public, signature auth)  │◄────────│   (Redis, 24h TTL)             │  │
│  └───────────┬─────────────────┘         └────────────────────────────────┘  │
│              │                                                               │
│              ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Webhook Handler Pipeline                          │   │
│  │  1. Verify signature (Stripe-Signature header)                       │   │
│  │  2. Check idempotency (event ID → already processed?)                │   │
│  │  3. Dispatch to typed handler                                         │   │
│  │  4. Execute business logic in Prisma $transaction                    │   │
│  │  5. Store idempotency key                                             │   │
│  │  6. Return 200 OK                                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

                         │
                         ▼
              ┌─────────────────────┐
              │     Redis            │
              │  Idempotency Store   │
              │  (24h TTL)           │
              └─────────────────────┘
```

### Communication Flow

```
Client                      StockFlow                      Stripe
  │                            │                             │
  │  POST /api/billing/checkout │                             │
  │───────────────────────────►│                             │
  │                            │  Create Checkout Session    │
  │                            │────────────────────────────►│
  │                            │  { session_id, url }        │
  │                            │◄────────────────────────────│
  │  { url }                   │                             │
  │◄───────────────────────────│                             │
  │                            │                             │
  │  ── Redirect to Stripe ────│───────────────────────────►│
  │                            │                             │
  │  ── User enters payment ──│───────────────────────────►│
  │                            │                             │
  │  ── Redirect to success ──│◄────────────────────────────│
  │───────────────────────────►│                             │
  │                            │                             │
  │   ── WEBHOOK: checkout.session.completed ───────────────►│
  │                            │                             │
  │                            │  1. Verify signature        │
  │                            │  2. Check idempotency       │
  │                            │  3. $transaction:          │
  │                            │     - Update subscription  │
  │                            │     - Create invoice       │
  │                            │     - Audit log            │
  │                            │  4. 200 OK                 │
  │                            │◄────────────────────────────│
```

---

## 2. Payment Provider Abstraction

### 2.1 Interface Definition

```typescript
/**
 * Payment Provider Abstraction
 *
 * Every payment provider (Stripe, PayPal, Kaspi.kz) implements this interface.
 * The BillingService depends ONLY on this interface — never on concrete providers.
 *
 * Implementation decision: StripeProvider (v1)
 * → Swap to another provider by changing the DI binding.
 */
export interface IPaymentProvider {
  readonly name: string;

  // ── Customer Management ──────────────────────────────────────────────────
  createCustomer(data: CreateCustomerParams): Promise<ProviderCustomer>;
  getCustomer(providerCustomerId: string): Promise<ProviderCustomer>;
  updateCustomer(providerCustomerId: string, data: UpdateCustomerParams): Promise<ProviderCustomer>;
  deleteCustomer(providerCustomerId: string): Promise<void>;

  // ── Payment Method Management ──────────────────────────────────────────
  attachPaymentMethod(providerCustomerId: string, paymentMethodId: string): Promise<void>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;
  listPaymentMethods(providerCustomerId: string): Promise<ProviderPaymentMethod[]>;

  // ── Subscription Management ────────────────────────────────────────────
  createSubscription(data: CreateSubscriptionParams): Promise<ProviderSubscription>;
  updateSubscription(providerSubscriptionId: string, data: UpdateSubscriptionParams): Promise<ProviderSubscription>;
  cancelSubscription(providerSubscriptionId: string, options?: CancelOptions): Promise<void>;
  getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;

  // ── Payment / Charge ────────────────────────────────────────────────────
  charge(data: ChargeParams): Promise<ProviderPaymentIntent>;
  createPaymentIntent(data: PaymentIntentParams): Promise<ProviderPaymentIntent>;
  confirmPaymentIntent(paymentIntentId: string): Promise<ProviderPaymentIntent>;
  retrievePaymentIntent(paymentIntentId: string): Promise<ProviderPaymentIntent>;
  cancelPaymentIntent(paymentIntentId: string): Promise<void>;

  // ── Refunds ──────────────────────────────────────────────────────────────
  refund(chargeId: string, options?: RefundParams): Promise<ProviderRefund>;

  // ── Checkout ─────────────────────────────────────────────────────────────
  createCheckoutSession(data: CheckoutSessionParams): Promise<ProviderCheckoutSession>;
  retrieveCheckoutSession(sessionId: string): Promise<ProviderCheckoutSession>;
  expireCheckoutSession(sessionId: string): Promise<void>;

  // ── Invoice ────────────────────────────────────────────────────────────
  createInvoice(providerCustomerId: string): Promise<ProviderInvoice>;
  finalizeInvoice(invoiceId: string): Promise<ProviderInvoice>;
  payInvoice(invoiceId: string): Promise<ProviderInvoice>;
  voidInvoice(invoiceId: string): Promise<void>;
  listInvoices(providerCustomerId: string): Promise<ProviderInvoice[]>;

  // ── Webhook ──────────────────────────────────────────────────────────
  constructWebhookEvent(payload: Buffer | string, signature: string): Promise<ProviderWebhookEvent>;

  // ── Tax ──────────────────────────────────────────────────────────────────
  registerTaxIds(providerCustomerId: string, taxIds: TaxIdParams[]): Promise<void>;

  // ── Products / Prices ──────────────────────────────────────────────────
  createProduct(data: ProductParams): Promise<ProviderProduct>;
  createPrice(data: PriceParams): Promise<ProviderPrice>;
  updatePrice(priceId: string, data: Partial<PriceParams>): Promise<ProviderPrice>;
}

// ── Type Definitions ──────────────────────────────────────────────────────

interface CreateCustomerParams {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

interface ProviderCustomer {
  id: string;
  email: string;
  name: string;
  metadata: Record<string, string>;
  created: Date;
}

interface CreateSubscriptionParams {
  providerCustomerId: string;
  items: SubscriptionItem[];
  trialDays?: number;
  metadata?: Record<string, string>;
  paymentBehavior?: 'default_incomplete' | 'pending_if_incomplete' | 'error_if_incomplete';
  prorationBehavior?: 'none' | 'create_prorations' | 'always_invoice';
}

interface SubscriptionItem {
  priceId: string;
  quantity?: number;
}

interface ProviderSubscription {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  metadata: Record<string, string>;
  items: SubscriptionItemResponse[];
  latestInvoice?: ProviderInvoice;
}

interface ChargeParams {
  providerCustomerId: string;
  amount: number;          // In cents (Stripe) / smallest currency unit
  currency: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
  confirm?: boolean;
}

interface ProviderPaymentIntent {
  id: string;
  status: 'succeeded' | 'processing' | 'requires_payment_method' | 'requires_confirmation' | 'canceled';
  amount: number;
  currency: string;
  chargeId?: string;
  metadata: Record<string, string>;
}

interface ProviderCheckoutSession {
  id: string;
  url: string;
  mode: 'payment' | 'setup' | 'subscription';
  status: 'open' | 'complete' | 'expired';
  customerId?: string;
  subscriptionId?: string;
  paymentIntentId?: string;
  metadata: Record<string, string>;
}

interface ProviderWebhookEvent {
  id: string;
  type: string;
  created: Date;
  data: Record<string, any>;
  livemode: boolean;
  pendingWebhooks: number;
}
```

### 2.2 Provider Binding

```typescript
@Module({
  providers: [
    // Default: Stripe
    {
      provide: 'IPaymentProvider',
      useClass: StripeProvider,
    },
    StripeProvider,
  ],
  exports: ['IPaymentProvider'],
})
export class PaymentModule {}
```

---

## 3. Stripe Provider Implementation

### 3.1 Provider Configuration

```typescript
@Injectable()
export class StripeProvider implements IPaymentProvider {
  readonly name = 'stripe';

  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',  // Latest stable API version
      maxNetworkRetries: 3,              // Automatic retry on network errors
      timeout: 30000,                    // 30 second timeout
      telemetry: false,                  // Disable telemetry in production
    });
  }

  // ── Customers ────────────────────────────────────────────────────────────

  async createCustomer(params: CreateCustomerParams): Promise<ProviderCustomer> {
    const customer = await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    }, {
      idempotencyKey: `create-customer-${params.metadata?.companyId}`,
    });

    return this.mapCustomer(customer);
  }

  // ── Subscriptions ────────────────────────────────────────────────────────

  async createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription> {
    const subscription = await this.stripe.subscriptions.create({
      customer: params.providerCustomerId,
      items: params.items.map(item => ({
        price: item.priceId,
        quantity: item.quantity,
      })),
      trial_period_days: params.trialDays,
      metadata: params.metadata,
      payment_behavior: params.paymentBehavior ?? 'default_incomplete',
      proration_behavior: params.prorationBehavior ?? 'create_prorations',
    });

    return this.mapSubscription(subscription);
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  async charge(params: ChargeParams): Promise<ProviderPaymentIntent> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amount,           // Already in cents
      currency: params.currency,
      customer: params.providerCustomerId,
      payment_method: params.paymentMethodId,
      description: params.description,
      metadata: params.metadata,
      confirm: params.confirm ?? true,
      off_session: true,               // Allow charging without user interaction
      capture_method: 'automatic',     // Capture immediately
    }, {
      idempotencyKey: params.idempotencyKey,
    });

    return this.mapPaymentIntent(paymentIntent);
  }

  // ── Checkout ─────────────────────────────────────────────────────────────

  async createCheckoutSession(params: CheckoutSessionParams): Promise<ProviderCheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      customer: params.providerCustomerId,
      mode: params.mode,
      line_items: params.lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      allow_promotion_codes: params.allowPromotionCodes ?? false,
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      billing_address_collection: 'required',
      payment_method_types: ['card'],
      locale: params.locale ?? 'auto',
    });

    return this.mapCheckoutSession(session);
  }

  // ── Webhook ──────────────────────────────────────────────────────────────

  async constructWebhookEvent(payload: Buffer | string, signature: string): Promise<ProviderWebhookEvent> {
    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    return this.mapWebhookEvent(event);
  }

  // ── Products/Prices (admin operations) ────────────────────────────────────

  async createPrice(params: PriceParams): Promise<ProviderPrice> {
    const price = await this.stripe.prices.create({
      product: params.productId,
      unit_amount: params.unitAmount,    // In cents
      currency: params.currency,
      recurring: params.recurring ? {
        interval: params.recurring.interval,
        interval_count: params.recurring.intervalCount ?? 1,
      } : undefined,
      metadata: params.metadata,
    });

    return this.mapPrice(price);
  }

  // ── Mapping (private) ───────────────────────────────────────────────────

  private mapSubscription(sub: Stripe.Subscription): ProviderSubscription {
    return {
      id: sub.id,
      status: sub.status as ProviderSubscription['status'],
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      metadata: sub.metadata as Record<string, string>,
      items: sub.items.data.map(item => ({
        priceId: item.price.id,
        quantity: item.quantity ?? 1,
      })),
      latestInvoice: sub.latest_invoice
        ? this.mapInvoice(sub.latest_invoice as Stripe.Invoice)
        : undefined,
    };
  }

  private mapPaymentIntent(pi: Stripe.PaymentIntent): ProviderPaymentIntent {
    return {
      id: pi.id,
      status: pi.status as ProviderPaymentIntent['status'],
      amount: pi.amount,
      currency: pi.currency,
      chargeId: typeof pi.latest_charge === 'string' ? pi.latest_charge : undefined,
      metadata: pi.metadata as Record<string, string>,
    };
  }

  private mapCheckoutSession(session: Stripe.Checkout.Session): ProviderCheckoutSession {
    return {
      id: session.id,
      url: session.url!,
      mode: session.mode as ProviderCheckoutSession['mode'],
      status: session.status as ProviderCheckoutSession['status'],
      customerId: typeof session.customer === 'string' ? session.customer : undefined,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
      metadata: session.metadata as Record<string, string>,
    };
  }
}
```

### 3.2 Error Mapping

```typescript
@Injectable()
export class StripeProvider {
  // ── Error Handler ──────────────────────────────────────────────────────

  private handleStripeError(error: unknown): never {
    if (error instanceof Stripe.errors.StripeError) {
      switch (error.type) {
        case 'StripeCardError':
          throw new PaymentDeclinedException(error.message, {
            declineCode: error.code,
            paymentMethodId: error.payment_method?.id,
          });
        case 'StripeInvalidRequestError':
          throw new BadRequestException(`Stripe request error: ${error.message}`);
        case 'StripeRateLimitError':
          throw new TooManyRequestsException('Stripe rate limit exceeded, please retry');
        case 'StripeAPIError':
          throw new ServiceUnavailableException('Stripe API error, please retry');
        case 'StripeConnectionError':
          throw new ServiceUnavailableException('Stripe connection error, please retry');
        case 'StripeAuthenticationError':
          throw new InternalServerErrorException('Stripe authentication failed');
        default:
          throw new InternalServerErrorException(`Stripe error: ${error.message}`);
      }
    }

    throw new InternalServerErrorException('Unknown payment error');
  }

  // Usage in charge():
  async charge(params: ChargeParams): Promise<ProviderPaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({...});
      return this.mapPaymentIntent(paymentIntent);
    } catch (error) {
      this.handleStripeError(error);
    }
  }
}
```

---

## 4. Webhook Architecture

### 4.1 Webhook Controller

```typescript
@Controller('api/webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly webhookHandler: StripeWebhookHandlerService,
    private readonly idempotencyService: IdempotencyService,
    private readonly logger: Logger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  // ⚠️ NO auth guards — Stripe webhooks use signature verification
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ): Promise<{ received: boolean }> {
    // 1. ⏱️ Timing-safe signature verification
    const event = await this.stripeProvider.constructWebhookEvent(
      req.body,
      signature,
    );

    // 2. 🔍 Idempotency check (24h dedup window)
    const idempotencyKey = `stripe-webhook:${event.id}`;
    const processed = await this.idempotencyService.get(idempotencyKey);
    if (processed) {
      this.logger.log(`Webhook ${event.id} already processed, skipping`);
      return { received: true };
    }

    // 3. 🎯 Dispatch to typed handler
    try {
      await this.webhookHandler.handle(event);
    } catch (err) {
      // Log but return 200 to prevent Stripe retry flood
      // Stripe will retry if we return non-2xx
      this.logger.error(`Webhook ${event.id} (${event.type}) failed: ${err.message}`, err.stack);

      // For transient errors, rethrow to get Stripe to retry
      if (this.isTransientError(err)) {
        throw err;  // Stripe will retry with exponential backoff
      }

      // For permanent errors, acknowledge receipt (Stripe stops retrying)
      this.logger.warn(`Permanent webhook failure for ${event.id}: ${err.message}`);
      // Store idempotency to prevent infinite retries
      await this.idempotencyService.set(idempotencyKey, { status: 'failed', error: err.message }, { ttl: 86400 });
    }

    // 4. ✅ Acknowledge receipt
    return { received: true };
  }

  private isTransientError(err: Error): boolean {
    return (
      err instanceof ServiceUnavailableException ||
      err instanceof TooManyRequestsException ||
      err instanceof ConflictException
    );
  }
}
```

### 4.2 Webhook Handler Pipeline

```typescript
@Injectable()
export class StripeWebhookHandlerService {
  private readonly handlers = new Map<string, WebhookEventHandler>();

  constructor(
    private readonly checkoutHandler: CheckoutSessionCompletedHandler,
    private readonly invoiceHandler: InvoiceEventHandler,
    private readonly subscriptionHandler: SubscriptionEventHandler,
    private readonly paymentHandler: PaymentIntentEventHandler,
  ) {
    this.registerAll();
  }

  async handle(event: ProviderWebhookEvent): Promise<void> {
    const handler = this.handlers.get(event.type);
    if (!handler) {
      // Unknown event type — log and acknowledge
      this.logger.warn(`No handler registered for webhook event type: ${event.type}`);
      return;
    }

    await handler.execute(event);
  }

  private registerAll(): void {
    this.register('checkout.session.completed', this.checkoutHandler);
    this.register('checkout.session.async_payment_succeeded', this.checkoutHandler);
    this.register('customer.subscription.created', this.subscriptionHandler);
    this.register('customer.subscription.updated', this.subscriptionHandler);
    this.register('customer.subscription.deleted', this.subscriptionHandler);
    this.register('invoice.paid', this.invoiceHandler);
    this.register('invoice.payment_failed', this.invoiceHandler);
    this.register('invoice.finalized', this.invoiceHandler);
    this.register('payment_intent.succeeded', this.paymentHandler);
    this.register('payment_intent.payment_failed', this.paymentHandler);
    this.register('charge.refunded', this.refundHandler);
  }

  private register(type: string, handler: WebhookEventHandler): void {
    this.handlers.set(type, handler);
  }
}

interface WebhookEventHandler {
  readonly eventType: string;
  execute(event: ProviderWebhookEvent): Promise<void>;
}
```

### 4.3 Handler Implementation

```typescript
@Injectable()
export class CheckoutSessionCompletedHandler implements WebhookEventHandler {
  readonly eventType = 'checkout.session.completed';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly subscriptionService: CompanySubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBus,
    private readonly idempotencyService: IdempotencyService,
    private readonly logger: Logger,
  ) {}

  async execute(event: ProviderWebhookEvent): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;

    const companyId = session.metadata?.companyId;
    const planCode = session.metadata?.planCode;

    if (!companyId || !planCode) {
      this.logger.warn(`Missing metadata in checkout session ${session.id}`);
      return;
    }

    const idempotencyKey = `stripe-checkout:${session.id}`;

    await this.prismaService.$transaction(async (tx) => {
      // 1. Check idempotency (in-transaction)
      const processed = await this.idempotencyService.get(idempotencyKey);
      if (processed) return;

      // 2. Find subscription
      const subscription = await this.subscriptionService.findByCompany(companyId, tx);
      if (!subscription) throw new NotFoundException('Subscription not found for company');

      // 3. Apply payment
      await this.subscriptionService.activateFromPayment(
        companyId,
        {
          providerCustomerId: session.customer as string,
          providerSubscriptionId: session.subscription as string,
          paymentIntentId: session.payment_intent as string,
          amount: session.amount_total!,
          currency: session.currency!,
        },
        subscription.rowVersion,
        tx,
      );

      // 4. Create invoice
      const invoice = await this.invoiceService.createFromCheckout(
        companyId,
        subscription.id,
        session,
        tx,
      );

      // 5. Audit log
      await this.auditLog.log({
        companyId,
        action: 'BILLING_CHECKOUT_COMPLETED',
        entityType: 'CompanySubscription',
        entityId: subscription.id,
        details: { sessionId: session.id, planCode, amount: session.amount_total },
        transactionClient: tx,
      });

      // 6. Publish event via outbox
      await this.eventBus.publish(new PaymentSucceededEvent({
        companyId,
        invoiceId: invoice.id,
        amount: String(session.amount_total! / 100),
        currency: session.currency!,
        provider: 'stripe',
      }), { context: { transactionClient: tx } });

      // 7. Store idempotency
      await this.idempotencyService.set(idempotencyKey, { processed: true }, { ttl: 86400 }, tx);
    });
  }
}

@Injectable()
export class InvoiceEventHandler implements WebhookEventHandler {
  readonly eventType = 'invoice.paid'; // Also handles invoice.payment_failed

  constructor(
    private readonly prismaService: PrismaService,
    private readonly subscriptionService: CompanySubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBus,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async execute(event: ProviderWebhookEvent): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const companyId = invoice.metadata?.companyId;
    if (!companyId) return;

    const idempotencyKey = `stripe-invoice:${invoice.id}`;

    await this.prismaService.$transaction(async (tx) => {
      const processed = await this.idempotencyService.get(idempotencyKey);
      if (processed) return;

      if (event.type === 'invoice.paid') {
        // Update subscription period
        await this.subscriptionService.extendPeriod(
          companyId,
          new Date(invoice.lines.data[0]?.period?.start ?? 0),
          new Date(invoice.lines.data[0]?.period?.end ?? 0),
          tx,
        );

        // Record payment
        await this.invoiceService.recordPayment(
          companyId,
          invoice.id,
          invoice.total,
          invoice.currency,
          tx,
        );
      } else if (event.type === 'invoice.payment_failed') {
        // Mark past due
        await this.subscriptionService.markPastDue(companyId, tx);
      }

      // Store idempotency
      await this.idempotencyService.set(idempotencyKey, { processed: true }, { ttl: 86400 }, tx);
    });
  }
}
```

---

## 5. Webhook Event Catalog

### 5.1 Event-to-Handler Mapping

| Stripe Event | Handler | Business Action |
|-------------|---------|-----------------|
| `checkout.session.completed` | `CheckoutSessionCompletedHandler` | Activate subscription, create invoice, audit log |
| `checkout.session.async_payment_succeeded` | `CheckoutSessionCompletedHandler` | Same as above (async payment methods like Giropay, Sofort) |
| `checkout.session.expired` | `CheckoutSessionExpiredHandler` | Log, no action (session TTL is 24h) |
| `customer.subscription.created` | `SubscriptionEventHandler` | Sync subscription state from Stripe → local |
| `customer.subscription.updated` | `SubscriptionEventHandler` | Sync: plan change, status change, trial end |
| `customer.subscription.deleted` | `SubscriptionEventHandler` | Mark local subscription as cancelled/expired |
| `customer.subscription.paused` | `SubscriptionEventHandler` | Mark as paused (future use) |
| `customer.subscription.resumed` | `SubscriptionEventHandler` | Mark as resumed |
| `invoice.paid` | `InvoiceEventHandler` | Extend subscription period, create local invoice record |
| `invoice.payment_failed` | `InvoiceEventHandler` | Mark subscription as past_due, schedule retry |
| `invoice.finalized` | `InvoiceEventHandler` | Log, update local invoice status |
| `invoice.voided` | `InvoiceEventHandler` | Log, update local invoice status |
| `payment_intent.succeeded` | `PaymentIntentEventHandler` | Log, verify payment matches expected |
| `payment_intent.payment_failed` | `PaymentIntentEventHandler` | Log, increment retry counter |
| `payment_intent.requires_action` | `PaymentIntentEventHandler` | Log, send notification for 3DS |
| `charge.refunded` | `RefundHandler` | Update invoice status to REFUNDED |
| `charge.dispute.created` | `DisputeHandler` | Notify admin, update invoice status |
| `charge.dispute.closed` | `DisputeHandler` | Update invoice status based on outcome |

### 5.2 Unhandled Events

Events that are acknowledged but have no business logic:

```typescript
const UNHANDLED_EVENTS = new Set([
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'product.created',
  'product.updated',
  'product.deleted',
  'price.created',
  'price.updated',
  'price.deleted',
  'payment_method.attached',
  'payment_method.detached',
  'setup_intent.created',
  'setup_intent.succeeded',
  'setup_intent.setup_failed',
  'tax_rate.created',
  'tax_rate.updated',
  'tax_rate.deleted',
]);
```

---

## 6. Idempotency Strategy

### 6.1 Architecture

```
┌──────────────────────┐
│  IdempotencyStore    │
│                      │
│  key: string         │
│  value: any          │
│  expiresAt: timestamp│
│                      │
│  Backed by Redis     │
│  Default TTL: 24h    │
│  Namespace:          │
│   idempotent:{key}   │
└──────────────────────┘
```

### 6.2 Implementation

```typescript
@Injectable()
export class IdempotencyService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly prismaService: PrismaService,
  ) {}

  // ── Get idempotency record ─────────────────────────────────────────────

  async get<T = unknown>(key: string): Promise<T | null> {
    // Primary: Redis
    const cached = await this.cacheService.get<T>(`idempotent:${key}`);
    if (cached !== null) return cached;

    // Fallback: Database (for transactional consistency)
    const dbRecord = await this.prismaService.idempotencyRecord.findUnique({
      where: { key },
    });
    if (dbRecord) {
      // Re-populate cache
      await this.cacheService.set(`idempotent:${key}`, dbRecord.value as T, { ttl: dbRecord.ttl });
      return dbRecord.value as T;
    }

    return null;
  }

  // ── Set idempotency record ─────────────────────────────────────────────

  async set<T = unknown>(
    key: string,
    value: T,
    options?: { ttl?: number },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const ttl = options?.ttl ?? 86400; // Default: 24 hours
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Primary: Redis
    await this.cacheService.set(`idempotent:${key}`, value, { ttl });

    // Fallback: Database (for transactional consistency)
    const prisma = tx ?? this.prismaService;
    await prisma.idempotencyRecord.upsert({
      where: { key },
      create: { key, value, ttl, expiresAt },
      update: { value, ttl, expiresAt },
    });
  }

  // ── Remove idempotency record (for testing/admin) ──────────────────────

  async delete(key: string): Promise<void> {
    await this.cacheService.del(`idempotent:${key}`);
    await this.prismaService.idempotencyRecord.deleteMany({ where: { key } });
  }

  // ── Cleanup expired records (cron job) ─────────────────────────────────

  @Cron('0 6 * * *')  // Daily at 06:00 UTC
  async cleanupExpired(): Promise<void> {
    const deleted = await this.prismaService.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    this.logger.log(`Cleaned up ${deleted.count} expired idempotency records`);
  }
}
```

### 6.3 Idempotency Key Strategy

| Scenario | Key Format | Example | TTL |
|----------|-----------|---------|-----|
| Stripe webhook | `stripe-webhook:{event.id}` | `stripe-webhook:evt_12345` | 24h |
| Checkout session | `stripe-checkout:{session.id}` | `stripe-checkout:cs_67890` | 24h |
| Stripe invoice | `stripe-invoice:{invoice.id}` | `stripe-invoice:in_abcde` | 24h |
| Payment intent | `stripe-payment:{pi.id}` | `stripe-payment:pi_78901` | 24h |
| Charge request | `charge:{companyId}:{uuid}` | `charge:cmp_01:550e8400` | 24h |
| Subscription change | `sub-change:{companyId}:{uuid}` | `sub-change:cmp_01:550e8401` | 24h |
| Admin override | `admin-override:{companyId}:{timestamp}` | `admin-override:cmp_01:20260801` | 1h |

---

## 7. Outbox Pattern Integration

### 7.1 Why Outbox

Without the outbox pattern, there is a risk that:
1. **Event published, transaction rolls back** → Inconsistent state (phantom event)
2. **Transaction commits, event publish fails** → Lost event (no downstream processing)

The outbox pattern solves both:
- Events are written to an `OutboxMessage` table **inside the same Prisma transaction**
- A separate process reads from the outbox table and publishes events reliably

### 7.2 Database Model

```typescript
model OutboxMessage {
  id          String   @id @default(uuid()) @db.Uuid
  topic       String   // Event type: 'billing.subscription.changed'
  payload     Json     // Complete event payload
  headers     Json?    // Metadata: companyId, userId, correlationId
  status      OutboxStatus @default(PENDING)
  retryCount  Int      @default(0)
  maxRetries  Int      @default(5)
  createdAt   DateTime @default(now())
  processedAt DateTime?

  @@index([status, createdAt])
  @@index([topic, status])
}

enum OutboxStatus {
  PENDING
  PROCESSED
  FAILED
}
```

### 7.3 EventBus with Outbox Support

```typescript
@Injectable()
export class OutboxEventBus implements EventBus {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventBus: InMemoryEventBus,  // Fallback for in-process delivery
  ) {}

  async publish(event: DomainEvent, options?: PublishOptions): Promise<void> {
    // 1. Write to outbox table (inside transaction if provided)
    const tx = options?.context?.transactionClient ?? this.prismaService;

    await tx.outboxMessage.create({
      data: {
        topic: event.eventType,
        payload: event as any,
        headers: options?.context?.metadata ?? {},
        status: 'PENDING',
      },
    });

    // 2. Also deliver in-process for immediate side effects (optional)
    // Handlers that need immediate consistency can subscribe to the in-memory bus
    if (options?.immediateDelivery !== false) {
      await this.eventBus.publish(event, options);
    }
  }
}
```

### 7.4 Outbox Publisher (Background Job)

```typescript
@Injectable()
export class OutboxPublisher {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventBus: InMemoryEventBus,
    private readonly logger: Logger,
  ) {}

  // Runs every 5 seconds
  @Interval(5000)
  async processOutbox(): Promise<void> {
    const messages = await this.prismaService.outboxMessage.findMany({
      where: {
        status: 'PENDING',
        retryCount: { lt: 5 },  // Max 5 retries
        OR: [
          { processedAt: null },
          { processedAt: { lt: new Date(Date.now() - 60000) } }, // Min 1 minute between retries
        ],
      },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    for (const message of messages) {
      try {
        // Publish to in-memory event bus
        const event = message.payload as DomainEvent;
        await this.eventBus.publish(event, {
          context: { outboxMessageId: message.id },
        });

        // Mark as processed
        await this.prismaService.outboxMessage.update({
          where: { id: message.id },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (err) {
        this.logger.error(`Outbox message ${message.id} failed: ${err.message}`);

        // Increment retry count
        await this.prismaService.outboxMessage.update({
          where: { id: message.id },
          data: {
            retryCount: { increment: 1 },
            status: message.retryCount + 1 >= 5 ? 'FAILED' : 'PENDING',
          },
        });
      }
    }
  }
}
```

### 7.5 Outbox Integration in Webhook Handlers

```typescript
// Webhook handler uses outbox pattern automatically via EventBus
await this.prismaService.$transaction(async (tx) => {
  // 1. Business logic
  await this.subscriptionService.activateFromPayment(companyId, paymentData, tx);

  // 2. Audit log
  await this.auditLog.log({...}, tx);

  // 3. Publish via outbox (inside transaction!)
  await this.eventBus.publish(new PaymentSucceededEvent({
    companyId,
    invoiceId: invoice.id,
    amount: paymentData.amount.toString(),
    currency: paymentData.currency,
    provider: 'stripe',
  }), { context: { transactionClient: tx } });

  // 4. Store idempotency
  await this.idempotencyService.set(idempotencyKey, true, { ttl: 86400 }, tx);

  // ← If anything fails here, EVERYTHING rolls back
  // ← Event is NOT lost because it's in OutboxMessage table
  // ← Idempotency key is also rolled back → consistent retry
});
```

---

## 8. Retry & Reliability Strategy

### 8.1 Stripe API Retry Configuration

```typescript
// Stripe SDK automatically retries on network errors
private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  maxNetworkRetries: 3,      // Automatic retry on 5xx, timeout
  timeout: 30000,
});
```

### 8.2 Payment Retry Strategy

```typescript
@Injectable()
export class PaymentRetryService {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [24 * 60 * 60 * 1000, 48 * 60 * 60 * 1000, 72 * 60 * 60 * 1000]; // 24h, 48h, 72h

  // Called by cron job every hour
  async processRetries(): Promise<void> {
    const pendingRetries = await this.invoiceRepository.findPendingRetries({
      maxRetries: this.MAX_RETRIES,
    });

    for (const invoice of pendingRetries) {
      await this.retryPayment(invoice);
    }
  }

  private async retryPayment(invoice: InvoiceRecord): Promise<void> {
    // 1. Check retry interval
    const nextRetryAt = new Date(invoice.lastPaymentAttempt!.getTime() + this.getRetryDelay(invoice.retryCount));
    if (new Date() < nextRetryAt) return;

    await this.prismaService.$transaction(async (tx) => {
      // 2. Attempt payment (Stripe)
      const payment = await this.paymentProvider.charge({
        providerCustomerId: invoice.subscription.providerCustomerId,
        amount: invoice.amountInCents,
        currency: invoice.currency,
        description: `Retry ${invoice.retryCount + 1}: Invoice ${invoice.number}`,
        idempotencyKey: `charge-retry-${invoice.id}-${invoice.retryCount + 1}`,
        confirm: true,
      });

      if (payment.status === 'succeeded') {
        // Success: update invoice, reset retry count, extend subscription
        await this.invoiceRepository.update(invoice.id, {
          status: 'PAID',
          paidAt: new Date(),
          paymentIntentId: payment.id,
        }, tx);
        await this.subscriptionRepository.clearPastDue(invoice.companyId, tx);
      }
    }).catch(async (err) => {
      // 3. Increment retry count
      const newRetryCount = invoice.retryCount + 1;
      if (newRetryCount >= this.MAX_RETRIES) {
        // Max retries reached → mark as expired
        await this.prismaService.$transaction(async (tx) => {
          await this.subscriptionRepository.markExpired(invoice.companyId, tx);
          await this.invoiceRepository.update(invoice.id, { status: 'EXPIRED' }, tx);
        });
      } else {
        await this.invoiceRepository.update(invoice.id, {
          retryCount: newRetryCount,
          lastPaymentAttempt: new Date(),
          status: newRetryCount >= this.MAX_RETRIES ? 'EXPIRED' : 'FAILED',
        });
      }
    });
  }

  private getRetryDelay(retryCount: number): number {
    return this.RETRY_DELAYS[retryCount] ?? 72 * 60 * 60 * 1000;
  }
}
```

### 8.3 Webhook Retry Behavior

```
Stripe retry policy for webhooks:
  • 5 attempts total
  • Exponential backoff: ~5min, ~30min, ~2h, ~6h, ~12h
  • Total retry window: ~24 hours
  • Stops retrying after 5 failures
  • Manual retry available in Stripe Dashboard

Our strategy:
  • Return 200 OK for permanent failures (already processed, invalid event)
  • Return 500 for transient failures (database error, Stripe API error)
  • Use idempotency to handle duplicate webhooks safely
  • Reconciliation cron job catches missed webhooks
```

### 8.4 Reconciliation Job

```typescript
@Injectable()
export class BillingReconciliationService {
  // Runs daily at 05:00 UTC
  @Cron('0 5 * * *')
  async reconcileSubscriptions(): Promise<void> {
    this.logger.log('Starting Stripe subscription reconciliation');

    // 1. Get all active subscriptions
    const localSubscriptions = await this.subscriptionRepository.findByStatuses(['ACTIVE', 'PAST_DUE', 'TRIAL']);

    for (const localSub of localSubscriptions) {
      if (!localSub.providerSubscriptionId) continue;

      try {
        // 2. Fetch from Stripe
        const stripeSub = await this.paymentProvider.getSubscription(localSub.providerSubscriptionId);

        // 3. Compare states
        const localStatus = localSub.status;
        const stripeStatus = this.mapStripeStatus(stripeSub.status);

        if (localStatus !== stripeStatus) {
          this.logger.warn(`Subscription mismatch: ${localSub.id} (local=${localStatus}, stripe=${stripeSub.status})`);

          // 4. Auto-correct: stripe is source of truth for status
          await this.subscriptionRepository.updateStatus(localSub.companyId, stripeStatus, localSub.rowVersion);
        }
      } catch (err) {
        this.logger.error(`Failed to reconcile subscription ${localSub.id}: ${err.message}`);
      }
    }

    // 5. Report
    await this.reportService.sendReconciliationReport();
  }

  private mapStripeStatus(stripeStatus: string): string {
    const map: Record<string, string> = {
      'active': 'ACTIVE',
      'past_due': 'PAST_DUE',
      'canceled': 'CANCELLED',
      'incomplete': 'TRIAL',
      'incomplete_expired': 'EXPIRED',
      'trialing': 'TRIAL',
      'unpaid': 'PAST_DUE',
    };
    return map[stripeStatus] ?? 'UNKNOWN';
  }
}
```

---

## 9. Failure Scenarios & Recovery

### 9.1 Failure Matrix

| Scenario | Detection | Impact | Recovery |
|----------|-----------|--------|----------|
| **Stripe API timeout** | HttpClient timeout (30s) | Payment not processed | Retry with idempotency key — safe to retry |
| **Stripe 500 error** | HTTP 500 response | Payment may or may not have succeeded | Check Stripe Dashboard, idempotency prevents double charge |
| **Webhook delivery failure** | Stripe dashboard shows failed webhook | Event not processed | Stripe retries (5 attempts, 24h window), reconciliation job catches up |
| **Double webhook** | Same event received twice | Double processing | ❌ Prevented by idempotency key |
| **Bank decline** | `StripeCardError` with `decline_code` | Payment failed | Retry with 24h delay (3 max), notify customer |
| **3DS required** | `payment_intent.requires_action` | Payment pending | Send notification, customer completes 3DS in Stripe |
| **Expired card** | `StripeCardError: expired_card` | Auto-payment fails | Notify customer to update payment method |
| **Insufficient funds** | `StripeCardError: insufficient_funds` | Auto-payment fails | Retry after 24h, notify customer |
| **Database error during webhook** | Transaction rollback | Event not processed | Stripe retries webhook, idempotency not set since tx rolled back |
| **Race condition (admin + webhook)** | Optimistic lock conflict | One request fails | Webhook retries automatically |
| **Stripe webhook secret rotation** | Signature verification fails | All webhooks rejected | Update environment variable, reconcile |
| **Idempotency store unavailable** | Redis down | Double processing risk | Fallback to database idempotency table |
| **Concurrent subscription changes** | Optimistic lock | ConflictException | Webhook retries; admin sees error and retries |

### 9.2 Recovery Procedures

```typescript
// Manual recovery: process missed Stripe events
@Injectable()
export class BillingRecoveryService {
  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly subscriptionService: CompanySubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  // ── Admin: recover missed webhook events ──────────────────────────────
  @RequirePermission('admin:billing')
  async recoverEvent(eventId: string): Promise<void> {
    // Fetch event from Stripe API
    const event = await this.stripeProvider.retrieveEvent(eventId);

    // Check if already processed
    const idempotencyKey = `stripe-webhook:${event.id}`;
    const existing = await this.idempotencyService.get(idempotencyKey);
    if (existing) {
      throw new ConflictException('Event already processed');
    }

    // Process event
    await this.prismaService.$transaction(async (tx) => {
      // Execute handler logic based on event type
      await this.processEvent(event, tx);
      // Store idempotency
      await this.idempotencyService.set(idempotencyKey, true, { ttl: 86400 }, tx);
    });
  }

  // ── Admin: force reconcile a single subscription ──────────────────────
  @RequirePermission('admin:billing')
  async reconcileSubscription(subscriptionId: string): Promise<void> {
    const local = await this.subscriptionService.findById(subscriptionId);
    if (!local.providerSubscriptionId) throw new BadRequestException('No Stripe subscription');

    const stripeSub = await this.stripeProvider.getSubscription(local.providerSubscriptionId);

    // Update local to match Stripe
    await this.subscriptionService.updateFromProvider(local.companyId, {
      status: this.mapStripeStatus(stripeSub.status),
      providerSubscriptionId: local.providerSubscriptionId,
      currentPeriodStart: stripeSub.currentPeriodStart,
      currentPeriodEnd: stripeSub.currentPeriodEnd,
    });
  }

  // ── Emergency: full reconcile (all subscriptions) ──────────────────────
  @RequirePermission('admin:billing')
  @Cron('0 6 * * 0')  // Weekly on Sunday
  async fullReconcile(): Promise<void> {
    const subscriptions = await this.subscriptionService.findAllWithProvider();
    let mismatches = 0;

    for (const sub of subscriptions) {
      try {
        const stripeSub = await this.stripeProvider.getSubscription(sub.providerSubscriptionId!);
        const mappedStatus = this.mapStripeStatus(stripeSub.status);
        if (sub.status !== mappedStatus) {
          mismatches++;
          await this.subscriptionService.updateStatus(sub.companyId, mappedStatus, sub.rowVersion);
        }
      } catch (err) {
        this.logger.error(`Reconciliation failed for ${sub.id}: ${err.message}`);
      }
    }

    this.logger.log(`Full reconciliation complete. ${mismatches} mismatches fixed.`);
  }
}
```

---

## 10. Checkout Flow

### 10.1 Create Checkout Session

```typescript
@Injectable()
export class BillingService {
  async createCheckoutSession(
    companyId: string,
    planCode: string,
    billingInterval: 'MONTHLY' | 'ANNUAL',
  ): Promise<{ url: string; sessionId: string }> {
    // 1. Find subscription (create if not exists — transition from trial)
    const subscription = await this.subscriptionRepository.findByCompany(companyId);
    const plan = await this.planRepository.findByCode(planCode);

    if (!subscription || !plan) {
      throw new NotFoundException('Subscription or plan not found');
    }

    // 2. Get or create Stripe customer
    const providerCustomerId = subscription.providerCustomerId
      ?? await this.createStripeCustomer(companyId, subscription);

    // 3. Get Stripe price ID for the plan
    const priceId = billingInterval === 'MONTHLY' ? plan.stripeMonthlyPriceId : plan.stripeYearlyPriceId;

    // 4. Create Stripe Checkout Session
    const session = await this.paymentProvider.createCheckoutSession({
      providerCustomerId,
      mode: 'subscription',
      lineItems: [{
        price: priceId,
        quantity: 1,
      }],
      successUrl: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/billing/cancel`,
      metadata: {
        companyId,
        planCode,
        billingInterval,
      },
      allowPromotionCodes: true,
      locale: this.getLocale(subscription.companyLanguage),
    });

    // 5. Store session reference
    await this.subscriptionRepository.updateProviderSession(companyId, session.id);

    return { url: session.url, sessionId: session.id };
  }

  private async createStripeCustomer(companyId: string, subscription: CompanySubscription): Promise<string> {
    const company = await this.companyRepository.findById(companyId);
    const owner = await this.companyRepository.findOwner(companyId);

    const customer = await this.paymentProvider.createCustomer({
      email: owner.email,
      name: company.name,
      metadata: { companyId },
    });

    await this.subscriptionRepository.updateProviderCustomer(companyId, customer.id);
    return customer.id;
  }
}
```

### 10.2 Success Page Handler

```typescript
// GET /api/billing/checkout/success?session_id=cs_test_xxx
@Get('checkout/success')
@UseGuards(JwtAuthGuard)
async handleCheckoutSuccess(
  @Query('session_id') sessionId: string,
  @CurrentUser() user: JwtPayload,
): Promise<BillingStatusDto> {
  // Retrieve session from Stripe
  const session = await this.paymentProvider.retrieveCheckoutSession(sessionId);

  // Check if subscription is already active (webhook may have processed it)
  const subscription = await this.subscriptionRepository.findByCompany(user.companyId);

  return {
    status: subscription.status,
    plan: subscription.planCode,
    currentPeriodEnd: subscription.currentPeriodEnd,
    isActive: subscription.isActive,
    // If webhook hasn't processed yet, show "processing" state
    processing: session.status === 'open',
  };
}
```

---

## 11. Subscription Lifecycle Integration

### 11.1 Stripe ↔ Local Status Mapping

```
Stripe Status          Local Status          Company Access
──────────────────────────────────────────────────────────────────
trialing               TRIAL                 Full (trial period)
active                 ACTIVE                Full
past_due               PAST_DUE              Full (warning banner)
past_due (5+ days)     SUSPENDED             Blocked (402)
canceled (period end)  CANCELLED             Full until period end
canceled               EXPIRED               Blocked
incomplete             TRIAL                 Full (initial setup)
incomplete_expired     EXPIRED               Blocked
unpaid                 PAST_DUE              Full (warning banner)
```

### 11.2 Subscription Sync

```typescript
@Injectable()
export class SubscriptionEventHandler implements WebhookEventHandler {
  readonly eventType = 'customer.subscription.updated';

  async execute(event: ProviderWebhookEvent): Promise<void> {
    const stripeSub = event.data.object as Stripe.Subscription;
    const companyId = stripeSub.metadata?.companyId;
    if (!companyId) return;

    const localStatus = this.mapToLocalStatus(stripeSub.status);
    const subscription = await this.subscriptionRepository.findByCompany(companyId);
    if (!subscription) return;

    await this.prismaService.$transaction(async (tx) => {
      await this.subscriptionRepository.updateByProviderId(
        stripeSub.id,
        {
          status: localStatus,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          providerSubscriptionId: stripeSub.id,
          providerCustomerId: stripeSub.customer as string,
          isActive: localStatus === 'ACTIVE' || localStatus === 'TRIAL',
          rowVersion: { increment: 1 },
        },
        subscription.rowVersion,
        tx,
      );

      // Invalidate feature flag cache
      await this.featureFlagService.invalidateCache(companyId);
    });
  }
}
```

---

## 12. Stripe Tax Integration

### 12.1 Tax Configuration

```typescript
@Injectable()
export class StripeTaxService {
  async registerTaxIds(companyId: string): Promise<void> {
    const company = await this.companyRepository.findById(companyId);
    const subscription = await this.subscriptionRepository.findByCompany(companyId);

    if (company.taxId) {
      await this.paymentProvider.registerTaxIds(subscription.providerCustomerId!, [
        {
          type: this.mapTaxIdType(company.country, company.taxIdType),
          value: company.taxId,
        },
      ]);
    }
  }

  private mapTaxIdType(country: string, taxType?: string): string {
    const taxTypes: Record<string, string> = {
      'US': 'us_ein',
      'GB': 'gb_vat',
      'DE': 'de_vat',
      'FR': 'fr_vat',
      'KZ': 'kz_bin',       // Kazakhstan BIN
      'RU': 'ru_inn',        // Russia INN
      'AE': 'ae_trn',        // UAE TRN
    };
    return taxType ?? taxTypes[country] ?? 'unknown';
  }
}
```

### 12.2 Tax Calculation

```typescript
// Stripe automatically calculates tax when:
// 1. Tax IDs are registered on the customer
// 2. Prices have tax_behavior set
// 3. Checkout session has automatic_tax enabled

// Price creation:
const price = await stripe.prices.create({
  product: productId,
  unit_amount: 2990,  // $29.90
  currency: 'usd',
  tax_behavior: 'exclusive',  // or 'inclusive'
  recurring: { interval: 'month' },
});

// Checkout session:
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  automatic_tax: { enabled: true },
  tax_id_collection: { enabled: true },
  // ...
});
```

---

## 13. Security Considerations

### 13.1 Webhook Signature Verification

```typescript
// Stripe sends a signature in the Stripe-Signature header
// Format: t=timestamp,v1=signature,v0=signature
// Verified using the webhook secret configured in Stripe Dashboard

// Implementation (Stripe SDK handles this):
const event = Stripe.webhooks.constructEvent(
  payload,        // Raw request body (Buffer)
  signature,      // Stripe-Signature header value
  webhookSecret,  // env.STRIPE_WEBHOOK_SECRET
);
// Throws StripeSignatureVerificationError if invalid
```

### 13.2 Security Checklist

| Requirement | Implementation |
|-------------|---------------|
| Webhook signature verification | `stripe.webhooks.constructEvent()` — timestamp + signature |
| Webhook IP allowlisting | Stripe publishes IP ranges at `https://stripe.com/files/ips/stripe_dc_ips.txt` |
| No auth on webhook endpoint | Signature verification IS the auth |
| Request body raw access | Use `@Req() req: Request` with `bodyParser: false` in module |
| Rate limit on webhooks | 100 req/min per IP via `@nestjs/throttler` |
| Payload size limit | 10KB max (Stripe webhooks are small) |
| TLS enforcement | Enforce HTTPS in production |
| No secrets in logs | Strip `Authorization` and card details from log output |
| Stripe API key rotation | Support rotation without downtime (dual keys) |
| Webhook secret rotation | Support rotation without downtime (dual secrets, try both) |
| Idempotency to prevent replay | 24h TTL on idempotency keys |
| Audit trail for all Stripe events | Each webhook creates an audit log entry |
| Customer PII protection | Store only Stripe customer ID, never raw card data (PCI compliance) |

### 13.3 PCI Compliance

```
StockFlow never touches raw card data:
  • All payment details are collected by Stripe.js (Stripe Checkout)
  • Card data goes directly from browser → Stripe
  • StockFlow only receives a tokenized payment_method_id
  • No PCI SAQ D required — Stripe Checkout is SAQ A

  ✅ StockFlow is PCI-compliant out of the box when using Stripe Checkout
```

---

## 14. Testing Strategy

### 14.1 Unit Tests

| Test | Description |
|------|-------------|
| `StripeProvider.charge` | Verify correct API call with idempotency key |
| `StripeProvider.constructWebhookEvent` | Verify signature verification |
| `WebhookController.handleWebhook` | Verify signature extraction, idempotency check, dispatch |
| `CheckoutSessionCompletedHandler` | Verify transaction: subscription activation, invoice creation, audit log |
| `InvoiceEventHandler.handle` | Verify period extension, payment recording, past-due marking |
| `IdempotencyService.set/get` | Verify Redis + DB fallback |
| `PaymentRetryService.retryDelay` | Verify correct delay calculation |
| `PaymentProvider` | Verify error mapping for all Stripe error types |

### 14.2 Integration Tests

| Test | Description |
|------|-------------|
| `StripeProvider → Stripe test API` | Real API call with test keys |
| `Webhook end-to-end` | Simulate Stripe webhook POST with test signature |
| `Checkout session flow` | Create session → verify redirect URL → simulate webhook |
| `Payment retry flow` | Fail payment → verify retry scheduling → verify retry attempt |
| `Idempotency store` | Process same webhook twice → second call returns cached result |
| `Reconciliation` | Create mismatch → reconciliation fixes it |
| `Outbox integration` | Write message → outbox publisher delivers → handler executes |

### 14.3 Stripe Test Mode

```typescript
// Test card numbers (Stripe test mode):
const TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  insufficient_funds: '4000000000009995',
  expired: '4000000000000069',
  3ds_required: '4000002500003155',
  charge_disputed: '4000000000000259',
};

// Test webhook events can be triggered via:
// 1. Stripe CLI: `stripe trigger payment_intent.succeeded`
// 2. Stripe Dashboard: test webhooks tab
// 3. Unit test: construct event manually

// Integration test helper:
async function simulateWebhook(eventType: string, data: Record<string, any>): Promise<void> {
  const payload = {
    id: `evt_test_${Date.now()}`,
    type: eventType,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
  };

  // Generate test signature
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadStr = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadStr)
    .digest('hex');
  const signatureHeader = `t=${timestamp},v1=${signature}`;

  // Send to webhook controller
  await request(app.getHttpServer())
    .post('/api/webhooks/stripe')
    .set('stripe-signature', signatureHeader)
    .send(payload)
    .expect(200);
}
```

### 14.4 Test Scenarios

```typescript
describe('Stripe Integration (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [BillingModule],
    })
      .overrideProvider('IPaymentProvider')
      .useClass(TestStripeProvider)  // Mock Stripe responses
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should handle checkout.session.completed webhook', async () => {
    // Arrange: create a company with TRIAL subscription
    const company = await createTestCompany();
    const subscription = await createTestSubscription(company.id, 'TRIAL');

    // Act: simulate webhook
    await simulateWebhook('checkout.session.completed', {
      id: 'cs_test_123',
      customer: 'cus_test_123',
      subscription: 'sub_test_123',
      payment_intent: 'pi_test_123',
      amount_total: 2990,
      currency: 'usd',
      metadata: {
        companyId: company.id,
        planCode: 'starter',
      },
    });

    // Assert: subscription is now ACTIVE
    const updated = await getTestSubscription(company.id);
    expect(updated.status).toBe('ACTIVE');
    expect(updated.providerSubscriptionId).toBe('sub_test_123');
    expect(updated.isActive).toBe(true);
  });

  it('should handle invoice.payment_failed webhook', async () => {
    const company = await createTestCompany();
    const subscription = await createTestSubscription(company.id, 'ACTIVE');

    await simulateWebhook('invoice.payment_failed', {
      id: 'in_test_456',
      customer: 'cus_test_123',
      subscription: subscription.providerSubscriptionId,
      amount_due: 2990,
      currency: 'usd',
      metadata: { companyId: company.id },
      attempt_count: 1,
    });

    const updated = await getTestSubscription(company.id);
    expect(updated.status).toBe('PAST_DUE');
    expect(updated.paymentRetryCount).toBe(1);
  });

  it('should deduplicate identical webhook events', async () => {
    const company = await createTestCompany();
    await createTestSubscription(company.id, 'TRIAL');
    const eventId = `evt_test_dedup_${Date.now()}`;

    // First call
    await simulateEvent(eventId, 'checkout.session.completed', {...});

    // Second call (same event ID)
    await simulateEvent(eventId, 'checkout.session.completed', {...});

    // Assert: subscription activated only once (no duplicate invoice)
    const invoices = await getTestInvoices(company.id);
    expect(invoices.length).toBe(1);  // Only one invoice created
  });

  it('should handle concurrent webhook + admin action', async () => {
    const company = await createTestCompany();
    const subscription = await createTestSubscription(company.id, 'ACTIVE');

    // Webhook tries to mark past_due, admin tries to cancel at same time
    const [webhookResult, adminResult] = await Promise.allSettled([
      simulateWebhook('invoice.payment_failed', {...}),
      cancelSubscriptionAPI(company.id),
    ]);

    // One succeeds, the other gets ConflictException or idempotency block
    expect(webhookResult.status === 'fulfilled' || adminResult.status === 'fulfilled').toBe(true);
  });
});
```

### 14.5 Mock Stripe Provider for Tests

```typescript
@Injectable()
export class TestStripeProvider implements IPaymentProvider {
  readonly name = 'test-stripe';

  private customers = new Map<string, any>();
  private subscriptions = new Map<string, any>();
  private payments = new Map<string, any>();

  async createCustomer(params: CreateCustomerParams): Promise<ProviderCustomer> {
    const id = `cus_test_${this.customers.size + 1}`;
    const customer = { id, ...params, created: new Date() };
    this.customers.set(id, customer);
    return customer;
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription> {
    const id = `sub_test_${this.subscriptions.size + 1}`;
    const sub = {
      id,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      metadata: params.metadata ?? {},
      items: params.items,
    };
    this.subscriptions.set(id, sub);
    return sub;
  }

  async charge(params: ChargeParams): Promise<ProviderPaymentIntent> {
    // Simulate card decline for test cards
    if (params.description?.includes('4000000000000002')) {
      throw new PaymentDeclinedException('Card declined', { declineCode: 'generic_decline' });
    }

    return {
      id: `pi_test_${this.payments.size + 1}`,
      status: 'succeeded',
      amount: params.amount,
      currency: params.currency,
      chargeId: `ch_test_${this.payments.size + 1}`,
      metadata: params.metadata ?? {},
    };
  }

  async constructWebhookEvent(payload: Buffer | string, signature: string): Promise<ProviderWebhookEvent> {
    const parsed = JSON.parse(payload.toString());
    return {
      id: parsed.id,
      type: parsed.type,
      created: new Date(parsed.created * 1000),
      data: parsed.data,
      livemode: false,
      pendingWebhooks: 0,
    };
  }

  // ... other methods with test behavior
}
```
