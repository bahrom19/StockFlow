# 💳 StockFlow Enterprise — Billing Architecture v1.0

**Status:** Architecture Design — Ready for Implementation  
**Date:** July 26, 2026  
**Supersedes:** `docs/roadmap/phase7-saas.md` §2 (SaaS Platform Architecture)  

---

## Table of Contents

1. [Business Model](#1-business-model)
2. [System Architecture](#2-system-architecture)
3. [Module Architecture](#3-module-architecture)
4. [Data Model](#4-data-model)
5. [Multi-tenant Billing](#5-multi-tenant-billing)
6. [Payment Lifecycle](#6-payment-lifecycle)
7. [Invoice Lifecycle](#7-invoice-lifecycle)
8. [Usage Tracking Architecture](#8-usage-tracking-architecture)
9. [Seat Management](#9-seat-management)
10. [Scheduled Jobs](#10-scheduled-jobs)
11. [Event Integration](#11-event-integration)
12. [API Design](#12-api-design)
13. [Security Model](#13-security-model)
14. [Operational Procedures](#14-operational-procedures)

---

## 1. Business Model

### 1.1 Plans

| Plan | Code | Price/Month | Price/Year | Trial Eligible |
|------|------|-------------|------------|----------------|
| Free | `free` | $0 | $0 | No (always free) |
| Starter | `starter` | $29 | $290 (2 months free) | ✅ 14 days |
| Business | `business` | $99 | $990 (2 months free) | ✅ 14 days |
| Enterprise | `enterprise` | Custom | Custom | ✅ By request |

### 1.2 Pricing Model

- **Per-company pricing** — one subscription per company
- **Seat-based addon** — additional users beyond plan limit at $10/user/month (Starter+)
- **Storage addon** — additional storage at $5/GB/month
- **Annual discount** — 2 months free when paying annually (16.7% discount)
- **Tax** — VAT/GST applied based on company country (Stripe Tax or manual)

### 1.3 Currencies Supported

| Currency | Code | Stripe Support |
|----------|------|----------------|
| USD | `USD` | ✅ Default |
| KZT | `KZT` | ✅ Stripe + Kaspi.kz |
| EUR | `EUR` | ✅ Stripe |
| RUB | `RUB` | ⚠️ Limited (sanctions) |
| GBP | `GBP` | ✅ Stripe |

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        StockFlow Billing System                        │
│                                                                        │
│  ┌──────────────────┐    ┌──────────────────┐   ┌──────────────────┐  │
│  │   API Layer       │    │   Worker Layer    │   │   Webhook Layer   │  │
│  │                   │    │                   │   │                   │  │
│  │ Subscription      │    │ Invoice Generator │   │ Stripe Webhook   │  │
│  │ Controller        │    │ (Cron: daily)     │   │ Controller        │  │
│  │                   │    │                   │   │                   │  │
│  │ Plan Controller   │    │ Trial Expiry      │   │ PayPal Webhook   │  │
│  │                   │    │ (Cron: hourly)    │   │ Controller        │  │
│  │ Invoice Controller│    │                   │   │                   │  │
│  │                   │    │ Usage Reset       │   │ Kaspi Webhook    │  │
│  │ Webhook Controller│    │ (Cron: monthly)   │   │ Controller        │  │
│  └────────┬─────────┘    └────────┬──────────┘   └────────┬─────────┘  │
│           │                       │                       │            │
│  ┌────────▼───────────────────────▼───────────────────────▼─────────┐  │
│  │                      BillingService                                │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │  │
│  │  │ Plan          │  │ Subscription │  │ Payment Provider       │  │  │
│  │  │ Management    │  │ Lifecycle    │  │ Abstraction            │  │  │
│  │  └──────────────┘  └──────────────┘  │                        │  │  │
│  │                                       │ ┌──────────────────┐  │  │  │
│  │  ┌──────────────┐  ┌──────────────┐  │ │ Stripe Provider  │  │  │  │
│  │  │ Invoice       │  │ Usage        │  │ ├──────────────────┤  │  │  │
│  │  │ Generation    │  │ Tracking     │  │ │ PayPal Provider  │  │  │  │
│  │  └──────────────┘  └──────────────┘  │ ├──────────────────┤  │  │  │
│  │                                       │ │ Kaspi Provider   │  │  │  │
│  │  ┌──────────────┐  ┌──────────────┐  │ └──────────────────┘  │  │  │
│  │  │ Audit        │  │ Notification  │  └────────────────────────┘  │  │
│  │  │ Logging      │  │ Service       │                             │  │
│  │  └──────────────┘  └──────────────┘                              │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                        Repositories                               │  │
│  │  SubscriptionPlanRepo │ CompanySubscriptionRepo │ InvoiceRepo    │  │
│  │  UsageRecordRepo      │ PaymentTransactionRepo  │ SeatRepo       │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                         PostgreSQL                                 │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Architecture

### 3.1 Module Structure

```
backend/src/modules/billing/
├── billing.module.ts
│
├── controllers/
│   ├── subscription-plan.controller.ts      # CRUD plans
│   ├── company-subscription.controller.ts    # Company subscription management
│   ├── invoice.controller.ts                # Invoice viewing/payment
│   ├── billing-webhook.controller.ts        # Stripe webhooks (public)
│   └── billing-admin.controller.ts          # Admin operations (suspend, override)
│
├── services/
│   ├── subscription-plan.service.ts         # Plan CRUD
│   ├── company-subscription.service.ts      # Subscription lifecycle
│   ├── billing.service.ts                   # Invoice generation, payment processing
│   ├── feature-flag.service.ts              # Feature flag evaluation
│   ├── usage-tracking.service.ts            # Usage metrics collection
│   ├── invoice.service.ts                   # Invoice lifecycle
│   ├── seat.service.ts                      # Seat management
│   ├── payment-provider.interface.ts        # Payment provider abstraction
│   ├── providers/
│   │   ├── stripe.provider.ts               # Stripe implementation
│   │   ├── paypal.provider.ts               # Future
│   │   └── kaspi.provider.ts                # Future
│   └── billing-cron.service.ts              # Scheduled jobs
│
├── repositories/
│   ├── subscription-plan.repository.ts
│   ├── company-subscription.repository.ts
│   ├── invoice.repository.ts
│   ├── invoice-line.repository.ts
│   ├── usage-record.repository.ts
│   └── payment-transaction.repository.ts
│
├── dto/
│   ├── create-subscription-plan.dto.ts
│   ├── update-subscription-plan.dto.ts
│   ├── subscription-plan-query.dto.ts
│   ├── create-subscription.dto.ts
│   ├── update-subscription.dto.ts
│   ├── subscription-query.dto.ts
│   └── invoice-query.dto.ts
│
├── entities/
│   ├── subscription-plan.entity.ts
│   ├── company-subscription.entity.ts
│   ├── invoice.entity.ts
│   └── usage-record.entity.ts
│
├── mappers/
│   ├── subscription-plan.mapper.ts
│   ├── company-subscription.mapper.ts
│   └── invoice.mapper.ts
│
├── events/
│   ├── subscription-created.event.ts
│   ├── subscription-changed.event.ts
│   ├── subscription-cancelled.event.ts
│   ├── subscription-expired.event.ts
│   ├── payment-succeeded.event.ts
│   ├── payment-failed.event.ts
│   └── invoice-generated.event.ts
│
├── interfaces/
│   ├── payment-provider.interface.ts
│   ├── plan-config.interface.ts
│   └── billing-event.interface.ts
│
└── __tests__/
    ├── subscription-plan.service.spec.ts
    ├── company-subscription.service.spec.ts
    ├── billing.service.spec.ts
    ├── feature-flag.service.spec.ts
    ├── usage-tracking.service.spec.ts
    ├── invoice.service.spec.ts
    ├── stripe.provider.spec.ts
    └── billing-cron.service.spec.ts
```

### 3.2 Payment Provider Abstraction

```typescript
interface IPaymentProvider {
  // Customer management
  createCustomer(companyId: string, email: string, name: string): Promise<string>;
  getCustomer(customerId: string): Promise<ProviderCustomer>;
  updateCustomer(customerId: string, data: Partial<ProviderCustomer>): Promise<void>;

  // Subscription management
  createSubscription(
    customerId: string,
    priceId: string,
    options?: SubscriptionOptions,
  ): Promise<ProviderSubscription>;
  updateSubscription(
    subscriptionId: string,
    options: SubscriptionOptions,
  ): Promise<ProviderSubscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;

  // Payment
  createPaymentIntent(amount: number, currency: string): Promise<PaymentIntent>;
  retrievePayment(paymentId: string): Promise<ProviderPayment>;

  // Invoice
  createInvoice(customerId: string, amount: number, currency: string): Promise<ProviderInvoice>;
  finalizeInvoice(invoiceId: string): Promise<ProviderInvoice>;
  voidInvoice(invoiceId: string): Promise<void>;

  // Webhook
  constructWebhookEvent(payload: unknown, signature: string): Promise<WebhookEvent>;
}
```

---

## 4. Data Model

### Entity Relationship Diagram

```
SubscriptionPlan (1) ───────────── (N) CompanySubscription
        │                                      │
        │                                      │ (1)
        │                                      ├── Invoice (N)
        │                                      │
        │                                      ├── UsageRecord (N)
        │                                      │
        │                                      ├── PaymentTransaction (N)
        │                                      │
        │                                      └── Seat (N)
        │
        ├── PlanFeatureOverride (N)
        │
        └── SubscriptionPlanAddon (N)          # Future: per-plan addon pricing
```

### Full Prisma Schema

Reference: `docs/roadmap/phase7-saas.md` §2.2 for the full schema definition.

Key design decisions:

| Decision | Rationale |
|----------|-----------|
| `companyId` as FK to `Company` | Multi-tenant isolation — one subscription per company |
| `unique` on `companyId` | Ensures exactly one subscription per company |
| Decimal(18,4) for all money | Consistency with existing StockFlow money handling |
| JSON for `featureFlags` | Flexible plan-level feature defaults without additional joins |
| `rowVersion` for all mutable models | Optimistic locking per ADR-007 |
| Provider IDs stored as nullable strings | Supports multiple payment providers without schema changes |
| `currentPeriodStart/End` | Enables period-based invoice generation and usage resets |

---

## 5. Multi-tenant Billing

### 5.1 One Subscription per Company

```
Company ──── 1:1 ──── CompanySubscription ──── N:1 ──── SubscriptionPlan
```

- Every company has exactly ONE active subscription record
- The `Company.status` field is updated by subscription lifecycle events:
  - `ACTIVE` → subscription is `ACTIVE` or `TRIAL`
  - `SUSPENDED` → subscription is `PAST_DUE`, `SUSPENDED`, or `EXPIRED`
- `Company.isActive` is set to `false` when subscription is `SUSPENDED` or `EXPIRED` (grace period exceeded)

### 5.2 Company Owner Permissions

```
Company ──── CompanyMember ──── User
                │
                └── role: "Admin" (auto-assigned to creator)
```

- The user who registers the company becomes the **Company Owner** with `Admin` role
- Company Owner has implicit `billing:*` permissions:
  - Can view invoices
  - Can update payment method
  - Can upgrade/downgrade plan
  - Can cancel subscription
  - Cannot delete company while subscription is active
- Additional users can be invited as **Billing Admins** via a future `billing:admin` permission

### 5.3 Invoice Ownership

```
Invoice ──── belongsTo ──── Company
         ──── belongsTo ──── CompanySubscription
```

- Invoices are owned by the company (tenant-scoped)
- Invoices reference the subscription that generated them
- Company sees only its own invoices
- Admin can see all invoices (cross-tenant, read-only)

### 5.4 Suspension Flow

```
Payment fails → Retry (3 days) → Past Due (5 days) → Suspended (0 days)
                                                          │
                                                    Send suspension email
                                                          │
                                                    isActive: false
                                                          │
                                                    API returns 402
                                                          │
                                            Auto-resume on successful payment
```

- During **PAST_DUE**: Company can still use the platform but gets a warning banner
- During **SUSPENDED**: API returns `402 Payment Required` for business endpoints
- Health check and basic auth endpoints remain accessible
- Data is NOT deleted — full recovery possible within 30 days
- After 30 days of suspension → **EXPIRED** → data retention purged after 90 days

---

## 6. Payment Lifecycle

### 6.1 Payment States

```
                        ┌──────────┐
                        │ Pending   │
                        └────┬─────┘
                             │
                  ┌──────────┼──────────┐
                  │          │          │
             ┌────▼───┐ ┌───▼────┐ ┌───▼──────┐
             │Success  │ │ Failed  │ │ Refunded  │
             │  ed     │ │        │ │           │
             └────┬────┘ └───┬────┘ └───┬───────┘
                  │          │          │
                  │     ┌────▼────┐     │
                  │     │ Retry   │     │
                  │     │(3 att.) │     │
                  │     └────┬────┘     │
                  │          │          │
                  │     ┌────▼────┐     │
                  │     │ Expired │     │
                  │     └─────────┘     │
                  │                     │
                  │              ┌──────▼───────┐
                  └──────────────│ Disputed      │
                                 └──────────────┘
```

### 6.2 State Transitions

| From | To | Trigger | Action |
|------|----|---------|--------|
| `PENDING` | `SUCCEEDED` | Payment confirmed | Update subscription, generate invoice, publish `payment.succeeded` |
| `PENDING` | `FAILED` | Payment declined | Increment retry count, publish `payment.failed` |
| `FAILED` | `RETRY` | Retry scheduled | Schedule retry in 24h (3 max) |
| `FAILED` | `EXPIRED` | Max retries exceeded | Mark as expired, suspend subscription |
| `SUCCEEDED` | `REFUNDED` | Refund initiated | Update invoice status, publish `payment.refunded` |
| `SUCCEEDED` | `DISPUTED` | Customer disputes | Notify admin, freeze related funds |
| `RETRY` | `SUCCEEDED` | Retry succeeds | Clear retry count, restore subscription |
| `RETRY` | `FAILED` | Retry fails | Increment retry count, check max |

### 6.3 Idempotency Strategy

```typescript
// Every payment operation uses an idempotency key
interface PaymentRequest {
  amount: Decimal;
  currency: string;
  idempotencyKey: string;  // UUID v4, unique per operation
  metadata: Record<string, string>;
}

// Stripe idempotency: passed as Idempotency-Key header
// Stripe guarantees: same key + same params → same result (idempotent for 24h)

// Local idempotency check:
async function processPayment(params: {
  invoiceId: string;
  amount: string;
  idempotencyKey: string;
}): Promise<PaymentResult> {
  // 1. Check local idempotency store
  const existing = await this.idempotencyStore.get(params.idempotencyKey);
  if (existing) return existing.result;

  // 2. Process payment via provider
  const result = await this.provider.charge(params);

  // 3. Store idempotency result
  await this.idempotencyStore.set(params.idempotencyKey, result, { ttl: 86400 });

  return result;
}
```

---

## 7. Invoice Lifecycle

### 7.1 Invoice States

```
DRAFT ──→ PENDING ──→ PAID
  │                    │
  │                    ├── REFUNDED
  │                    └── DISPUTED
  │
  └── CANCELLED
```

### 7.2 Invoice Generation

Invoices are generated by a scheduled cron job:

```typescript
// Runs daily at 00:00 UTC
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async generateDailyInvoices(): Promise<void> {
  // 1. Find all subscriptions where currentPeriodEnd is today
  // 2. For each, create Invoice in DRAFT status
  // 3. Create InvoiceLines from plan pricing
  // 4. Finalize invoice (DRAFT → PENDING)
  // 5. Send invoice to payment provider
  // 6. Email invoice to company owner
}
```

### 7.3 Invoice Numbering

```
INV-{YYYYMMDD}-{SEQ}

Example: INV-20260801-0001

Rules:
- Sequential per calendar day (resets daily)
- Format: INV-YYYYMMDD-NNNN
- Guaranteed unique via unique constraint
- Generated at DRAFT → PENDING transition
```

### 7.4 Invoice Payment

```typescript
async payInvoice(invoiceId: string, companyId: string): Promise<InvoiceEntity> {
  return this.prismaService.$transaction(async (tx) => {
    const invoice = await this.invoiceRepository.findById(invoiceId, companyId, tx);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'PENDING') throw new BadRequestException('Invoice not pending');

    // Process payment via provider
    const payment = await this.provider.charge({
      amount: invoice.totalAmount,
      currency: invoice.currency,
      customerId: invoice.subscription.providerCustomerId,
    });

    // Update invoice
    const updated = await this.invoiceRepository.update(invoiceId, {
      status: 'PAID',
      paidAt: new Date(),
      paidAmount: payment.amount,
      providerInvoiceId: payment.id,
    }, companyId, invoice.rowVersion, tx);

    // Publish event
    await this.eventBus.publish(new PaymentSucceededEvent({ ... }), { context: { transactionClient: tx } });

    return InvoiceMapper.toEntity(updated);
  });
}
```

---

## 8. Usage Tracking Architecture

### 8.1 Tracked Metrics

| Metric | Unit | Reset | Source Event |
|--------|------|-------|-------------|
| `sales_month` | Count of sales | Monthly (billing period) | `sale.completed` |
| `api_calls` | Count of API requests | Rolling 30-day | Request interceptor |
| `storage_mb` | MB of storage | Never (cumulative) | Product image upload |
| `active_users` | Count of active users | Never (point-in-time) | `user.created` |
| `active_warehouses` | Count of active warehouses | Never (point-in-time) | `warehouse.created` |
| `products_created` | Count of active products | Never (point-in-time) | `product.created` |

### 8.2 Quota Enforcement

```typescript
async checkQuota(companyId: string, metric: string, increment: number = 1): Promise<void> {
  const subscription = await this.subscriptionRepository.findByCompany(companyId);
  const plan = await this.planRepository.findById(subscription.planId);
  const limit = plan.limits[metric]; // e.g., plan.limits['sales_month'] = 5000

  if (limit === -1) return; // Unlimited (Enterprise)
  if (limit === 0) throw new ForbiddenException('Feature not available on your plan');

  const current = await this.usageRepository.getCurrentUsage(companyId, metric, subscription);
  if (current + increment > limit) {
    throw new ForbiddenException(
      `Monthly ${metric} limit (${limit}) exceeded. Upgrade your plan to increase limits.`,
    );
  }
}
```

### 8.3 Reset Strategy

| Strategy | Implementation |
|----------|----------------|
| **Billing period reset** | Usage counters reset to 0 at `currentPeriodEnd` |
| **Rolling window** | API calls use a rolling 30-day window (no reset needed — query by date range) |
| **Cumulative** | Storage is never reset — checked against plan limit on every upload |
| **Point-in-time** | Active users/warehouses are checked on creation — if at limit, block new creation |

### 8.4 Usage Tracking Decorator

```typescript
@Injectable()
export class UsageInterceptor implements NestInterceptor {
  constructor(private readonly usageService: UsageTrackingService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const metric = Reflect.getMetadata('usage:metric', context.getHandler());
    const increment = Reflect.getMetadata('usage:increment', context.getHandler()) ?? 1;

    if (metric) {
      await this.usageService.checkQuota(request.user.companyId, metric, increment);
      await this.usageService.increment(request.user.companyId, metric, increment);
    }

    return next.handle();
  }
}
```

---

## 9. Seat Management

### 9.1 How Seats Work

- Each plan has a `maxUsers` limit
- Active users = count of `CompanyMember` records where `deletedAt: null`
- When inviting a new user, the system checks: `activeUsers < plan.maxUsers`
- If at limit, owner must upgrade plan or remove inactive users

### 9.2 Seat Upgrades

```
Starter (3 seats)
  ├── Add seat: +$10/month
  └── Remove seat: -$10/month (at next billing period)

Business (10 seats)
  ├── Add seat: +$10/month
  └── Remove seat: -$10/month (at next billing period)
```

### 9.3 Seat Enforcement

```typescript
@OnEvent('company.member.invited')
async onMemberInvited(event: CompanyMemberInvitedEvent): Promise<void> {
  const subscription = await this.subscriptionRepository.findByCompany(event.companyId);
  const activeUsers = await this.seatService.countActiveUsers(event.companyId);

  if (activeUsers >= subscription.plan.maxUsers) {
    throw new ForbiddenException(
      `User limit (${subscription.plan.maxUsers}) reached. Upgrade plan or remove inactive users.`,
    );
  }
}
```

---

## 10. Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `generateInvoices` | Daily at 00:00 UTC | Generate invoices for subscriptions ending today |
| `processPayments` | Daily at 01:00 UTC | Process auto-payment for pending invoices |
| `checkRetryPayments` | Hourly | Retry failed payments (up to 3 attempts) |
| `checkTrialExpiry` | Hourly | Find expired trials, downgrade to Free |
| `suspendOverdue` | Daily at 02:00 UTC | Suspend companies past due for 5+ days |
| `expireSuspended` | Daily at 03:00 UTC | Expire companies suspended for 30+ days |
| `resetUsageCounters` | Daily at 04:00 UTC | Reset period-based usage counters |
| `syncStripeSubscriptions` | Hourly | Reconcile local ↔ Stripe subscription states |
| `sendInvoiceReminders` | Daily at 08:00 UTC | Email reminders for unpaid invoices |

### 10.1 Job Implementation

```typescript
@Injectable()
export class BillingCronService {
  constructor(
    private readonly billingService: BillingService,
    private readonly subscriptionService: CompanySubscriptionService,
    private readonly invoiceService: InvoiceService,
  ) {}

  // ── Daily invoice generation ──────────────────────────────────────────
  @Cron('0 0 * * *')  // Every day at midnight
  async generateInvoices(): Promise<void> {
    const expiringToday = await this.subscriptionService.findExpiringToday();
    for (const sub of expiringToday) {
      try {
        await this.invoiceService.generateInvoice(sub.id);
      } catch (err) {
        this.logger.error(`Failed to generate invoice for subscription ${sub.id}: ${err.message}`);
        // Continue with next subscription — don't block all invoices for one failure
      }
    }
  }

  // ── Trial expiry check ─────────────────────────────────────────────────
  @Cron('0 * * * *')  // Every hour
  async checkTrialExpiry(): Promise<void> {
    const expiredTrials = await this.subscriptionService.findExpiredTrials();
    for (const sub of expiredTrials) {
      try {
        await this.subscriptionService.downgradeToFree(sub.companyId);
      } catch (err) {
        this.logger.error(`Failed to downgrade trial ${sub.id}: ${err.message}`);
      }
    }
  }
}
```

---

## 11. Event Integration

### 11.1 Published Events

| Event | Payload | When |
|-------|---------|------|
| `billing.subscription.created` | `{ companyId, subscriptionId, planCode, status }` | New subscription created |
| `billing.subscription.changed` | `{ companyId, subscriptionId, oldPlan, newPlan, reason }` | Plan change or status transition |
| `billing.subscription.cancelled` | `{ companyId, subscriptionId, reason }` | Subscription cancelled |
| `billing.subscription.expired` | `{ companyId, subscriptionId }` | Subscription expired (not renewed) |
| `billing.payment.succeeded` | `{ companyId, invoiceId, amount, currency }` | Payment completed |
| `billing.payment.failed` | `{ companyId, invoiceId, amount, currency, reason }` | Payment failed |
| `billing.invoice.generated` | `{ companyId, invoiceId, amount, dueDate }` | New invoice created |
| `billing.seat.added` | `{ companyId, userId }` | New seat consumed |
| `billing.seat.removed` | `{ companyId, userId }` | Seat released |

### 11.2 Subscribed Events

| Event | Handler | Action |
|-------|---------|--------|
| `company.created` | `TrackNewCompanyHandler` | Create trial subscription for new company |
| `sale.completed` | `IncrementSalesUsageHandler` | Track monthly sales count |
| `product.created` | `IncrementProductUsageHandler` | Track product count |

---

## 12. API Design

### 12.1 Endpoints

| Method | Path | Description | Permissions |
|--------|------|-------------|-------------|
| `GET` | `/api/billing/plans` | List public plans | `billing:read` |
| `GET` | `/api/billing/plans/:id` | Get plan details | `billing:read` |
| `POST` | `/api/billing/plans` | Create plan (admin) | `admin:billing` |
| `PATCH` | `/api/billing/plans/:id` | Update plan (admin) | `admin:billing` |
| `DELETE` | `/api/billing/plans/:id` | Soft-delete plan (admin) | `admin:billing` |
| `GET` | `/api/billing/subscription` | Get my company's subscription | `billing:read` |
| `POST` | `/api/billing/subscription` | Subscribe to plan (from trial) | `billing:create` |
| `PATCH` | `/api/billing/subscription/plan` | Change plan (upgrade/downgrade) | `billing:update` |
| `POST` | `/api/billing/subscription/cancel` | Cancel subscription | `billing:update` |
| `POST` | `/api/billing/subscription/resume` | Resume cancelled subscription | `billing:update` |
| `GET` | `/api/billing/invoices` | List company invoices | `billing:read` |
| `GET` | `/api/billing/invoices/:id` | Get invoice details | `billing:read` |
| `GET` | `/api/billing/invoices/:id/pdf` | Download invoice PDF | `billing:read` |
| `POST` | `/api/billing/checkout` | Create Stripe checkout session | `billing:create` |
| `GET` | `/api/billing/usage` | Get current usage stats | `billing:read` |
| `GET` | `/api/billing/features` | Get enabled features for company | `billing:read` |
| `POST` | `/api/webhooks/stripe` | Stripe webhook (no auth) | Public |

### 12.2 Checkout Flow

```typescript
// 1. Company selects a plan → backend creates Stripe Checkout Session
@Post('checkout')
@RequirePermission('billing:create')
async createCheckout(
  @Body() dto: { planCode: string; billingInterval: 'MONTHLY' | 'ANNUAL' },
  @CurrentUser() user: JwtPayload,
): Promise<{ url: string; sessionId: string }> {
  return this.billingService.createCheckoutSession(user.companyId, dto.planCode, dto.billingInterval);
}

// 2. User is redirected to Stripe Checkout page
// 3. On success → Stripe redirects to success_url with session_id
// 4. On cancel → Stripe redirects to cancel_url
// 5. Webhook confirms payment → subscription activated
```

---

## 13. Security Model

### 13.1 Permissions

| Permission | Description |
|------------|-------------|
| `billing:create` | Subscribe to a plan |
| `billing:read` | View subscription, invoices, features |
| `billing:update` | Change plan, cancel/resume subscription |
| `billing:delete` | Delete payment methods |
| `admin:billing` | Admin: manage plans, override subscriptions |

### 13.2 Webhook Security

```
Stripe Webhook:
  Request ──► Stripe-Signature header verification
           ──► Idempotency-Key deduplication (24h window)
           ──► Rate limit: 100 req/min per IP
           ──► Payload size limit: 10KB
           ──► Only accept events from configured Stripe webhook secret
```

### 13.3 Rate Limiting

| Endpoint | Rate Limit | Scope |
|----------|------------|-------|
| `/api/webhooks/stripe` | 100/min | IP-based |
| `/api/billing/checkout` | 10/min per user | User-based |
| `/api/billing/*` | 60/min per user | User-based |

---

## 14. Operational Procedures

### 14.1 Manual Override

Admin endpoints for support cases:

```typescript
// Override company subscription (for support, comp adjustments)
@Patch('admin/companies/:id/subscription')
@RequirePermission('admin:billing')
async overrideSubscription(
  @Param('id') companyId: string,
  @Body() dto: { planId?: string; status?: string; trialEndsAt?: string },
  @CurrentUser() user: JwtPayload,
): Promise<CompanySubscriptionEntity> {
  return this.subscriptionService.adminOverride(companyId, dto, user.userId);
}

// Generate one-time invoice
@Post('admin/companies/:id/invoices')
@RequirePermission('admin:billing')
async createManualInvoice(
  @Param('id') companyId: string,
  @Body() dto: { amount: string; description: string },
): Promise<InvoiceEntity> {
  return this.invoiceService.createManualInvoice(companyId, dto);
}
```

### 14.2 Reconciliation

Daily reconciliation job compares Stripe data with local database:

```typescript
@Cron('0 5 * * *')  // Daily at 05:00 UTC
async reconcileSubscriptions(): Promise<void> {
  // 1. Fetch all active subscriptions from Stripe
  // 2. For each, compare with local CompanySubscription
  // 3. Report discrepancies:
  //    - Local active, Stripe cancelled → cancel locally
  //    - Local cancelled, Stripe active → reactivate locally
  //    - Plan mismatch → update locally
  // 4. Send reconciliation report to admin email
}
```

### 14.3 Disaster Recovery

| Scenario | Recovery |
|----------|----------|
| Stripe webhook missed | Hourly reconciliation job catches up |
| Stripe API outage | Queue payments, retry when available |
| Database corruption | Restore from backup, reconcile with Stripe |
| Subscription state mismatch | Admin override endpoints + reconciliation |
| Payment provider change | Export customers from Stripe, import to new provider |
