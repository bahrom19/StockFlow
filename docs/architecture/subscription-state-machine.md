# 🔄 StockFlow Enterprise — Subscription State Machine v1.0

**Status:** Architecture Design — Ready for Implementation  
**Date:** July 26, 2026  
**Supersedes:** `docs/roadmap/phase7-saas.md` §2 (Subscription Lifecycle)

---

## Table of Contents

1. [State Machine Overview](#1-state-machine-overview)
2. [State Definitions](#2-state-definitions)
3. [Transition Table](#3-transition-table)
4. [Transition Guards](#4-transition-guards)
5. [Side Effects](#5-side-effects)
6. [Sequence Diagrams](#6-sequence-diagrams)
7. [Implementation Strategy](#7-implementation-strategy)
8. [Concurrency & Race Conditions](#8-concurrency--race-conditions)
9. [Testing Strategy](#9-testing-strategy)

---

## 1. State Machine Overview

```
                         ┌──────────────────────────────────────┐
                         │           TRIAL                       │
                         │  (14 days, all features)              │
                         └──────┬──────────────┬────────────────┘
                                │              │
                    Subscribe   │              │ Trial expires
                    (payment)   │              │ (no payment)
                                │              │
                         ┌──────▼──────────┐   │
                         │                 │   │
                         │    ACTIVE       │   │
                         │  (full access)  │   │
                         │                 │   │
                         └──┬──┬──┬──┬─────┘   │
                            │  │  │  │         │
              ┌─────────────┘  │  │  └─────────┼──────────────┐
              │                │  │            │              │
         ┌────▼───┐    ┌──────▼──▼─────┐  ┌───▼──────┐  ┌────▼─────────┐
         │        │    │               │  │          │  │              │
         │CANCEL- │    │   PAST_DUE    │  │ EXPIRED  │  │ FREE         │
         │ LED    │    │  (5 day       │  │ (data    │  │ (limited     │
         │ (end of│    │   grace)      │  │  frozen) │  │  access)     │
         │ period)│    │               │  │          │  │              │
         └───┬────┘    └──────┬────────┘  └────▲─────┘  └──────▲───────┘
             │                │                 │               │
             │         ┌──────▼────────┐        │               │
             │         │               │        │               │
             └────────►│  SUSPENDED    ├────────┘               │
                       │  (API 402,    │                        │
                       │   30 day TTL) │                        │
                       │               │                        │
                       └───────────────┘                        │
                            │        ▲                          │
                            │        │                          │
                            │   ┌────┴─────────────┐            │
                            │   │                  │            │
                            └───┤  Payment made    │            │
                                │  (resume)        │            │
                                └──────────────────┘            │
                                                                │
                           ┌──────────────────┐                 │
                           │  Trial expired   │─────────────────┘
                           │  → Free tier     │
                           └──────────────────┘

```

### Allowed Transitions Summary

| From | To | Trigger |
|------|----|---------|
| `TRIAL` | `ACTIVE` | User subscribes (provides payment) |
| `TRIAL` | `FREE` | Trial expires without conversion |
| `ACTIVE` | `PAST_DUE` | Payment fails |
| `ACTIVE` | `CANCELLED` | User cancels (end of billing period) |
| `ACTIVE` | `FREE` | Downgrade to free plan |
| `PAST_DUE` | `ACTIVE` | Payment succeeds (auto-resume) |
| `PAST_DUE` | `SUSPENDED` | 5 days past due without payment |
| `SUSPENDED` | `ACTIVE` | Payment made (full resume) |
| `SUSPENDED` | `EXPIRED` | 30 days in suspended state |
| `CANCELLED` | `ACTIVE` | User resumes before period ends |
| `CANCELLED` | `EXPIRED` | Billing period ends |
| `EXPIRED` | `ACTIVE` | Admin reactivation (data restored) |
| `EXPIRED` | `FREE` | Data retention period expires |

---

## 2. State Definitions

### 2.1 TRIAL

| Property | Value |
|----------|-------|
| **Code** | `TRIAL` |
| **Duration** | 14 days (configurable per plan) |
| **Access** | Full plan features |
| **Payment** | No payment required |
| **Banner** | Warning: `"Your trial ends in N days. Add payment to continue."` |
| **Auto-transition** | → `FREE` (if no payment by end) or → `ACTIVE` (if payment added) |

**Database representation:**
```typescript
{
  status: 'TRIAL',
  trialStartsAt: Date,           // company.created
  trialEndsAt: Date,             // company.created + 14 days
  currentPeriodStart: Date,      // same as trialStartsAt
  currentPeriodEnd: Date,        // same as trialEndsAt
  isActive: true,
  cancelAtPeriodEnd: false,
}
```

### 2.2 ACTIVE

| Property | Value |
|----------|-------|
| **Code** | `ACTIVE` |
| **Duration** | Indefinite (until cancelled/failed) |
| **Access** | Full plan features |
| **Payment** | Recurring (monthly/annual) |
| **Banner** | None |
| **Auto-transition** | → `PAST_DUE` if payment fails |

```typescript
{
  status: 'ACTIVE',
  currentPeriodStart: Date,
  currentPeriodEnd: Date,        // next billing date
  isActive: true,
  cancelAtPeriodEnd: false,
}
```

### 2.3 PAST_DUE

| Property | Value |
|----------|-------|
| **Code** | `PAST_DUE` |
| **Duration** | 5 days (configurable) |
| **Access** | Full access (warning banner) |
| **Payment** | Retry automatically (3 attempts) |
| **Banner** | `"Payment failed. Update payment method to continue."` |
| **Auto-transition** | → `SUSPENDED` after 5 days |

```typescript
{
  status: 'PAST_DUE',
  pastDueAt: Date,
  paymentRetryCount: 0,          // 0-3
  lastPaymentAttempt: Date,
  isActive: true,                 // still accessible during grace
  cancelAtPeriodEnd: false,
}
```

### 2.4 SUSPENDED

| Property | Value |
|----------|-------|
| **Code** | `SUSPENDED` |
| **Duration** | 30 days (data retention) |
| **Access** | `402 Payment Required` on business endpoints |
| **Payment** | Accepts payment to resume (same data) |
| **Health/Login** | Still accessible |
| **Banner** | `"Your account is suspended. Pay to restore access."` |
| **Auto-transition** | → `EXPIRED` after 30 days |

```typescript
{
  status: 'SUSPENDED',
  suspendedAt: Date,
  willExpireAt: Date,             // suspendedAt + 30 days
  isActive: false,                // blocks business operations
  cancelAtPeriodEnd: false,
}
```

### 2.5 CANCELLED

| Property | Value |
|----------|-------|
| **Code** | `CANCELLED` |
| **Duration** | Until end of billing period |
| **Access** | Full until end of period |
| **Payment** | No further charges |
| **Banner** | `"Your subscription ends on [date]. Data will be frozen after that."` |
| **Auto-transition** | → `EXPIRED` at period end |
| **Resume** | Allowed before period end |

```typescript
{
  status: 'CANCELLED',
  cancelledAt: Date,
  cancelReason: string,
  cancelAtPeriodEnd: true,
  currentPeriodEnd: Date,         // last day of access
  isActive: true,                 // still active until period end
}
```

### 2.6 EXPIRED

| Property | Value |
|----------|-------|
| **Code** | `EXPIRED` |
| **Duration** | 90 days data retention (configurable) |
| **Access** | Data frozen — login only to export |
| **Payment** | Requires new subscription |
| **Data** | Kept for 90 days, then purged |
| **Banner** | `"Your subscription has expired. Contact support to restore data."` |

```typescript
{
  status: 'EXPIRED',
  expiredAt: Date,
  dataRetentionEndsAt: Date,      // expiredAt + 90 days
  isActive: false,
}
```

### 2.7 FREE

| Property | Value |
|----------|-------|
| **Code** | `FREE` |
| **Duration** | Indefinite |
| **Access** | Limited (Free plan limits) |
| **Payment** | None |
| **Banner** | `"Upgrade to unlock more features."` |
| **Upgrade** | Allowed at any time → `ACTIVE` |

---

## 3. Transition Table

| # | From | To | Trigger | Guard | Side Effects |
|---|------|----|---------|-------|-------------|
| 1 | `NEW` | `TRIAL` | Company created | None | Start trial, publish `subscription.created` |
| 2 | `TRIAL` | `ACTIVE` | Payment added | Plan not free | Charge payment, set period, publish `subscription.changed` |
| 3 | `TRIAL` | `FREE` | Trial expired | None | Downgrade limits, publish `subscription.expired` |
| 4 | `ACTIVE` | `PAST_DUE` | Payment failed | Retry < 3 | Schedule retry, notify, publish `payment.failed` |
| 5 | `ACTIVE` | `CANCELLED` | User cancels | None | Set cancelAtPeriodEnd, notify, publish `subscription.cancelled` |
| 6 | `ACTIVE` | `ACTIVE` | Plan upgrade | Valid plan, proration | Prorate charge, update plan, publish `subscription.changed` |
| 7 | `ACTIVE` | `ACTIVE` | Plan downgrade | Valid plan | Schedule at period end, publish `subscription.changed` |
| 8 | `ACTIVE` | `FREE` | Downgrade to free | No outstanding balance | Remove paid features, publish `subscription.changed` |
| 9 | `PAST_DUE` | `ACTIVE` | Payment succeeds | None | Clear retries, update period, publish `payment.succeeded` |
| 10 | `PAST_DUE` | `SUSPENDED` | 5 days overdue | None | Set suspendedAt, disable isActive, notify, publish `subscription.suspended` |
| 11 | `SUSPENDED` | `ACTIVE` | Payment made | None | Restore access, recalculate periods, publish `payment.succeeded` |
| 12 | `SUSPENDED` | `EXPIRED` | 30 days suspended | None | Set expiredAt, notify, publish `subscription.expired` |
| 13 | `CANCELLED` | `ACTIVE` | User resumes | Before period end | Clear cancelAtPeriodEnd, re-enable billing, publish `subscription.changed` |
| 14 | `CANCELLED` | `EXPIRED` | Period ends | None | Set expiredAt, disable access, publish `subscription.expired` |
| 15 | `EXPIRED` | `ACTIVE` | Admin reactivates | Within 90 days | Restore data, recalculate, publish `subscription.changed` |
| 16 | `EXPIRED` | `FREE` | Data retention ends | None | Purge or anonymize data, publish `subscription.expired` |
| 17 | `FREE` | `ACTIVE` | User upgrades | None | Charge payment, set period, publish `subscription.changed` |

---

## 4. Transition Guards

### 4.1 Guard Architecture

```typescript
interface TransitionGuard {
  name: string;
  check(
    from: SubscriptionStatus,
    to: SubscriptionStatus,
    subscription: CompanySubscription,
    context: TransitionContext,
  ): Promise<GuardResult>;
}

interface GuardResult {
  allowed: boolean;
  reason?: string;
  requiredAction?: string;
}

interface TransitionContext {
  actorId: string;
  actorRole: 'USER' | 'ADMIN' | 'SYSTEM';
  timestamp: Date;
  plan?: SubscriptionPlan;
  paymentMethodId?: string;
  idempotencyKey?: string;
}
```

### 4.2 Guards

| Guard | Applies To | Logic |
|-------|-----------|-------|
| `PaymentGuard` | `TRIAL→ACTIVE`, `FREE→ACTIVE` | Validates payment method exists and is chargeable |
| `RetryGuard` | `ACTIVE→PAST_DUE` | Checks retry count < 3, increments counter |
| `OverdueGuard` | `PAST_DUE→SUSPENDED` | Validates `pastDueAt` + 5 days has elapsed |
| `ExpiryGuard` | `SUSPENDED→EXPIRED` | Validates `suspendedAt` + 30 days has elapsed |
| `ResumeGuard` | `CANCELLED→ACTIVE` | Validates `cancelAtPeriodEnd` is true and period hasn't ended |
| `DowngradeGuard` | `ACTIVE→FREE` | Validates no outstanding invoices, no data exceeding free limits |
| `UpgradeGuard` | `ACTIVE→ACTIVE` | Validates target plan exists and is purchasable |
| `AdminGuard` | `EXPIRED→ACTIVE` | Validates actor has `admin:billing` permission |
| `ReactivateGuard` | `EXPIRED→ACTIVE` | Validates `dataRetentionEndsAt` hasn't passed |
| `CancelGuard` | `ACTIVE→CANCELLED` | Validates subscription is not already cancelled |

### 4.3 Guard Registration

```typescript
@Injectable()
export class SubscriptionStateMachine {
  private readonly transitions = new Map<string, TransitionDefinition>();

  constructor() {
    this.registerTransition({
      from: 'TRIAL',
      to: 'ACTIVE',
      guards: [this.paymentGuard],
      sideEffects: [this.activateSubscription, this.startBillingCycle],
    });
    // ... additional transitions registered in constructor
  }

  async transition(
    subscription: CompanySubscription,
    targetState: SubscriptionStatus,
    context: TransitionContext,
  ): Promise<CompanySubscription> {
    const key = `${subscription.status}→${targetState}`;
    const definition = this.transitions.get(key);
    if (!definition) {
      throw new BadRequestException(
        `Invalid transition: ${subscription.status} → ${targetState}`,
      );
    }

    // Run all guards
    for (const guard of definition.guards) {
      const result = await guard.check(subscription.status, targetState, subscription, context);
      if (!result.allowed) {
        throw new BadRequestException(
          `Transition blocked by guard '${guard.name}': ${result.reason}`,
        );
      }
    }

    // Execute transition inside transaction
    return this.prismaService.$transaction(async (tx) => {
      const updated = await this.subscriptionRepository.updateStatus(
        subscription.id,
        subscription.companyId,
        targetState,
        subscription.rowVersion,
        tx,
      );

      // Run side effects
      for (const effect of definition.sideEffects) {
        await effect(updated, context, tx);
      }

      return updated;
    });
  }
}
```

---

## 5. Side Effects

Every state transition triggers side effects. Side effects execute **inside** the same Prisma transaction.

| Transition | Side Effects |
|------------|-------------|
| → `TRIAL` | Create trial period timestamps |
| → `ACTIVE` | Set `isActive: true`, update period, clear past_due timers, reset retry count, clear suspension |
| → `PAST_DUE` | Set `pastDueAt`, schedule retry job, send notification |
| → `SUSPENDED` | Set `suspendedAt`, set `isActive: false`, send notification, publish event |
| → `CANCELLED` | Set `cancelledAt`, set `cancelAtPeriodEnd: true`, cancel Stripe subscription at period end |
| → `EXPIRED` | Set `expiredAt`, set `dataRetentionEndsAt`, disable `isActive`, schedule data retention cleanup |
| → `FREE` | Update plan to Free, downgrade feature limits, notify |

### 5.1 Side Effect Pattern

```typescript
// Side effects implement this interface
interface TransitionSideEffect {
  name: string;
  execute(
    subscription: CompanySubscription,
    context: TransitionContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;
}
```

### 5.2 Key Side Effects

```typescript
@Injectable()
export class ActivateSubscriptionEffect implements TransitionSideEffect {
  name = 'activateSubscription';

  async execute(subscription: CompanySubscription, ctx: TransitionContext, tx: Prisma.TransactionClient): Promise<void> {
    await this.subscriptionRepository.update(subscription.id, subscription.companyId, {
      status: 'ACTIVE',
      isActive: true,
      pastDueAt: null,
      suspendedAt: null,
      paymentRetryCount: 0,
      lastPaymentAttempt: null,
      currentPeriodStart: new Date(),
      currentPeriodEnd: this.calculatePeriodEnd(ctx.plan!.billingInterval),
      rowVersion: { increment: 1 },
    }, subscription.rowVersion, tx);
  }
}

@Injectable()
export class NotifyPastDueEffect implements TransitionSideEffect {
  name = 'notifyPastDue';

  async execute(subscription: CompanySubscription, ctx: TransitionContext, tx: Prisma.TransactionClient): Promise<void> {
    // Schedule notification asynchronously (after transaction commits)
    ctx.pendingNotifications.push({
      type: 'PAYMENT_FAILED',
      companyId: subscription.companyId,
      data: { retryCount: subscription.paymentRetryCount + 1 },
    });
  }
}
```

---

## 6. Sequence Diagrams

### 6.1 Company Registration → Trial Activation

```
User                  Frontend             API                  Billing               Stripe                Database
 │                      │                   │                     │                     │                     │
 │  Register company    │                   │                     │                     │                     │
 │─────────────────────►│                   │                     │                     │                     │
 │                      │  POST /auth/register                    │                     │                     │
 │                      │──────────────────►│                     │                     │                     │
 │                      │                   │  Create company     │                     │                     │
 │                      │                   │────────────────────►│                     │                     │
 │                      │                   │                     │                     │                     │
 │                      │                   │  ┌──────────────────────────────────────────────────┐           │
 │                      │                   │  │BEGIN TX                                         │           │
 │                      │                   │  │  1. Create Company                              │           │
 │                      │                   │  │  2. Create CompanyMember (Admin)                │           │
 │                      │                   │  │  3. Create CompanySubscription (TRIAL)           │           │
 │                      │                   │  │  4. Set trialStartsAt = now, trialEndsAt = +14d  │           │
 │                      │                   │  │  5. Publish: company.created                     │           │
 │                      │                   │  │  6. Publish: billing.subscription.created        │           │
 │                      │                   │  │COMMIT TX                                        │           │
 │                      │                   │  └──────────────────────────────────────────────────┘           │
 │                      │                   │                     │                     │                     │
 │                      │  { company,       │                     │                     │                     │
 │                      │    subscription }  │                     │                     │                     │
 │                      │◄──────────────────│                     │                     │                     │
 │  Dashboard           │                    │                     │                     │                     │
 │◄─────────────────────│                   │                     │                     │                     │
 │                      │                   │                     │                     │                     │
 │  [Banner: "14 days   │                   │                     │                     │                     │
 │   trial remaining"]  │                   │                     │                     │                     │
```

### 6.2 Trial → First Payment (Subscription)

```
User                  Frontend             API                  Billing               Stripe                Database
 │                      │                   │                     │                     │                     │
 │  Click "Subscribe"   │                   │                     │                     │                     │
 │─────────────────────►│                   │                     │                     │                     │
 │                      │  POST /billing/checkout                │                     │                     │
 │                      │  { plan: starter }  │                   │                     │                     │
 │                      │──────────────────►│                     │                     │                     │
 │                      │                   │  Create Stripe      │                     │                     │
 │                      │                   │  Checkout Session   │                     │                     │
 │                      │                   │────────────────────►│                     │                     │
 │                      │                   │                     │  Create Checkout    │                     │
 │                      │                   │                     │  Session            │                     │
 │                      │                   │                     │────────────────────►│                     │
 │                      │                   │                     │                     │  Return session     │
 │                      │                   │                     │◄────────────────────│                     │
 │                      │                   │  { url, sessionId } │                     │                     │
 │                      │                   │◄────────────────────│                     │                     │
 │                      │  Redirect to      │                     │                     │                     │
 │                      │  Stripe Checkout  │                     │                     │                     │
 │                      │◄──────────────────│                     │                     │                     │
 │                      │                   │                     │                     │                     │
 │  [Redirect to        │                   │                     │                     │                     │
 │   Stripe hosted      │                   │                     │                     │                     │
 │   payment page]      │                   │                     │                     │                     │
 │                      │                   │                     │                     │                     │
 │  ── Enter card details ──► Stripe ───────╤──────────────────────│────────────────────►│                     │
 │                                         │                      │                     │                     │
 │  Stripe redirects to                     │                     │                     │                     │
 │  success_url with                        │                     │                     │                     │
 │  session_id                              │                     │                     │                     │
 │─────────────────────────────────────────►│                     │                     │                     │
 │                                          │                     │                     │                     │
 │  ───── WEBHOOK: checkout.session.completed ──────────────────────►│                   │                     │
 │                                          │                     │  Verify session      │                     │
 │                                          │                     │────────────────────►│                     │
 │                                          │                     │◄────────────────────│                     │
 │                                          │                     │                     │                     │
 │                                          │  ┌─────────────────────────────────────────────────────────┐ │
 │                                          │  │  Prisma $transaction                                  │ │
 │                                          │  │  1. Validate idempotency                              │ │
 │                                          │  │  2. Find subscription by company                     │ │
 │                                          │  │  3. Verify valid transition: TRIAL→ACTIVE             │ │
 │                                          │  │  4. Run guards (PaymentGuard)                         │ │
 │                                          │  │  5. Update subscription:                              │ │
 │                                          │  │     status = ACTIVE                                   │ │
 │                                          │  │     isActive = true                                   │ │
 │                                          │  │     providerCustomerId = cus_xxx                     │ │
 │                                          │  │     providerSubscriptionId = sub_xxx                 │ │
 │                                          │  │     currentPeriodStart = now                          │ │
 │                                          │  │     currentPeriodEnd = now + 1 month                 │ │
 │                                          │  │     rowVersion = { increment: 1 }                    │ │
 │                                          │  │  6. Create Invoice (PAID)                             │ │
 │                                          │  │  7. Create PaymentTransaction (SUCCEEDED)             │ │
 │                                          │  │  8. Audit log                                        │ │
 │                                          │  │  9. Publish: payment.succeeded                       │ │
 │                                          │  │  10. Publish: subscription.changed                   │ │
 │                                          │  │  COMMIT                                             │ │
 │                                          │  └─────────────────────────────────────────────────────────┘ │
 │                                          │                     │                     │                     │
 │  Dashboard shows                        │                     │                     │                     │
 │  "Active" status                        │                     │                     │                     │
 │◄─────────────────────────────────────────│                     │                     │                     │
```

### 6.3 Monthly Renewal (Auto-payment)

```
Cron (Daily 01:00 UTC)     BillingService          InvoiceService        Stripe              Database
 │                            │                       │                    │                    │
 │  findSubscriptions         │                       │                    │                    │
 │  endingToday()             │                       │                    │                    │
 │───────────────────────────►│                       │                    │                    │
 │                            │                       │                    │                    │
 │  ─── for each subscription: ───────────────────────│                    │                    │
 │                            │                       │                    │                    │
 │  ┌───────────────────────────────────────────────────────────────────────────┐          │
 │  │  Prisma $transaction                                                     │          │
 │  │  1. Generate Invoice (PENDING)                                           │          │
 │  │  2. Generate InvoiceLines (plan charges)                                 │          │
 │  │  3. Create PaymentTransaction (PENDING)                                  │          │
 │  │  4. Charge via Stripe: payment_intents.create                            │          │
 │  │     ───────────────────────────────────────────────────────────────────► │          │
 │  │  5. Stripe: returns PaymentIntent                                        │          │
 │  │     ◄─────────────────────────────────────────────────────────────────── │          │
 │  │  6. If success:                                                          │          │
 │  │     - Update Invoice: PAID                                               │          │
 │  │     - Update PaymentTransaction: SUCCEEDED                               │          │
 │  │     - Update Subscription: new period                                    │          │
 │  │     - Audit log                                                          │          │
 │  │     - Publish: payment.succeeded                                         │          │
 │  │  7. If failure:                                                          │          │
 │  │     - Update PaymentTransaction: FAILED                                  │          │
 │  │     - Update Subscription: PAST_DUE                                      │          │
 │  │     - Schedule retry (24h)                                               │          │
 │  │     - Audit log                                                          │          │
 │  │     - Publish: payment.failed                                            │          │
 │  │  COMMIT                                                                  │          │
 │  └───────────────────────────────────────────────────────────────────────────┘          │
```

### 6.4 Payment Failure → Retry → Suspension

```
Cron                 BillingService       InvoiceService     Stripe             Database          Company
 │                       │                    │                │                  │                 │
 │  Day 1: Payment       │                    │                │                  │                 │
 │  attempt fails        │                    │                │                  │                 │
 │                       │  Charge fails      │                │                  │                 │
 │                       │───────────────────────────────────►│  decline          │                 │
 │                       │◄───────────────────────────────────│                  │                 │
 │                       │                    │                │                  │                 │
 │                       │  ┌──────────────────────────────────────────────────┐  │                 │
 │                       │  │ TX: PAST_DUE, retryCount: 1, scheduleNextRetry │  │                 │
 │                       │  └──────────────────────────────────────────────────┘  │                 │
 │                       │                    │                │                  │                 │
 │                       │                    │                │                  │  Email: Payment  │
 │                       │                    │                │                  │  failed          │
 │                       │                    │                │                  │─────────────────►│
 │                       │                    │                │                  │                 │
 │  ─────────────────────────── 24h ───────────────────────────                  │                 │
 │                       │                    │                │                  │                 │
 │  Hourly: checkRetry   │                    │                │                  │                 │
 │──────────────────────►│                    │                │                  │                 │
 │                       │  Retry #1          │                │                  │                 │
 │                       │───────────────────────────────────►│  decline          │                 │
 │                       │◄───────────────────────────────────│                  │                 │
 │                       │                    │                │                  │                 │
 │                       │  TX: retryCount: 2                 │                  │ Email: Retry #1 │
 │                       │                    │                │                  │ failed           │
 │                       │                    │                │                  │─────────────────►│
 │                       │                    │                │                  │                 │
 │  ─────────────────────────── 48h ───────────────────────────                  │                 │
 │                       │                    │                │                  │                 │
 │  Hourly: checkRetry   │                    │                │                  │                 │
 │──────────────────────►│  Retry #2          │                │                  │                 │
 │                       │───────────────────────────────────►│  decline          │                 │
 │                       │◄───────────────────────────────────│                  │                 │
 │                       │                    │                │                  │                 │
 │                       │  TX: retryCount: 3                 │                  │ Email: Retry #2 │
 │                       │                    │                │                  │ failed           │
 │                       │                    │                │                  │─────────────────►│
 │                       │                    │                │                  │                 │
 │  ─────────────────────────── 72h ───────────────────────────                  │                 │
 │                       │                    │                │                  │                 │
 │  Hourly: checkRetry   │                    │                │                  │                 │
 │──────────────────────►│  Retry #3          │                │                  │                 │
 │                       │───────────────────────────────────►│  decline          │                 │
 │                       │◄───────────────────────────────────│                  │                 │
 │                       │                    │                │                  │                 │
 │                       │  TX: EXPIRED       │                │                  │ Email: Retry #3 │
 │                       │  (max retries)     │                │                  │ failed, action   │
 │                       │                    │                │                  │ required         │
 │                       │                    │                │                  │─────────────────►│
 │                       │                    │                │                  │                 │
 │  ─────────────────────────── 5 days ────────────────────────                  │                 │
 │                       │                    │                │                  │                 │
 │  Daily: suspendOverdue│                    │                │                  │                 │
 │──────────────────────►│                    │                │                  │                 │
 │                       │  TX: SUSPENDED     │                │                  │ Email: Account   │
 │                       │  isActive: false   │                │                  │ suspended        │
 │                       │                    │                │                  │─────────────────►│
 │                       │                    │                │                  │                 │
 │  ─────────────────────────── 30 days ───────────────────────                  │                 │
 │                       │                    │                │                  │                 │
 │  Daily: expire        │                    │                │                  │                 │
 │──────────────────────►│  TX: EXPIRED       │                │                  │ Email: Account   │
 │                       │  dataRetentionEnds │                │                  │ expired, data    │
 │                       │                    │                │                  │ retention notice │
 │                       │                    │                │                  │─────────────────►│
```

### 6.5 Plan Upgrade (Mid-cycle)

```
User               Frontend            API              Billing          Stripe           Database
 │                    │                  │                 │                │                │
 │  Upgrade from     │                  │                 │                │                │
 │  Starter→Business │                  │                 │                │                │
 │──────────────────►│                  │                 │                │                │
 │                   │ PATCH /billing/  │                 │                │                │
 │                   │ subscription/    │                 │                │                │
 │                   │ plan             │                 │                │                │
 │                   │ { plan: business,│                 │                │                │
 │                   │   interval:      │                 │                │                │
 │                   │   monthly }      │                 │                │                │
 │                   │─────────────────►│                 │                │                │
 │                   │                  │                 │                │                │
 │                   │                  │  ┌─────────────────────────────────────────────────────┐
 │                   │                  │  │  TX:                                                │
 │                   │                  │  │  1. Load current subscription + plan                 │
 │                   │                  │  │  2. Validate: ACTIVE, not cancelled                 │
 │                   │                  │  │  3. Calculate proration:                             │
 │                   │                  │  │     days_remaining = periodEnd - now                 │
 │                   │                  │  │     total_days = periodEnd - periodStart             │
 │                   │                  │  │     credit = (currentPrice / total_days) * remaining │
 │                   │                  │  │     charge = newPrice - credit                       │
 │                   │                  │  │  4. Create upcoming_invoice on Stripe via API        │
 │                   │                  │  │──────────────────────────────────────────────────►   │
 │                   │                  │  │  ◄──────────────────────────────────────────────────   │
 │                   │                  │  │  5. Charge prorated amount                            │
 │                   │                  │  │──────────────────────────────────────────────────►   │
 │                   │                  │  │  ◄──────────────────────────────────────────────────   │
 │                   │                  │  │  6. Update subscription: plan = Business              │
 │                   │                  │  │     rowVersion = { increment: 1 }                    │
 │                   │                  │  │  7. Create PaymentTransaction (SUCCEEDED)            │
 │                   │                  │  │  8. Audit log                                        │
 │                   │                  │  │  9. Publish: subscription.changed                    │
 │                   │                  │  │  COMMIT                                              │
 │                   │                  │  └─────────────────────────────────────────────────────┘
 │                   │                  │                 │                │                │
 │                   │  Updated         │                 │                │                │
 │                   │  subscription    │                 │                │                │
 │                   │◄─────────────────│                 │                │                │
 │  Dashboard shows  │                  │                 │                │                │
 │  "Business"       │                  │                 │                │                │
 │◄──────────────────│                  │                 │                │                │
```

### 6.6 Plan Downgrade (Scheduled at Period End)

```
User               Frontend            API              Billing          Stripe           Database
 │                    │                  │                 │                │                │
 │  Downgrade from   │                  │                 │                │                │
 │  Business→Starter │                  │                 │                │                │
 │──────────────────►│                  │                 │                │                │
 │                   │ PATCH /billing/  │                 │                │                │
 │                   │ subscription/    │                 │                │                │
 │                   │ plan             │                 │                │                │
 │                   │ { plan: starter }│                 │                │                │
 │                   │─────────────────►│                 │                │                │
 │                   │                  │                 │                │                │
 │                   │                  │  ┌────────────────────────────────────┐             │
 │                   │                  │  │  TX:                               │             │
 │                   │                  │  │  1. Validate: not cancelled        │             │
 │                   │                  │  │  2. Calculate: no credit (downgrade)│             │
 │                   │                  │  │  3. Set pendingPlanId = starter    │             │
 │                   │                  │  │     (deferred to period end)       │             │
 │                   │                  │  │  4. Audit log                      │             │
 │                   │                  │  │  5. Publish: subscription.changed  │             │
 │                   │                  │  │  COMMIT                            │             │
 │                   │                  │  └────────────────────────────────────┘             │
 │                   │                  │                 │                │                │
 │  ───────────────────────────── period_end ─────────────────────────────                    │
 │                   │                  │                 │                │                │
 │  Cron: process    │                  │                 │                │                │
 │  pending          │                  │                 │                │                │
 │  downgrades       │                  │                 │                │                │
 │─────────────────────────────────────►│                 │                │                │
 │                   │                  │  ┌────────────────────────────────────┐             │
 │                   │                  │  │  TX:                               │             │
 │                   │                  │  │  1. Apply pendingPlanId           │             │
 │                   │                  │  │  2. Update subscription plan       │             │
 │                   │                  │  │  3. Update Stripe (schedule update)│             │
 │                   │                  │  │  4. Audit log                      │             │
 │                   │                  │  │  5. Publish: subscription.changed  │             │
 │                   │                  │  │  COMMIT                            │             │
 │                   │                  │  └────────────────────────────────────┘             │
```

### 6.7 Cancellation

```
User               Frontend            API              Billing          Stripe           Database
 │                    │                  │                 │                │                │
 │  Cancel            │                  │                 │                │                │
 │──────────────────►│                  │                 │                │                │
 │                   │ POST /billing/   │                 │                │                │
 │                   │ subscription/    │                 │                │                │
 │                   │ cancel           │                 │                │                │
 │                   │ { reason: "too   │                 │                │                │
 │                   │   expensive" }   │                 │                │                │
 │                   │─────────────────►│                 │                │                │
 │                   │                  │                 │                │                │
 │                   │                  │  ┌──────────────────────────────────────────────────────┐
 │                   │                  │  │  TX:                                                 │
 │                   │                  │  │  1. Load subscription (optimistic lock)               │
 │                   │                  │  │  2. Validate: ACTIVE or TRIAL                         │
 │                   │                  │  │  3. Set cancelAtPeriodEnd = true                      │
 │                   │                  │  │     status = CANCELLED                                │
 │                   │                  │  │     cancelReason = "too expensive"                    │
 │                   │                  │  │     rowVersion = { increment: 1 }                    │
 │                   │                  │  │  4. Cancel Stripe subscription at period end          │
 │                   │                  │  │──────────────────────────────────────────────────►   │
 │                   │                  │  │     ◄────────────────────────────────────────────────  │
 │                   │                  │  │  5. Audit log                                        │
 │                   │                  │  │  6. Schedule: EXPIRED at periodEnd                   │
 │                   │                  │  │  7. Publish: subscription.cancelled                  │
 │                   │                  │  │  COMMIT                                              │
 │                   │                  │  └─────────────────────────────────────────────────────┘
 │                   │                  │                 │                │                │
 │                   │  { status:       │                 │                │                │
 │                   │    "CANCELLED",  │                 │                │                │
 │                   │    endsAt: ... } │                 │                │                │
 │                   │◄─────────────────│                 │                │                │
 │  Banner: "Your    │                  │                 │                │                │
 │  subscription     │                  │                 │                │                │
 │  ends on [date]"  │                  │                 │                │                │
 │◄──────────────────│                  │                 │                │                │
```

### 6.8 Webhook Retry Flow

```
Stripe                    WebhookCtrl            BillingService          Outbox              Database
  │                           │                      │                    │                    │
  │  POST /api/webhooks/      │                      │                    │                    │
  │  stripe                   │                      │                    │                    │
  │  { event:                 │                      │                    │                    │
  │   invoice.payment_failed }│                      │                    │                    │
  │──────────────────────────►│                      │                    │                    │
  │                           │                      │                    │                    │
  │                           │  1. Verify signature │                    │                    │
  │                           │  2. Check idempotency│                    │                    │
  │                           │─────────────────────►│                    │                    │
  │                           │                      │                    │                    │
  │                           │  ┌─────────────────────────────────────────────────────────┐  │
  │                           │  │  TX:                                                    │  │
  │                           │  │  1. Find subscription by providerSubscriptionId         │  │
  │                           │  │  2. Verify valid transition: ACTIVE→PAST_DUE            │  │
  │                           │  │  3. Update subscription:                                │  │
  │                           │  │     status = PAST_DUE                                   │  │
  │                           │  │     paymentRetryCount = current + 1                     │  │
  │                           │  │     rowVersion = { increment: 1 }                      │  │
  │                           │  │  4. Update Invoice: status = PAST_DUE                   │  │
  │                           │  │  5. Create PaymentTransaction: FAILED                   │  │
  │                           │  │  6. Store idempotency key (ttl: 24h)                    │  │
  │                           │  │  7. Audit log                                           │  │
  │                           │  │  COMMIT                                                 │  │
  │                           │  └─────────────────────────────────────────────────────────┘  │
  │                           │                      │                    │                    │
  │  200 OK                   │                      │                    │                    │
  │◄──────────────────────────│                      │                    │                    │
```

---

## 7. Implementation Strategy

### 7.1 State Machine Service

```typescript
@Injectable()
export class SubscriptionStateMachine {
  private readonly transitionMap = new Map<string, TransitionDef>();

  constructor(
    private readonly subscriptionRepository: CompanySubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    private readonly eventBus: EventBus,
    private readonly auditLog: AuditLogService,
    private readonly prismaService: PrismaService,
  ) {
    this.registerAllTransitions();
  }

  // ── Public API ────────────────────────────────────────────────────────
  async transit(
    companyId: string,
    targetStatus: string,
    context: TransitionContext,
  ): Promise<CompanySubscriptionEntity> {
    const subscription = await this.subscriptionRepository.findByCompany(companyId);
    if (!subscription) throw new NotFoundException('Subscription not found');

    const def = this.lookupTransition(subscription.status, targetStatus);
    if (!def) throw new BadRequestException(`Invalid transition: ${subscription.status}→${targetStatus}`);

    return this.prismaService.$transaction(async (tx) => {
      // Run guards
      for (const guard of def.guards) {
        const result = await guard.check(subscription, context);
        if (!result.allowed) throw new BadRequestException(result.reason!);
      }

      // Execute transition
      const updated = await this.subscriptionRepository.updateByCompany(
        companyId,
        { status: targetStatus, ...def.fieldUpdates },
        subscription.rowVersion,
        tx,
      );

      // Run side effects
      for (const effect of def.sideEffects) {
        await effect.execute(updated, context, tx);
      }

      return this.subscriptionMapper.toEntity(updated);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  private lookupTransition(from: string, to: string): TransitionDef | undefined {
    return this.transitionMap.get(`${from}→${to}`);
  }

  private registerTransition(from: string, to: string, def: Omit<TransitionDef, 'from' | 'to'>): void {
    this.transitionMap.set(`${from}→${to}`, { from, to, ...def });
  }

  private registerAllTransitions(): void {
    this.registerTransition('TRIAL', 'ACTIVE', {
      guards: [new PaymentGuard()],
      fieldUpdates: {
        isActive: true,
        trialStartsAt: null,
        trialEndsAt: null,
        pastDueAt: null,
        suspendedAt: null,
        paymentRetryCount: 0,
        providerCustomerId: undefined,
        providerSubscriptionId: undefined,
      },
      sideEffects: [new ActivateSubscriptionEffect()],
    });
    // ... register all 17 transitions
  }
}
```

### 7.2 Module Integration

```typescript
@Module({
  imports: [PrismaModule, EventBusModule, SharedModule],
  controllers: [
    SubscriptionPlanController,
    CompanySubscriptionController,
    InvoiceController,
    BillingWebhookController,
    BillingAdminController,
  ],
  providers: [
    SubscriptionStateMachine,
    SubscriptionPlanService,
    CompanySubscriptionService,
    BillingService,
    InvoiceService,
    FeatureFlagService,
    UsageTrackingService,
    SeatService,
    BillingCronService,
    // Payment providers
    { provide: 'IPaymentProvider', useClass: StripeProvider },
    // Transition guards
    PaymentGuard,
    RetryGuard,
    OverdueGuard,
    ExpiryGuard,
    ResumeGuard,
    DowngradeGuard,
    UpgradeGuard,
    AdminGuard,
    ReactivateGuard,
    CancelGuard,
    // Transition side effects
    ActivateSubscriptionEffect,
    CancelSubscriptionEffect,
    SuspendCompanyEffect,
    NotifyPastDueEffect,
    // Cron jobs
    ...bullQueueProviders,
  ],
  exports: [CompanySubscriptionService, FeatureFlagService, SubscriptionStateMachine],
})
export class BillingModule {}
```

### 7.3 Cron Schedule Integration

```typescript
@Injectable()
export class BillingCronService {
  // ── Daily subscription renewal ──────────────────────────────────────
  @Cron('0 1 * * *')  // 01:00 UTC daily
  async processRenewals(): Promise<void> {
    const expiring = await this.subscriptionService.findExpiringToday();
    for (const sub of expiring) {
      try {
        await this.billingService.processRenewal(sub);
      } catch (err) {
        this.logger.error(`Renewal failed for subscription ${sub.id}: ${err.message}`);
      }
    }
  }

  // ── Hourly payment retry ─────────────────────────────────────────────
  @Cron('0 * * * *')  // Every hour
  async retryFailedPayments(): Promise<void> {
    const pendingRetries = await this.invoiceService.findPendingRetries();
    for (const invoice of pendingRetries) {
      try {
        await this.billingService.retryPayment(invoice.id);
      } catch (err) {
        this.logger.error(`Retry failed for invoice ${invoice.id}: ${err.message}`);
      }
    }
  }

  // ── Trial expiry (hourly) ───────────────────────────────────────────
  @Cron('30 * * * *')  // Every hour at :30
  async processTrialExpiry(): Promise<void> {
    const expired = await this.subscriptionService.findExpiredTrials();
    for (const sub of expired) {
      try {
        await this.subscriptionService.downgradeToFree(sub.companyId);
      } catch (err) {
        this.logger.error(`Trial downgrade failed for ${sub.id}: ${err.message}`);
      }
    }
  }

  // ── Suspension (daily) ──────────────────────────────────────────────
  @Cron('0 2 * * *')  // 02:00 UTC daily
  async processSuspension(): Promise<void> {
    const overdue = await this.subscriptionService.findOverdueGracePeriod();
    for (const sub of overdue) {
      try {
        await this.stateMachine.transit(sub.companyId, 'SUSPENDED', {
          actorId: 'SYSTEM',
          actorRole: 'SYSTEM',
          timestamp: new Date(),
        });
      } catch (err) {
        this.logger.error(`Suspension failed for ${sub.id}: ${err.message}`);
      }
    }
  }

  // ── Expiry (daily) ──────────────────────────────────────────────────
  @Cron('0 3 * * *')  // 03:00 UTC daily
  async processExpiry(): Promise<void> {
    const expired = await this.subscriptionService.findExpiredSuspensions();
    for (const sub of expired) {
      try {
        await this.stateMachine.transit(sub.companyId, 'EXPIRED', {
          actorId: 'SYSTEM',
          actorRole: 'SYSTEM',
          timestamp: new Date(),
        });
      } catch (err) {
        this.logger.error(`Expiry failed for ${sub.id}: ${err.message}`);
      }
    }
  }
}
```

---

## 8. Concurrency & Race Conditions

### 8.1 Optimistic Locking

Every subscription state transition uses `updateMany` with `rowVersion`:

```typescript
async transitionStatus(
  companyId: string,
  fromStatus: string,
  toStatus: string,
  expectedRowVersion: number,
  tx: Prisma.TransactionClient,
): Promise<CompanySubscription> {
  const result = await tx.companySubscription.updateMany({
    where: {
      companyId,
      status: fromStatus,
      rowVersion: expectedRowVersion,
    },
    data: {
      status: toStatus,
      rowVersion: { increment: 1 },
    },
  });

  if (result.count === 0) {
    // Check if it's a version conflict or invalid status
    const current = await tx.companySubscription.findUnique({
      where: { companyId },
      select: { status: true, rowVersion: true },
    });

    if (!current) throw new NotFoundException('Subscription not found');
    if (current.rowVersion !== expectedRowVersion) {
      throw new ConflictException('Subscription was modified by another request');
    }
    throw new BadRequestException(
      `Cannot transition from ${fromStatus}: current status is ${current.status}`,
    );
  }

  return tx.companySubscription.findUnique({ where: { companyId } });
}
```

### 8.2 Idempotency for Transitions

```typescript
async transit(
  companyId: string,
  targetStatus: string,
  context: TransitionContext,
): Promise<CompanySubscriptionEntity> {
  // Check idempotency key
  if (context.idempotencyKey) {
    const existing = await this.idempotencyService.get(context.idempotencyKey);
    if (existing) return existing;
  }

  const result = await this.prismaService.$transaction(async (tx) => {
    // ... transition logic ...
  });

  // Store result
  if (context.idempotencyKey) {
    await this.idempotencyService.set(context.idempotencyKey, result, { ttl: 86400 });
  }

  return result;
}
```

### 8.3 Race Condition Scenarios

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Two simultaneous payments | Double charge | Idempotency key + optimistic lock on subscription |
| Cancel + resume race | Lost cancellation | Optimistic lock — one request will get ConflictException |
| Upgrade + downgrade simultaneously | Wrong proration | State machine processes one transition at a time |
| Webhook + manual admin change | Inconsistent state | Optimistic lock — webhook will retry with fresh rowVersion |
| Trial expiry + payment at same second | Lost payment | Transaction processes both — trial expiry reads before writing |

### 8.4 Webhook Deduplication

```typescript
@Post('webhooks/stripe')
async handleWebhook(
  @Headers('stripe-signature') signature: string,
  @Req() req: Request,
): Promise<void> {
  // 1. Construct event (verifies signature)
  const event = this.stripeProvider.constructWebhookEvent(req.body, signature);

  // 2. Deduplication (idempotency)
  const idempotencyKey = `stripe-webhook-${event.id}`;
  const processed = await this.idempotencyService.get(idempotencyKey);
  if (processed) {
    this.logger.log(`Webhook ${event.id} already processed, skipping`);
    return;
  }

  // 3. Process event
  await this.prismaService.$transaction(async (tx) => {
    await this.billingService.handleStripeEvent(event, tx);
    await this.idempotencyService.set(idempotencyKey, true, { ttl: 86400 }, tx);
  });
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Test | Description |
|------|-------------|
| `should transition TRIAL→ACTIVE` | Valid payment, all guards pass |
| `should reject TRIAL→SUSPENDED` | Invalid transition (no direct path) |
| `should reject ACTIVE→ACTIVE with same plan` | No-op guard |
| `should reject transition with stale rowVersion` | ConflictException |
| `should reject cancelled → active if period ended` | ResumeGuard |
| `should reject downgrade if data exceeds free limits` | DowngradeGuard |
| `should execute side effects in order` | Ordered execution |
| `should rollback on side effect failure` | Transaction rollback |

### 9.2 Integration Tests

| Test | Description |
|------|-------------|
| `trial → subscribe → active` | Full happy path with real database |
| `active → payment fails → past_due → retry → active` | Retry success |
| `active → payment fails → past_due → suspended` | Full suspension flow |
| `active → cancel → resume` | Resume before period end |
| `active → cancel → expired` | Period end expiry |
| `trial → expired → free` | Trial without conversion |
| `concurrent upgrade + downgrade` | ConflictException on second request |
| `duplicate webhook` | IdempotencyKey prevents double processing |

### 9.3 State Transition Tests

```typescript
describe('SubscriptionStateMachine', () => {
  let machine: SubscriptionStateMachine;
  let subscription: CompanySubscription;

  // Test every valid transition
  const validTransitions = [
    ['TRIAL', 'ACTIVE'],
    ['TRIAL', 'FREE'],
    ['ACTIVE', 'PAST_DUE'],
    ['ACTIVE', 'CANCELLED'],
    ['ACTIVE', 'FREE'],
    ['PAST_DUE', 'ACTIVE'],
    ['PAST_DUE', 'SUSPENDED'],
    ['SUSPENDED', 'ACTIVE'],
    ['SUSPENDED', 'EXPIRED'],
    ['CANCELLED', 'ACTIVE'],
    ['CANCELLED', 'EXPIRED'],
    ['EXPIRED', 'ACTIVE'],
    ['FREE', 'ACTIVE'],
  ];

  // Test every invalid transition
  const invalidTransitions = [
    ['TRIAL', 'SUSPENDED'],
    ['TRIAL', 'EXPIRED'],
    ['TRIAL', 'CANCELLED'],
    ['ACTIVE', 'TRIAL'],
    ['PAST_DUE', 'TRIAL'],
    ['PAST_DUE', 'CANCELLED'],
    ['PAST_DUE', 'FREE'],
    ['SUSPENDED', 'TRIAL'],
    ['SUSPENDED', 'PAST_DUE'],
    ['SUSPENDED', 'CANCELLED'],
    ['SUSPENDED', 'FREE'],
    ['EXPIRED', 'TRIAL'],
    ['EXPIRED', 'PAST_DUE'],
    ['EXPIRED', 'CANCELLED'],
    ['EXPIRED', 'SUSPENDED'],
    ['CANCELLED', 'PAST_DUE'],
    ['CANCELLED', 'SUSPENDED'],
    ['CANCELLED', 'FREE'],
    ['FREE', 'TRIAL'],
    ['FREE', 'PAST_DUE'],
    ['FREE', 'CANCELLED'],
    ['FREE', 'SUSPENDED'],
    ['FREE', 'EXPIRED'],
  ];

  it.each(validTransitions)('should allow %s → %s', async (from, to) => {
    subscription.status = from as any;
    const context = createValidContext(from, to);
    await expect(machine.transit(subscription.companyId, to as any, context)).resolves.toBeDefined();
  });

  it.each(invalidTransitions)('should reject %s → %s', async (from, to) => {
    subscription.status = from as any;
    const context = createValidContext(from, to);
    await expect(machine.transit(subscription.companyId, to as any, context)).rejects.toThrow(BadRequestException);
  });
});
```

### 9.4 Concurrency Tests

```typescript
describe('Subscription concurrency', () => {
  it('should handle concurrent cancellation and payment', async () => {
    // Setup: ACTIVE subscription
    const sub = await createSubscription('ACTIVE');

    // Two concurrent requests
    const cancelPromise = machine.transit(sub.companyId, 'CANCELLED', userContext);
    const paymentPromise = billingService.processRenewal(sub);

    // One succeeds, one gets ConflictException
    const results = await Promise.allSettled([cancelPromise, paymentPromise]);
    const successes = results.filter(r => r.status === 'fulfilled');
    const conflicts = results.filter(r =>
      r.status === 'rejected' && r.reason instanceof ConflictException
    );

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);
  });

  it('should handle duplicate webhook events with idempotency', async () => {
    const event = createStripeEvent('invoice.payment_succeeded');
    const first = await webhookController.handleWebhook('test_sig', { body: event });
    const second = await webhookController.handleWebhook('test_sig', { body: event });

    // First processes, second is idempotent
    expect(first).toBeDefined();
    expect(second).toBeDefined(); // Returns cached result, doesn't throw
  });
});
```
