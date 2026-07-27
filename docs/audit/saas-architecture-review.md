# 🛡️ StockFlow Enterprise — SaaS Architecture Zero-Trust Review

**Reviewer:** Independent Principal Software Architect  
**Date:** July 26, 2026  
**Documents Reviewed:**

1. `docs/architecture/billing-architecture-v1.md`
2. `docs/architecture/subscription-state-machine.md`
3. `docs/architecture/feature-flag-engine.md`
4. `docs/architecture/stripe-integration.md`
5. `docs/architecture/architecture-freeze-v1.md`
6. `docs/architecture/compatibility-policy.md`

**Review Methodology:** Zero-trust — every assumption questioned, every edge case examined, every failure scenario considered.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scoring](#2-scoring)
3. [🔴 Critical Issues](#3--critical-issues)
4. [🟠 High Priority Issues](#4--high-priority-issues)
5. [🟡 Medium Issues](#5--medium-issues)
6. [🟢 Low Issues & Observations](#6--low-issues--observations)
7. [False Positives (Potential Concerns that ARE Correctly Handled)](#7-false-positives)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [Final Architecture Maturity Assessment](#9-final-architecture-maturity-assessment)

---

## 1. Executive Summary

The SaaS architecture documents represent a thorough and well-structured enterprise design. **No showstoppers were found.** However, 15 issues were identified across critical, high, medium, and low severity levels.

### Critical Issues: 2
### High Priority Issues: 5
### Medium Issues: 5
### Low Issues: 3

### Design Strengths

- Payment Provider Abstraction is well-designed for future PayPal/Kaspi integration
- State machine has comprehensive transition table (17 transitions)
- Feature Flag Engine has proper 4-level resolution priority
- Outbox pattern integration handles the dual-write problem correctly
- Idempotency strategy covers both Redis and database fallback
- Subscription state machine includes concurrency scenarios

### Biggest Risks

1. **Invoice numbering collision under race conditions** — daily-reset sequences are vulnerable to concurrent invoice generation
2. **Trial abuse** — no mechanism to prevent repeated trial signups across companies or identity reuse
3. **Cron job idempotency** — no processing-time guards prevent overlapping cron executions for long-running batches
4. **Seat management race conditions** — check-then-create pattern without optimistic locking on CompanyMember
5. **Feature flag cache inconsistency window** — 5-minute TTL creates a window where stale permissions are enforced

---

## 2. Scoring

| Category | Score | Rationale |
|----------|-------|-----------|
| **Billing Lifecycle** | 8.5/10 | Comprehensive state machine, but trial abuse not addressed |
| **Stripe Integration** | 8.5/10 | Webhook pipeline solid, but recovery procedures manual |
| **Subscription State Machine** | 9.0/10 | Excellent transition table, guards, side effects |
| **Feature Flag Engine** | 8.0/10 | Good evaluation pipeline, but caching gap remains |
| **Idempotency** | 8.5/10 | Dual Redis+DB store is robust, but no distributed lock |
| **Multi-tenant Isolation** | 9.0/10 | companyId enforced everywhere |
| **Security** | 8.5/10 | Webhook signature, RBAC, PCI compliance addressed |
| **Event/Outbox Consistency** | 8.0/10 | Outbox pattern correct but publisher concurrency not addressed |
| **Tax/VAT** | 6.0/10 | Identified as gap — no actual calculation logic designed |
| **Cron/Reliability** | 7.0/10 | No cron locking, overlapping execution not prevented |
| **Overall Design Maturity** | **8.2/10** |

---

## 3. 🔴 Critical Issues

---

### CRITICAL-1: Invoice Numbering Race Condition

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §7.3 |
| **Area** | Invoice Lifecycle, Invoice Numbering |
| **Business Impact** | Duplicate invoice numbers or sequence gaps under concurrent invoice generation |
| **Technical Impact** | Unique constraint violation → `500 Internal Server Error` during daily cron |

**Issue:**

The invoice numbering scheme `INV-{YYYYMMDD}-{SEQ}` with daily-reset sequences creates a classic race condition. The cron job that generates invoices at midnight will attempt to create invoices for all subscriptions ending today. With thousands of subscriptions, these are processed in a `for` loop:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async generateDailyInvoices(): Promise<void> {
  const expiring = await this.subscriptionService.findExpiringToday();
  for (const sub of expiring) {
    // Each iteration runs in its own $transaction
    // Each reads the current sequence number independently
    // No global sequence lock
  }
}
```

If two subscriptions are processed concurrently (or if the cron overlaps with a manual invoice generation), both read the same sequence number `INV-20260801-0001`, and one fails with a unique constraint violation.

**Root Cause:** The daily-reset sequence has no atomic increment-and-read mechanism. Prisma does not support `SELECT ... FOR UPDATE` natively, and there is no `@@unique` constraint on the invoice number to prevent duplicates.

**Current Mitigation (Insufficient):** The document mentions "Guaranteed unique via unique constraint" but provides no implementation for atomic sequence generation.

**Suggested Fix:**

Replace the daily-reset sequence with one of:

**Option A — PostgreSQL Sequence (recommended):**

```sql
-- Create a global sequence (never resets, no collisions)
CREATE SEQUENCE invoice_number_seq START 100000;

-- Format: INV-{SEQ padded to 8 digits}
-- Example: INV-00010001
```

```typescript
async generateInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const result: { nextval: bigint }[] = await tx.$queryRaw`
    SELECT nextval('invoice_number_seq') as nextval
  `;
  const seq = Number(result[0].nextval);
  return `INV-${String(seq).padStart(8, '0')}`;
}
```

**Option B — Prisma-level atomic increment (less ideal but works):**

```typescript
// Use a dedicated "increment counter" model with @@unique on number
const counter = await tx.invoiceCounter.upsert({
  where: { date: todayString },
  create: { date: todayString, sequence: 1 },
  update: { sequence: { increment: 1 } },
});
return `INV-${todayString}-${String(counter.sequence).padStart(4, '0')}`;
```

**Option C — UUID-based invoice numbers (simplest):**

```typescript
// Sacrifices human readability for iron-clad uniqueness
return `INV-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
```

**Recommendation:** Option A (PostgreSQL sequence). It is atomic, never collides, and performs well at scale.

---

### CRITICAL-2: Trial Abuse — No Identity Verification

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §1.1, `subscription-state-machine.md` §2.1 |
| **Area** | Trial Activation, Anti-Abuse |
| **Business Impact** | Unlimited free trials by creating multiple companies; revenue loss, resource abuse |
| **Technical Impact** | No defense-in-depth against trial farming |

**Issue:**

The architecture allows any user to register a company and get a 14-day trial with full enterprise features. There is **no mechanism** to prevent:

1. **Same email registering multiple companies** — a user can create Company A, wait for trial to expire, then create Company B with the same email to get another 14-day trial
2. **Same IP/payment method registering multiple trials** — no device fingerprinting, IP tracking, or payment method deduplication
3. **Disposable email addresses** — no email domain verification or disposable email blocking
4. **Automated trial farming** — no rate limiting on company creation per IP/email

**Current Mitigation (Insufficient):** The `trialEndsAt` check only prevents the same subscription from receiving additional trial days. Nothing prevents a new company+subscription from being created.

**Suggested Fix:**

Implement a **Trial Abuse Prevention Service**:

```typescript
interface TrailAbuseCheck {
  email: string;           // Normalized email
  ipAddress?: string;      // Registration IP
  deviceFingerprint?: string;
}

@Injectable()
class TrialAbuseService {
  async checkAbuse(params: TrailAbuseCheck): Promise<AbuseResult> {
    const checks = await Promise.all([
      // 1. Email-based check: has this email been on trial before?
      this.companyRepo.countByEmail(params.email, { trialInLastDays: 365 }),

      // 2. IP-based check: has this IP created companies recently?
      this.companyRepo.countByIP(params.ipAddress, { inLastHours: 24 }),

      // 3. Rate limit: max N trials per hour globally
      this.rateLimiter.check(`trial-${params.ipAddress}`, { limit: 3, window: '24h' }),
    ]);

    if (checks[0] > 0) {
      return { allowed: false, reason: 'Email already used for trial. Only one trial per email.' };
    }
    if (checks[1] > 3) {
      return { allowed: false, reason: 'Too many registrations from this IP.' };
    }

    return { allowed: true };
  }
}
```

**Additional mitigations:**
- Add `trialEmail` to company metadata to enforce "one trial per email globally"
- Require email verification before trial starts
- Add Stripe Radar integration: block disposable email domains
- Implement soft rate limit: 5 new companies/hour/IP, 50/day/IP

---

## 4. 🟠 High Priority Issues

---

### HIGH-1: Feature Flag Cache Inconsistency Window

| Property | Value |
|----------|-------|
| **Document** | `feature-flag-engine.md` §7.1 |
| **Area** | Caching, Feature Flag Consistency |
| **Business Impact** | Up to 5-minute delay between plan change and feature availability enforcement |
| **Technical Impact** | Stale feature flags served after plan upgrade/downgrade |

**Issue:**

The FeatureFlagService caches resolved flags for 5 minutes (TTL: 300s). When a subscription changes (upgrade, downgrade, suspension), the cache is invalidated via `EventBus`. However, there is a race condition window:

1. Admin upgrades company from Starter → Business
2. Transaction commits, cache invalidation event published
3. The `onSubscriptionChanged` handler runs asynchronously
4. **For up to 5 minutes** (or until the event is processed), the company sees Starter features
5. Conversely, if a company is suspended: for up to 5 minutes, they still have access

**This is especially problematic for downgrades:** a company is downgraded from Business → Starter for non-payment, but for 5 minutes they can still create `inventory.batches` records that they shouldn't have access to.

**Suggested Fix:**

**Option A — Immediate Cache Invalidation (recommended):**

Publish the event **synchronously** (or use immediate in-process delivery) when the cache must be invalidated:

```typescript
async updateSubscription(companyId: string, dto: UpdateDto): Promise<SubscriptionEntity> {
  return this.prismaService.$transaction(async (tx) => {
    const updated = await this.repository.update(companyId, dto, tx);
    // Invalidate cache SYNCHRONOUSLY after transaction commits
    // Use setImmediate or afterCommit hook to avoid nested async
    setImmediate(() => this.featureFlagService.invalidateCache(companyId));
    return updated;
  });
}
```

**Option B — Decrease TTL for dynamic environments:**

Set feature flag cache TTL to 60 seconds instead of 300 seconds. Accept slightly higher database load for better consistency.

**Option C — Cache-Aside with Active Invalidation:**

Instead of TTL-based expiry, always try to read from cache. On cache miss, evaluate and store. On subscription change, proactively DELETE the cache key (not set a new TTL).

```typescript
// On subscription change: cache.delete('feature-flags:{companyId}')
// On feature check: cache.get() → if not found → evaluate → cache.set(ttl:300)
// During the 5-minute window: if cache was already deleted, next request gets fresh data
// If cache wasn't deleted yet (race), stale data serves for at most 5 minutes
```

**Recommendation:** Combine A + B. Set TTL to 60s, and invalidate synchronously via `setImmediate` after transaction commit.

---

### HIGH-2: Cron Job Overlap Hazard

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §10, `subscription-state-machine.md` §7.3 |
| **Area** | Scheduled Jobs, Concurrent Execution |
| **Business Impact** | Double invoice generation, double payment processing, duplicate emails |
| **Technical Impact** | Race conditions in cron processing without locking |

**Issue:**

Multiple cron jobs run at fixed intervals without any mechanism to prevent overlapping executions:

```typescript
@Cron('0 1 * * *')  // Daily at 01:00
async processRenewals(): Promise<void> {
  // If THIS takes > 24 hours to process 10,000 subscriptions,
  // the NEXT cron will start processing the SAME subscriptions again
}
```

**Specifically vulnerable:**

| Job | Schedule | Risk |
|-----|----------|------|
| `processRenewals` | Daily 01:00 | If processing > 24h, overlaps with next run |
| `checkRetryPayments` | Every hour | If retry logic takes > 1h for 10k failed payments |
| `processTrialExpiry` | Every hour at :30 | Same as above |
| `generateInvoices` | Daily 00:00 | Highest risk — generates invoices for thousands of subscriptions |

**Suggested Fix:**

Implement **distributed lock** for every cron job using Redis or PostgreSQL advisory lock:

```typescript
@Injectable()
export class DistributedLockService {
  constructor(private readonly redis: RedisService) {}

  async acquireLock(lockName: string, ttlSeconds: number = 300): Promise<boolean> {
    // SET NX + EX (atomic) — returns true if lock acquired
    const acquired = await this.redis.set(
      `cron-lock:${lockName}`,
      process.env.HOSTNAME ?? 'unknown',
      { nx: true, ex: ttlSeconds },
    );
    return acquired === 'OK';
  }

  async releaseLock(lockName: string): Promise<void> {
    // Only release if we own the lock
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(luaScript, 1, `cron-lock:${lockName}`, process.env.HOSTNAME);
  }
}

// Usage in cron:
@Cron('0 1 * * *')
async processRenewals(): Promise<void> {
  const lockAcquired = await this.lockService.acquireLock('renewals', 7200); // 2h TTL
  if (!lockAcquired) {
    this.logger.warn('Renewals cron: lock already held by another instance. Skipping.');
    return;
  }
  try {
    // ... process renewals ...
  } finally {
    await this.lockService.releaseLock('renewals');
  }
}
```

---

### HIGH-3: Seat Management TOCTOU

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §9.3 |
| **Area** | Seat Management, Race Conditions |
| **Business Impact | Over-limit user invitations accepted; over-billing |
| **Technical Impact | Check-then-create race condition on CompanyMember |

**Issue:**

The seat enforcement handler uses a **check-then-create** pattern:

```typescript
@OnEvent('company.member.invited')
async onMemberInvited(event: CompanyMemberInvitedEvent): Promise<void> {
  const activeUsers = await this.seatService.countActiveUsers(event.companyId);
  if (activeUsers >= subscription.plan.maxUsers) {
    throw new ForbiddenException('User limit reached');
  }
  // Time passes... 🕐
  // Another invitation is processed at the same time
  // Both checks pass (both see same count)
  // Then both users are created → 2 users added → limit exceeded
}
```

**Suggested Fix:**

**Option A — Atomic Increment Check (recommended):**

Use Prisma's atomic `update` with a condition on the plan itself:

```typescript
// Atomically increment a "usedSeats" counter on the subscription
const result = await tx.companySubscription.updateMany({
  where: {
    companyId,
    usedSeats: { lt: plan.maxUsers },  // Only update if under limit
  },
  data: {
    usedSeats: { increment: 1 },
  },
});

if (result.count === 0) {
  throw new ForbiddenException('User limit reached');
}
```

**Option B — Unique Constraint on CompanyMember:**

Add a unique constraint on `(companyId, userId)` combined with OL on CompanyMember to prevent duplicates.

**Option C — Versioned Seat Count:**

Add `seatVersion: Int` to CompanySubscription that increments on every seat change. Use optimistic locking for seat operations.

**Recommendation:** Option A is simplest and most robust. Add `usedSeats` column to `CompanySubscription`.

---

### HIGH-4: Usage Interceptor In-Transaction Overhead

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §8.4 |
| **Area** | Usage Tracking, Performance |
| **Business Impact** | Every API request incurs database write overhead for usage increment |
| **Technical Impact** | `checkQuota` + `increment` = 2 database calls per request, slowing down all business endpoints |

**Issue:**

The `UsageInterceptor` runs on **every** request that has the `usage:metric` decorator. It performs two synchronous database operations before the actual request handler:

```typescript
// IN THE INTERCEPTOR (before request handler):
await this.usageService.checkQuota(request.user.companyId, metric, increment);
await this.usageService.increment(request.user.companyId, metric, increment);
// THEN the actual request handler runs
```

For high-frequency endpoints (like `GET /api/products` with `api_calls` tracking), this adds 2 database round-trips per request. At 100,000 API calls/day (Business plan), this is 200,000 extra DB queries per day.

**Suggested Fix:**

**Option A — Asynchronous Usage Tracking:**

Move usage tracking to after the request completes:

```typescript
@Injectable()
export class UsageInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    return next.handle().pipe(
      tap(() => {
        // Increment AFTER successful response
        const request = context.switchToHttp().getRequest();
        const metric = Reflect.getMetadata('usage:metric', context.getHandler());
        if (metric) {
          // Fire-and-forget — don't block response
          this.usageService.increment(request.user.companyId, metric, increment)
            .catch(err => this.logger.error('Usage increment failed', err));
        }
      }),
    );
  }
}
```

**Option B — Batch Usage Updates:**

Buffer usage increments in-memory and flush to database every 60 seconds (or every 1000 events):

```typescript
export class UsageBufferService {
  private buffer = new Map<string, Map<string, number>>();

  increment(companyId: string, metric: string): void {
    const companyMetrics = this.buffer.get(companyId) ?? new Map();
    companyMetrics.set(metric, (companyMetrics.get(metric) ?? 0) + 1);
    this.buffer.set(companyId, companyMetrics);
  }

  @Interval(60000)
  async flush(): Promise<void> {
    // Batch update all buffered usage
    for (const [companyId, metrics] of this.buffer) {
      for (const [metric, count] of metrics) {
        await this.usageRepository.increment(companyId, metric, count);
      }
    }
    this.buffer.clear();
  }
}
```

**Recommendation:** Option A (fire-and-forget) for quota enforcement. Option B for non-critical metrics. For critical quota checks that must block if limit is reached, use a fast cache (Redis) instead of database reads.

---

### HIGH-5: No Refund Flow Design

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §6 (payment lifecycle shows REFUNDED state, but no operational flow described) |
| **Area** | Refunds, Financial Reconciliation |
| **Business Impact** | Refunds are not architecturally designed — will be ad-hoc if implemented without design |
| **Technical Impact** | Manual process required for every refund |

**Issue:**

The payment lifecycle diagram shows a `REFUNDED` state and a `SUCCEEDED → REFUNDED` transition. However, the architecture document does not define:

1. How refunds are initiated (API? Admin? Stripe Dashboard?)
2. How refunds affect the subscription (does the subscription continue? Cancel? Prorate?)
3. Partial refunds vs full refunds
4. Refund period limits (30 days? 90 days?)
5. How refunds affect invoice status (PAID → REFUNDED or PAID → PARTIALLY_REFUNDED?)
6. How refunds affect usage tracking (sales count decremented?)
7. Fee retention (Stripe charges 15¢ per refund — who pays?)
8. Currency fluctuation (refund in different exchange rate than charge)

**Suggested Fix:**

Add a complete `Refund Flow` section to `billing-architecture-v1.md`:

```typescript
// Refund states
enum RefundStatus {
  PENDING,       // Admin initiated, awaiting Stripe
  PROCESSING,    // Stripe is processing
  COMPLETED,     // Funds returned
  FAILED,        // Refund rejected (past window, insufficient balance)
  PARTIAL,       // Partial refund completed
}

// Refund business rules
1. Full refunds: allowed within 30 days of payment
2. Partial refunds: allowed at any time (prorated)
3. Refund source: Stripe balance (Stripe charges 15¢ processing fee)
4. Subscription: Full refund → immediate cancellation + downgrade to FREE
5. Subscription: Partial refund → no change to subscription
6. Invoice status: PAID → REFUNDED (full) or PAID → PARTIALLY_REFUNDED
7. Usage: Sales count NOT decremented (accounting integrity)
8. Tax: Refunds must recalculate tax liability
```

---

## 5. 🟡 Medium Issues

---

### MEDIUM-1: Outbox Publisher Concurrency

| Property | Value |
|----------|-------|
| **Document** | `stripe-integration.md` §7.4 |
| **Area** | Outbox Pattern, Eventual Consistency |
| **Business Impact** | Same outbox message processed by multiple publisher instances |
| **Technical Impact** | Duplicate event delivery if multiple instances run concurrently |

**Issue:**

The `OutboxPublisher` runs every 5 seconds and picks up pending messages:

```typescript
@Interval(5000)
async processOutbox(): Promise<void> {
  const messages = await this.prismaService.outboxMessage.findMany({
    where: { status: 'PENDING', retryCount: { lt: 5 } },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });

  for (const message of messages) {
    // Processing happens here...
    // If two instances run the same query concurrently,
    // both pick up the SAME messages
  }
}
```

In a horizontally scaled deployment with 3+ instances, all of them will pick up the same pending messages every 5 seconds. This causes:
- Duplicate event delivery
- Duplicate processing downstream
- Idempotency keys partially mitigate this, but not all handlers may be idempotent

**Suggested Fix:**

**Option A — SELECT ... FOR UPDATE SKIP LOCKED (PostgreSQL 9.5+):**

```typescript
const messages = await this.prismaService.$queryRaw<OutboxMessage[]>`
  SELECT * FROM outbox_messages
  WHERE status = 'PENDING' AND retry_count < 5
  ORDER BY created_at ASC
  LIMIT 100
  FOR UPDATE SKIP LOCKED
`;
```

This locks the selected rows so no other instance picks them up.

**Option B — Pessimistic Lock via `processedBy` column:**

Add `lockedBy VARCHAR` and `lockedAt TIMESTAMP` fields. Atomically claim messages:

```typescript
await tx.outboxMessage.updateMany({
  where: {
    status: 'PENDING',
    lockedBy: null,
  },
  data: {
    lockedBy: instanceId,
    lockedAt: new Date(),
  },
});
```

**Recommendation:** Option A (`SKIP LOCKED`) is the PostgreSQL-native solution. Use raw SQL because Prisma does not support `FOR UPDATE SKIP LOCKED`.

---

### MEDIUM-2: Webhook Idempotency Key On Transaction Rollback

| Property | Value |
|----------|-------|
| **Document** | `stripe-integration.md` §6 |
| **Area** | Idempotency, Transaction Safety |
| **Business Impact** | Double processing of the same webhook event if transaction rolls back after idempotency is stored |
| **Technical Impact** | Inconsistent state if idempotency key is stored before transaction commits |

**Issue:**

The `CheckoutSessionCompletedHandler` stores the idempotency key **inside** the same transaction as the business logic:

```typescript
await this.prismaService.$transaction(async (tx) => {
  const processed = await this.idempotencyService.get(idempotencyKey);
  if (processed) return; // ← Check inside transaction

  // Business logic...
  await this.subscriptionService.activateFromPayment(...);

  // Audit log...

  // Store idempotency
  await this.idempotencyService.set(idempotencyKey, true, { ttl: 86400 }, tx);
  // ← If any line above THROWS, the transaction rolls back, including idempotency key
  // ← Stripe retries the webhook → no idempotency found → processes AGAIN
});
```

This is actually **correct** behavior — if the transaction rolls back, we WANT to process the event again. The issue is that the **Redis** cache was set before the transaction attempted:

```typescript
async set(key, value, options, tx?) {
  // Primary: Redis (set immediately, OUTSIDE transaction)
  await this.cacheService.set(`idempotent:${key}`, value, { ttl });
  // Fallback: Database (inside transaction — ROLLS BACK on failure)
  // ...
}
```

If the transaction rolls back, the Redis cache still has the idempotency key. The next webhook attempt will hit the Redis cache and skip processing — **but the business logic was rolled back**.

**Impact:** Lost event. Stripe thinks the webhook was processed (it gets a `200 OK` or cached response), but the local database was rolled back.

**Suggested Fix:**

**Do not store idempotency in Redis before the transaction commits.** Only store it after the transaction succeeds:

```typescript
async handleCheckoutSession(event): Promise<void> {
  // Check Redis first (fast path — existing idempotency)
  const cached = await this.idempotencyService.getFromCache(key);
  if (cached) return;

  // Process in transaction
  let transactionSucceeded = false;
  try {
    await this.prismaService.$transaction(async (tx) => {
      // ... business logic ...
      // Store idempotency ONLY in database (will roll back with transaction)
      await this.idempotencyService.setInDatabase(key, true, tx);
    });
    transactionSucceeded = true;
  } finally {
    // Store in Redis ONLY after successful transaction commit
    if (transactionSucceeded) {
      await this.cacheService.set(`idempotent:${key}`, true, { ttl: 86400 });
    }
  }
}
```

---

### MEDIUM-3: Missing Tax Calculation Logic

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §1.2, `stripe-integration.md` §12 |
| **Area** | Tax/VAT Architecture |
| **Business Impact** | Incorrect tax calculation across jurisdictions; legal liability |
| **Technical Impact** | No tax calculation logic defined — relies entirely on Stripe Tax |

**Issue:**

The architecture relies entirely on Stripe Tax for VAT/GST calculation. This is acceptable for Stripe-supported countries, but there are gaps:

1. **Stripe Tax has limited country coverage** — not all countries where StockFlow operates (e.g., Kazakhstan) are supported
2. **No fallback for manual tax rates** — if Stripe tax is unavailable, the system has no way to calculate tax
3. **Tax reporting is not designed** — how is tax liability reported? No architecture for tax reports
4. **Reverse charge rules** — B2B transactions in EU may be reverse-charged (no VAT). The architecture does not handle this
5. **Digital services tax** — Different rules for digital goods vs physical goods
6. **Tax exemption** — No mechanism for tax-exempt customers (charities, government)
7. **Tax rounding** — Rounding rules vary by jurisdiction. Stripe handles this, but local records need matching

**Suggested Fix:**

Create a `TaxService` abstraction with fallback logic:

```typescript
interface TaxService {
  calculateTax(params: {
    companyCountry: string;
    customerCountry: string;
    amount: Decimal;
    productType: 'digital' | 'physical' | 'service';
    customerTaxId?: string;   // For reverse charge check
  }): Promise<TaxResult>;
}

// Fallback chain:
// 1. Stripe Tax (if country supported)
// 2. Manual tax rate from db (if configured for country)
// 3. Default tax rate from plan config
// 4. 0% (explicitly — never undefined)
```

---

### MEDIUM-4: No Audit Trail for Idempotency Store Deletion

| Property | Value |
|----------|-------|
| **Document** | `stripe-integration.md` §6.2 |
| **Area** | Idempotency, Auditing |
| **Business Impact** | If an idempotency key is deleted (admin error, bug, data loss), financial events could be re-processed |
| **Technical Impact** | No recovery path for accidentally deleted idempotency records |

**Issue:**

The `IdempotencyService.delete()` method silently removes idempotency records without auditing:

```typescript
async delete(key: string): Promise<void> {
  await this.cacheService.del(`idempotent:${key}`);
  await this.prismaService.idempotencyRecord.deleteMany({ where: { key } });
}
```

If this is called (or if a bug/Redis flush deletes keys), there is no audit trail of which keys were deleted or when.

**Suggested Fix:**

Add audit logging to idempotency deletion:

```typescript
async delete(key: string, context?: { userId?: string; reason?: string }): Promise<void> {
  // Read existing record before deletion
  const existing = await this.prismaService.idempotencyRecord.findUnique({ where: { key } });

  await this.cacheService.del(`idempotent:${key}`);
  await this.prismaService.idempotencyRecord.deleteMany({ where: { key } });

  // Audit the deletion
  await this.auditLog.log({
    action: 'IDEMPOTENCY_KEY_DELETED',
    entityType: 'IdempotencyRecord',
    entityId: key,
    details: {
      key,
      previousValue: existing?.value,
      reason: context?.reason ?? 'manual deletion',
      userId: context?.userId,
    },
  });
}
```

---

### MEDIUM-5: No Webhook Replay Validation

| Property | Value |
|----------|-------|
| **Document** | `stripe-integration.md` §9.2 |
| **Area** | Webhook Recovery |
| **Business Impact** | Admin can replay any webhook event without validation, potentially causing double-processing |
| **Technical Impact** | Admin tool for recovery has no safety checks |

**Issue:**

The `BillingRecoveryService.recoverEvent()` method allows any webhook event to be replayed:

```typescript
async recoverEvent(eventId: string): Promise<void> {
  const event = await this.stripeProvider.retrieveEvent(eventId); // Fetch from Stripe
  const idempotencyKey = `stripe-webhook:${event.id}`;
  const existing = await this.idempotencyService.get(idempotencyKey);
  if (existing) throw new ConflictException('Event already processed');
  // Process event — NO validation on event age or type
}
```

An admin could:
1. Replay a 6-month-old `invoice.paid` event — applying a payment that was already refunded
2. Replay a `checkout.session.completed` event from a session that was later voided
3. Replay events out of order (e.g., process `customer.subscription.deleted` before `invoice.paid`)

**Suggested Fix:**

Add validation constraints to event recovery:

```typescript
const ALLOWED_RECOVERY_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
]);

const MAX_EVENT_AGE_HOURS = 72; // Only replay events from last 72 hours

async recoverEvent(eventId: string): Promise<void> {
  const event = await this.stripeProvider.retrieveEvent(eventId);

  // Validate event type
  if (!ALLOWED_RECOVERY_EVENTS.has(event.type)) {
    throw new BadRequestException(`Cannot recover event type: ${event.type}`);
  }

  // Validate event age
  const ageHours = (Date.now() - event.created.getTime()) / 3600000;
  if (ageHours > MAX_EVENT_AGE_HOURS) {
    throw new BadRequestException(`Event too old (${Math.round(ageHours)}h). Max: ${MAX_EVENT_AGE_HOURS}h`);
  }

  // ... proceed with recovery
}
```

---

## 6. 🟢 Low Issues & Observations

---

### LOW-1: Annual Discount Calculation Ambiguity

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §1.2 |
| **Area** | Pricing Model |

The statement "2 months free when paying annually" is ambiguous:

- Starter: $29/month × 12 = $348. "2 months free" could mean $29 × 10 = $290 (matches the table). Better to explicitly state the formula: `Starter Annual = $29 × 10 = $290`.
- **Recommendation:** Define `ISubscriptionPlan.annualMultiplier` (value: 10) instead of hardcoding discounts.

---

### LOW-2: Payment State Diagram Missing DISPUTED → REFUNDED

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §6 |
| **Area** | Payment Lifecycle |

The diagram shows `SUCCEEDED → DISPUTED` but there's no transition from `DISPUTED → REFUNDED`. If a dispute is resolved in the merchant's favor, the payment should return to `SUCCEEDED`. If resolved in the customer's favor, it should go to `REFUNDED`.

**Recommendation:** Add `DISPUTED → SUCCEEDED` (merchant wins) and `DISPUTED → REFUNDED` (customer wins) transitions.

---

### LOW-3: Subscription Plan has `stripeMonthlyPriceId` / `stripeYearlyPriceId` — Not Future-Proof

| Property | Value |
|----------|-------|
| **Document** | `billing-architecture-v1.md` §4 |
| **Area** | Data Model |

If a second payment provider is added (PayPal, Kaspi), the model would need `paypalMonthlyPriceId`, `paypalYearlyPriceId`. This doesn't scale.

**Recommendation:** Use a `ProviderPrice` junction table:

```
SubscriptionPlan ──→ ProviderPrice (N) ──→ PaymentProvider (1)
  where ProviderPrice { provider, priceId, interval, planId }
```

Or, use a JSON field `providerPrices: { stripe: { monthly: 'price_xxx', yearly: 'price_yyy' }, paypal: { ... } }`.

---

## 7. False Positives

During the review, several potential concerns were evaluated and **determined to be correctly handled**:

| Concern | Why It's a False Positive |
|---------|--------------------------|
| **Customer data leaked via Stripe Checkout** | ✅ StockFlow never handles card data. Stripe Checkout is SAQ A compliant. |
| **Double charge on retry** | ✅ Idempotency keys prevent duplicate Stripe charges. |
| **Invoice generation for cancelled subscriptions** | ✅ `findExpiringToday()` should filter `status: 'ACTIVE'` — verify this in implementation. |
| **Cache poisoning via Redis injection** | ✅ Cache keys are parameterized with safe values (companyId as UUID). |
| **Event handler infinite loop** | ✅ EventBus doesn't allow handlers to publish events (per ADR-002). |
| **Race: upgrade + downgrade simultaneously** | ✅ Optimistic locking via `rowVersion` ensures only one wins. |
| **Stripe webhook spoofing** | ✅ Signature verification uses `stripe.webhooks.constructEvent()` with secret. |
| **Free plan exceeds Starter limits** | ✅ Explicit plan configuration prevents this. |

---

## 8. Cross-Cutting Concerns

### 8.1 Architecture Freeze vs Billing Module

The `architecture-freeze-v1.md` declares the architecture frozen, but the billing module adds new concepts that aren't covered by the freeze:

| New Concept | Conflict |
|-------------|----------|
| `FeatureFlagGuard` | Not mentioned in freeze document; bypasses standard RBAC |
| `DistributedLockService` | New infrastructure not defined in freeze |
| `OutboxMessage` model | New immutable model not listed in freeze's immutable models table |
| `SeatService` | Cross-module: checks `CompanyMember` from `CompanySubscription` |

**Recommendation:** Update the freeze document to explicitly list the new billing module components and their architectural status.

### 8.2 Compatibility Policy Event Versioning vs Current InMemoryEventBus

The `compatibility-policy.md` defines `sale.completed.v1` versioned event names. However, the current `InMemoryEventBus` doesn't support versioned subscription — a handler subscribed to `sale.completed.v1` would still receive all `sale.completed` events (regardless of version suffix). The event bus implementation must be updated to filter by exact event name match, including the version suffix.

### 8.3 Feature Flag Engine Cross-Reference to Compatibility Policy

The `compatibility-policy.md` says "Adding a new optional field to DTO is backward compatible." The `feature-flag-engine.md` defines feature flags that can **disable** entire API endpoints. This creates an interesting tension: an endpoint is technically available (compatible API), but access is denied via feature flag. This should be documented as a compatibility exception.

---

## 9. Final Architecture Maturity Assessment

### Overall: 8.2/10

| Category | Score | Status |
|----------|-------|--------|
| Architecture Design | 8.5/10 | ✅ Solid enterprise design with clear patterns |
| Production Readiness | 7.5/10 | ⚠️ Needs cron locking, invoice sequence fix, tax design |
| Security | 8.5/10 | ✅ Webhook verification, PCI compliance, RBAC |
| Scalability | 8.0/10 | ⚠️ Feature flag cache TTL, outbox publisher concurrency |
| Reliability | 7.5/10 | ⚠️ Cron overlap, idempotency race in Redis, no trial abuse prevention |
| Maintainability | 9.0/10 | ✅ Clear module structure, documented architecture, extension points |
| Event Consistency | 8.0/10 | ✅ Outbox pattern designed but not yet stress-tested |

### Top 5 Recommended Fixes (Implementation Priority)

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| 1 | **Invoice numbering:** Replace daily-reset sequence with PostgreSQL sequence | 2h | Eliminates race condition on invoice generation |
| 2 | **Cron locking:** Add distributed lock to all cron jobs | 4h | Prevents overlapping executions |
| 3 | **Trial abuse:** Add email/IP-based trial deduplication | 8h | Prevents free tier abuse |
| 4 | **Feature flag cache:** Decrease TTL to 60s + synchronous invalidation | 4h | Reduces inconsistency window from 5min to ~1min |
| 5 | **Idempotency Redis race:** Fix Redis storage after transaction commit only | 3h | Eliminates lost-event risk |

### Design Maturity by Module

| Module | Score | Strengths | Weaknesses |
|--------|-------|-----------|------------|
| Billing Architecture | 8.5/10 | Complete lifecycle, multi-tenant, payment abstraction | Missing refund flow, tax calculation |
| Subscription State Machine | 9.0/10 | 17 transitions, guards, side effects, concurrency coverage | Trial abuse not addressed |
| Feature Flag Engine | 8.0/10 | 4-level evaluation, registry, cache design | Cache inconsistency window, quota overhead |
| Stripe Integration | 8.5/10 | Provider abstraction, outbox, idempotency, recovery | Idempotency Redis race, webhook replay validation |
| Architecture Freeze | 9.0/10 | Comprehensive freeze, module contracts, review checklist | Missing billing module in freeze document |
| Compatibility Policy | 9.0/10 | DTO, migration, event, RBAC, response compatibility | Event versioning mismatch with current EventBus |

**Bottom line:** The architecture is well-designed and production-capable. The critical and high-priority issues identified should be resolved **before** implementation begins, but none are showstoppers — they are refinements that would be harder to fix after the code is written.
