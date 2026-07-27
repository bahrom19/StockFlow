# 🚀 StockFlow Enterprise — Phase 7.1 SaaS Implementation Plan

**Date:** July 26, 2026  
**Dependency:** Phase 7.0.1 Architecture Compliance (85.5% → 95% compliance after fixes)

---

## State After Compliance Fixes

### Compliance Scores (Post-Fix)

| Category | Pre-Fix | Post-Fix | Status |
|----------|---------|----------|--------|
| Repository Pattern | 8/10 | 9/10 | ✅ Improved |
| Transaction Ownership | 9.5/10 | 9.5/10 | ✅ Stable |
| EventBus Contracts | 10/10 | 10/10 | ✅ Stable |
| DTO Compatibility | 9/10 | 9/10 | ✅ Stable |
| RBAC Protection | 7/10 | 9.5/10 | ✅ Fixed |
| Audit Logging | 7/10 | 8/10 | ✅ Improved |
| Multi-Tenancy Isolation | 10/10 | 10/10 | ✅ Stable |
| Optimistic Locking | 6/10 | 9/10 | ✅ Fixed |
| API Response Envelope | 9/10 | 9/10 | ✅ Stable |
| Dependency Rules | 10/10 | 10/10 | ✅ Stable |

**Overall Compliance: 93.5%** (up from 85.5%)
**Production Readiness: 7.5/10** (up from 7/10)

### Violations Fixed

| # | Fix | Status |
|---|-----|--------|
| V1 | RolesGuard on SuppliersController + UsersController | ✅ Fixed |
| V2 | Optimistic locking in 4 repositories (Products, Users, PurchaseOrder, Roles) | ✅ Fixed |
| V3 | Audit logging in UsersService (update + softDelete) | ✅ Fixed |
| V4 | Standardized RBAC pattern in 8 CRM controllers | ✅ Fixed |
| V5 | Added rowVersion to User and Role Prisma models | ✅ Fixed |
| V7 | PurchaseOrder TOCTOU → updateMany pattern | ✅ Fixed |

### Remaining Issues (Carry-over to Phase 7.6)

| # | Issue | Priority | Effort |
|---|-------|----------|--------|
| V8 | ProductsService `as any` → `Record<string, unknown>` | Low | 5 min |
| V9 | Missing `@ApiBearerAuth()` on CRM controllers | Low | 10 min |
| V10 | UsersService.create() missing audit log + transaction | Medium | 20 min |

---

## Phase 7.1 Implementation Priority

### Week 1 — Database & Foundation

| Day | Task | Effort | Dependencies |
|-----|------|--------|-------------|
| 1 | Generate Prisma migration for `rowVersion` on User + Role | 10 min | Schema changes from Phase 7.0.1 |
| 1 | Deploy migration to staging | 10 min | Migration file |
| 1-2 | Create `SubscriptionPlan` Prisma model | 30 min | None |
| 1-2 | Create `CompanySubscription` Prisma model | 30 min | SubscriptionPlan |
| 1-2 | Create `FeatureFlag` + `PlanFeatureOverride` models | 20 min | SubscriptionPlan |
| 1-2 | Create `UsageRecord` Prisma model | 10 min | None |
| 1-2 | Create `Invoice` + `InvoiceLine` models | 20 min | CompanySubscription |
| 3 | Run and verify migration | 15 min | All models |
| 3 | Seed default plans (Free, Starter, Business, Enterprise) | 30 min | Plan models |
| 3 | Seed default feature flags | 20 min | FeatureFlag model |

### Week 1 — Module Scaffolding

| Day | Task | Effort | Dependencies |
|-----|------|--------|-------------|
| 3 | Create `BillingModule` with base structure | 20 min | Phase 7.1 models |
| 3 | Create `SubscriptionPlanService` (CRUD) | 45 min | BillingModule |
| 3 | Create `SubscriptionPlanController` + DTOs + Mapper | 30 min | SubscriptionPlanService |
| 4 | Create `CompanySubscriptionService` (create/upgrade/downgrade) | 1 hr | SubscriptionPlan |
| 4 | Create `CompanySubscriptionController` + DTOs | 30 min | CompanySubscriptionService |
| 4 | Create `FeatureFlagService` (evaluation engine) | 45 min | FeatureFlag model |
| 5 | Create `BillingService` (invoice generation, period end) | 1 hr | CompanySubscription |
| 5 | Create `InvoiceController` + DTOs | 30 min | BillingService |
| 5 | Create `UsageTrackingService` | 30 min | UsageRecord model |

### Week 2 — Billing Integration

| Day | Task | Effort | Dependencies |
|-----|------|--------|-------------|
| 6 | Implement FeatureFlag evaluation — plan-to-feature resolution | 1 hr | FeatureFlagService |
| 6 | Add `@RequireFeature('feature_code')` decorator (optional) | 30 min | FeatureFlagService |
| 6 | Implement usage tracking via EventBus subscription | 1 hr | UsageTrackingService |
| 7 | Create Stripe webhook controller + signature verification | 1.5 hr | CompanySubscriptionService |
| 7 | Create Stripe webhook → subscription state machine | 2 hr | Webhook controller |
| 8 | Implement trial → auto-downgrade at expiry (cron job) | 1 hr | CompanySubscription |
| 8 | Implement subscription expiry checks | 30 min | CompanySubscription |
| 8 | Add `onModuleInit` sync of active subscriptions | 30 min | Stripe integration |

### Week 2 — Testing & Verification

| Day | Task | Effort | Dependencies |
|-----|------|--------|-------------|
| 9 | Unit tests: SubscriptionPlanService | 45 min | Implementation |
| 9 | Unit tests: CompanySubscriptionService | 45 min | Implementation |
| 9 | Unit tests: FeatureFlagService | 30 min | Implementation |
| 9 | Unit tests: BillingService | 30 min | Implementation |
| 9 | Unit tests: UsageTrackingService | 20 min | Implementation |
| 10 | Unit tests: Stripe webhook handling | 1 hr | Implementation |
| 10 | Integration tests: subscription lifecycle (trial → active → expired) | 1 hr | Implementation |
| 10 | Integration tests: feature flag resolution per plan | 30 min | Implementation |
| 10 | Integration tests: invoice generation | 30 min | Implementation |
| 10 | Run full build + lint + test suite | 15 min | All tests |

---

## Prisma Models Checklist

- [ ] `SubscriptionPlan` — id, name, code, tier, isActive, isPublic, sortOrder, priceMonthly, priceAnnual, currency, maxUsers, maxWarehouses, maxProducts, maxCustomers, maxSalesMonth, storageMB, featureFlags, rowVersion, timestamps
- [ ] `CompanySubscription` — id, companyId, planId, status, trialStartedAt, trialEndsAt, billingInterval, currentPeriodStart, currentPeriodEnd, cancelledAt, provider, providerSubscriptionId, providerCustomerId, rowVersion, timestamps
- [ ] `FeatureFlag` — id, code (unique), name, description, defaultValue, module, isPremium, isActive, rowVersion, timestamps
- [ ] `PlanFeatureOverride` — id, planId, featureFlagId, enabled, timestamps
- [ ] `UsageRecord` — id, companyId, metric, value, recordedAt
- [ ] `Invoice` — id, companyId, subscriptionId, invoiceNumber, status, amount, currency, taxAmount, totalAmount, billingPeriodStart, billingPeriodEnd, issuedAt, dueAt, paidAt, paidAmount, providerInvoiceId, rowVersion, timestamps
- [ ] `InvoiceLine` — id, invoiceId, description, quantity, unitPrice, amount, taxPercent, taxAmount, timestamps

---

## Module Structure to Create

```
modules/
  billing/
    controllers/
      subscription-plan.controller.ts
      company-subscription.controller.ts
      invoice.controller.ts
      billing-webhook.controller.ts
    services/
      subscription-plan.service.ts
      company-subscription.service.ts
      feature-flag.service.ts
      billing.service.ts
      usage-tracking.service.ts
    repositories/
      subscription-plan.repository.ts
      company-subscription.repository.ts
      invoice.repository.ts
      usage-record.repository.ts
    dto/
      create-subscription-plan.dto.ts
      update-subscription-plan.dto.ts
      create-subscription.dto.ts
      invoice-query.dto.ts
    entities/
      subscription-plan.entity.ts
      company-subscription.entity.ts
      invoice.entity.ts
    mappers/
      subscription-plan.mapper.ts
      company-subscription.mapper.ts
      invoice.mapper.ts
    events/
      plan-changed.event.ts
    billing.module.ts
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stripe webhook integration complexity | Medium | Start with manual billing (admin creates invoices), add Stripe in Phase 7.2 |
| Feature flag performance overhead | Low | Cache feature flags per company with 5-min TTL |
| Migration rollback needed | Low | All new tables — no existing schema changes beyond rowVersion |
| Seed data conflicts | Low | Use upsert for seed plans — idempotent |
| Missing permissions for billing endpoints | Low | Add `billing:*` permissions to RBAC seed data |

---

## Success Criteria for Phase 7.1

- [ ] New SubscriptionPlan, CompanySubscription, FeatureFlag, Invoice, UsageRecord models exist in Prisma schema
- [ ] Migration runs successfully
- [ ] SubscriptionPlan CRUD works with full RBAC
- [ ] CompanySubscription create/upgrade/downgrade/cancel works
- [ ] FeatureFlagService correctly resolves feature availability per plan
- [ ] Trial accounts auto-downgrade to Free plan after expiry
- [ ] Invoices are generated at period end
- [ ] Usage metrics are recorded
- [ ] Stripe webhook creates/updates subscriptions
- [ ] All endpoints have JwtAuthGuard + RolesGuard + @RequirePermission()
- [ ] All repositories have correct OL + tx propagation
- [ ] All mutations create audit logs inside transactions
- [ ] Full test suite passes
- [ ] Build passes with zero errors
- [ ] ≥80% test coverage on billing module
