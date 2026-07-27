# 🚀 StockFlow Enterprise — Phase 7: SaaS Product Layer

**Author:** Principal Software Architect  
**Date:** July 26, 2026  
**Status:** Planning — Ready for implementation  
**Dependency:** Phase 6.1 Production Blockers (Completed)

---

## Executive Summary

Phase 7 transitions StockFlow from a feature-complete backend into a commercially viable SaaS platform. The backend architecture is frozen at 6.5/10 production readiness after Phase 6.1. No further low-level refactoring is required — Phase 7 builds the SaaS product layer on top of the existing foundation.

**Key deliverables:**
1. SaaS Platform (subscriptions, billing, plans, feature flags, usage tracking)
2. Operations Dashboard (admin UI foundation + API)
3. AI Assistant Architecture (design + ML infrastructure)
4. API consistency improvements for mobile and web clients
5. Infrastructure hardening for cloud deployment

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [SaaS Platform Architecture](#2-saas-platform-architecture)
3. [Operations Dashboard](#3-operations-dashboard)
4. [AI Assistant Architecture](#4-ai-assistant-architecture)
5. [Mobile/Web API Readiness](#5-mobileweb-api-readiness)
6. [Infrastructure & Deployment](#6-infrastructure--deployment)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Risk Assessment](#8-risk-assessment)
9. [Success Criteria](#9-success-criteria)

---

## 1. Current State Assessment

### 1.1 What Already Exists

| Component | Status | Details |
|-----------|--------|---------|
| **Multi-tenancy** | ✅ Complete | `companyId` isolation in every repository. `CompanyMember`, `UserRole`, `Role`, `Permission` models exist. |
| **Company model** | ⚠️ Partial | Has `subscriptionPlan`, `subscriptionExpiresAt`, `status` (ACTIVE/SUSPENDED/DELETED) — but no plan management. |
| **RBAC** | ✅ Complete | JwtAuthGuard, RolesGuard, @RequirePermission(), dynamic role loading from DB. |
| **Audit Log** | ✅ Complete | `AuditLog` model, all mutations logged. |
| **Health checks** | ✅ Complete | `/api/health`, `/api/health/live`, `/api/health/ready`, `/api/health/metrics`. |
| **OpenTelemetry** | ✅ Complete | `initTracing()`, auto-instrumentation via opentelemetry-instrumentation-http, @prisma/instrumentation. |
| **Prometheus** | ✅ Complete | 14 metric types, `/api/health/metrics` endpoint. |
| **Rate limiting** | ✅ Complete | `@nestjs/throttler` with short/medium/long tiers. |
| **CI/CD** | ✅ Complete | 12-stage pipeline, Docker multi-stage build, security audit, madge circular dep check. |
| **EventBus** | ✅ Complete | InMemoryEventBus with subscription registry, context propagation. |
| **Cache** | ⚠️ Dead code | `CacheService` created but not injected anywhere. |
| **Account Lockout** | ✅ Complete | `failedLoginAttempts`, `lockedUntil`, configurable thresholds. |
| **Optimistic Locking** | ⚠️ Partial | Applied to Sales, Customers, Suppliers, Finance. Missing in Users, Products, remaining models. |

### 1.2 What Needs to Be Built

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|-------------|
| Subscription Plans CRUD | Critical | Medium | Company model |
| Billing integration (connector) | Critical | Large | Subscription Plans, Payment gateway |
| Feature Flags engine | High | Medium | RBAC |
| Usage tracking & statistics | High | Large | EventBus, Queue |
| License management | Medium | Small | Feature Flags |
| Trial accounts | Medium | Small | Subscription Plans |
| Tenant administration portal | High | Large | Operations Dashboard |
| Operations Dashboard API | High | Medium | Health, Metrics |
| AI Assistant infrastructure | High | Large | External LLM API |
| AI Forecasting engine | Medium | Large | AI infrastructure |
| API response envelope | Medium | Small | All controllers |
| Mobile pagination consistency | Medium | Small | All repositories |
| Web client compatibility | Low | Medium | API review |

---

## 2. SaaS Platform Architecture

### 2.1 Business Model

```
┌─────────────────────────────────────────────────────────────┐
│                    SaaS Business Model                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Plans: Free → Starter → Business → Enterprise              │
│                                                             │
│  Billing: Monthly / Annual / Prepaid                        │
│                                                             │
│  Pricing model: Per-company, per-seat optional              │
│                                                             │
│  Trial: 14-day full-feature trial → auto-downgrade          │
│                                                             │
│  Payment methods: Stripe / PayPal / Kaspi (KZ)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Database Models (Prisma Additions)

#### 2.2.1 Subscription Plan

```prisma
enum BillingInterval {
  MONTHLY
  ANNUAL
  PREPAID
}

enum PlanTier {
  FREE
  STARTER
  BUSINESS
  ENTERPRISE
}

model SubscriptionPlan {
  id              String           @id @default(uuid()) @db.Uuid
  name            String           @db.VarChar(255)
  code            String           @unique @db.VarChar(100)
  description     String?          @db.Text
  tier            PlanTier         @default(FREE)
  isActive        Boolean          @default(true)
  isPublic        Boolean          @default(true)
  sortOrder       Int              @default(0)

  // Pricing
  priceMonthly    Decimal          @default(0) @db.Decimal(18, 4)
  priceAnnual     Decimal          @default(0) @db.Decimal(18, 4)
  currency        Currency         @default(USD)

  // Limits
  maxUsers        Int              @default(1)
  maxWarehouses   Int              @default(1)
  maxProducts     Int              @default(100)
  maxCustomers    Int              @default(50)
  maxSalesMonth   Int              @default(500)
  storageMB       Int              @default(100)

  // Features
  featureFlags    Json             @default("{}")

  // Metadata
  rowVersion      Int              @default(0)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  deletedAt       DateTime?
  subscriptions   CompanySubscription[]

  @@index([tier])
  @@index([isActive])
  @@index([sortOrder])
  @@index([deletedAt])
}
```

#### 2.2.2 Company Subscription

```prisma
enum SubscriptionStatus {
  ACTIVE
  TRIAL
  EXPIRED
  CANCELLED
  SUSPENDED
  PENDING
}

model CompanySubscription {
  id              String             @id @default(uuid()) @db.Uuid
  companyId       String             @unique @db.Uuid
  planId          String             @db.Uuid
  status          SubscriptionStatus @default(TRIAL)

  // Trial
  trialStartedAt  DateTime           @default(now())
  trialEndsAt     DateTime?

  // Billing
  billingInterval BillingInterval    @default(MONTHLY)
  currentPeriodStart DateTime        @default(now())
  currentPeriodEnd   DateTime?
  cancelledAt     DateTime?
  cancellationReason String?         @db.Text

  // Payment provider
  provider        String?            @db.VarChar(50)    // "stripe" | "paypal" | "kaspi"
  providerSubscriptionId String?     @db.VarChar(255)
  providerCustomerId    String?      @db.VarChar(255)

  // Usage snapshot
  currentUsers    Int                @default(1)
  currentStorageMB Int               @default(0)

  rowVersion      Int                @default(0)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  company         Company            @relation(fields: [companyId], references: [id], onDelete: Cascade)
  plan            SubscriptionPlan   @relation(fields: [planId], references: [id])

  @@index([companyId])
  @@index([planId])
  @@index([status])
  @@index([provider])
  @@index([providerSubscriptionId])
  @@index([currentPeriodEnd])
  @@index([trialEndsAt])
}
```

#### 2.2.3 Feature Flags

```prisma
model FeatureFlag {
  id              String    @id @default(uuid()) @db.Uuid
  code            String    @unique @db.VarChar(100)
  name            String    @db.VarChar(255)
  description     String?   @db.Text
  defaultValue    Boolean   @default(false)
  module          String    @db.VarChar(100)
  isPremium       Boolean   @default(false)
  isActive        Boolean   @default(true)
  rowVersion      Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  planOverrides   PlanFeatureOverride[]

  @@index([module])
  @@index([isActive])
  @@index([code])
}

model PlanFeatureOverride {
  id              String         @id @default(uuid()) @db.Uuid
  planId          String         @db.Uuid
  featureFlagId   String         @db.Uuid
  enabled         Boolean        @default(false)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  plan            SubscriptionPlan  @relation(fields: [planId], references: [id], onDelete: Cascade)
  featureFlag     FeatureFlag       @relation(fields: [featureFlagId], references: [id], onDelete: Cascade)

  @@unique([planId, featureFlagId])
  @@index([planId])
  @@index([featureFlagId])
}
```

#### 2.2.4 Usage Records

```prisma
model UsageRecord {
  id              String    @id @default(uuid()) @db.Uuid
  companyId       String    @db.Uuid
  metric          String    @db.VarChar(100)   // "sales_month", "storage_mb", "api_calls"
  value           Int       @default(0)
  recordedAt      DateTime  @default(now())
  company         Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([metric])
  @@index([recordedAt])
  @@index([companyId, metric, recordedAt])
}
```

#### 2.2.5 Invoices & Billing

```prisma
enum InvoiceStatus {
  DRAFT
  PENDING
  PAID
  OVERDUE
  CANCELLED
  REFUNDED
}

model Invoice {
  id              String         @id @default(uuid()) @db.Uuid
  companyId       String         @db.Uuid
  subscriptionId  String         @db.Uuid
  invoiceNumber   String         @unique @db.VarChar(100)

  status          InvoiceStatus  @default(DRAFT)
  amount          Decimal        @db.Decimal(18, 4)
  currency        Currency       @default(USD)
  taxAmount       Decimal        @default(0) @db.Decimal(18, 4)
  totalAmount     Decimal        @db.Decimal(18, 4)

  billingPeriodStart DateTime
  billingPeriodEnd   DateTime
  issuedAt        DateTime       @default(now())
  dueAt           DateTime
  paidAt          DateTime?
  paidAmount      Decimal?       @db.Decimal(18, 4)

  providerInvoiceId String?      @db.VarChar(255)
  providerUrl       String?      @db.Text

  notes           String?        @db.Text
  rowVersion      Int            @default(0)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  company         Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  subscription    CompanySubscription @relation(fields: [subscriptionId], references: [id])
  lines           InvoiceLine[]

  @@index([companyId])
  @@index([subscriptionId])
  @@index([status])
  @@index([dueAt])
  @@index([invoiceNumber])
  @@index([companyId, status])
  @@index([companyId, createdAt])
}

model InvoiceLine {
  id              String    @id @default(uuid()) @db.Uuid
  invoiceId       String    @db.Uuid
  description     String    @db.VarChar(500)
  quantity        Int       @default(1)
  unitPrice       Decimal   @db.Decimal(18, 4)
  amount          Decimal   @db.Decimal(18, 4)
  taxPercent      Decimal?  @db.Decimal(5, 2)
  taxAmount       Decimal?  @db.Decimal(18, 4)
  createdAt       DateTime  @default(now())
  invoice         Invoice   @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}
```

### 2.3 Module Structure

```
modules/
  billing/
    controllers/
      subscription-plan.controller.ts    # CRUD plans (admin only)
      company-subscription.controller.ts # Company subscription management
      invoice.controller.ts              # Invoice management
      billing-webhook.controller.ts      # Payment provider webhooks
    services/
      subscription.service.ts            # Plan management
      billing.service.ts                 # Invoice generation, payment processing
      usage-tracking.service.ts          # Usage metrics collection
      feature-flag.service.ts            # Feature flag evaluation
    repositories/
      subscription-plan.repository.ts
      company-subscription.repository.ts
      invoice.repository.ts
      usage-record.repository.ts
    dto/
      create-plan.dto.ts
      update-plan.dto.ts
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
    billing.module.ts
```

### 2.4 Feature Flag Resolution

```typescript
// Pseudocode for feature flag resolution
class FeatureFlagService {
  isFeatureEnabled(companyId: string, featureCode: string): boolean {
    // 1. Check plan default
    // 2. Check plan override
    // 3. Check company override (for enterprise)
    // 4. Cache result
  }

  getEnabledFeatures(companyId: string): FeatureFlag[] {
    // Return all enabled features for a company
  }

  @OnEvent('company.subscription.changed')
  invalidateCache(companyId: string): void {
    // Clear cached feature flags
  }
}
```

### 2.5 Usage Tracking

```typescript
// Decorator-based usage tracking
@TrackUsage('api_calls')
@UseGuards(JwtAuthGuard)
async getSales(query: SalesQueryDto): Promise<PaginatedResult<SaleEntity>> {
  // ...
}

// Event-based usage tracking
@OnEvent('sale.completed')
async trackSalesUsage(event: SaleCompletedEvent): void {
  await this.usageTrackingService.increment(event.companyId, 'sales_month');
}

// Scheduled reset at period end
@Cron(CronExpression.CRON_EVERY_DAY_AT_MIDNIGHT)
async resetMonthlyUsage(): Promise<void> {
  // Reset monthly counters for all companies
}
```

---

## 3. Operations Dashboard

### 3.1 Architecture

The Operations Dashboard is a **read-only** admin layer — maintains the existing CQRS-read pattern used in Reports. No mutations occur through the dashboard.

```
┌──────────────────────────────────────┐
│         Operations Dashboard          │
│          (API Layer Only)             │
├──────────────────────────────────────┤
│                                      │
│  DashboardController                 │
│                                      │
│  System Section                      │
│  ├── Health Overview                 │
│  ├── Queue Depth                     │
│  ├── Redis Memory                    │
│  ├── PostgreSQL Connections          │
│  └── Error Rate                      │
│                                      │
│  Companies Section                   │
│  ├── Active / Trial / Expired        │
│  ├── Recent Registrations            │
│  ├── Top by Usage                    │
│  └── Suspended / Blocked             │
│                                      │
│  Revenue Section                     │
│  ├── MRR / ARR                       │
│  ├── Active Subscriptions            │
│  ├── Churn Rate                      │
│  └── Revenue by Plan                 │
│                                      │
│  Technical Section                   │
│  ├── API Latency (p50, p95, p99)     │
│  ├── Error Rate by Endpoint          │
│  ├── Background Jobs Status          │
│  └── Deployment History              │
│                                      │
└──────────────────────────────────────┘
```

### 3.2 Dashboard API Endpoints

| Method | Path | Description | Permissions |
|--------|------|-------------|-------------|
| GET | `admin/dashboard/summary` | High-level system overview | `admin:dashboard` |
| GET | `admin/dashboard/health` | Full health breakdown | `admin:dashboard` |
| GET | `admin/dashboard/companies` | Company analytics | `admin:dashboard` |
| GET | `admin/dashboard/revenue` | Revenue analytics | `admin:dashboard` |
| GET | `admin/dashboard/api-usage` | API usage analytics | `admin:dashboard` |
| GET | `admin/companies` | List all companies | `admin:companies:read` |
| GET | `admin/companies/:id` | Company details | `admin:companies:read` |
| PATCH | `admin/companies/:id/status` | Suspend/activate company | `admin:companies:update` |
| GET | `admin/companies/:id/usage` | Company usage details | `admin:companies:read` |
| GET | `admin/audit-logs` | System-wide audit logs | `admin:audit:read` |
| GET | `admin/jobs` | Background jobs status | `admin:jobs:read` |
| GET | `admin/events` | Event bus monitoring | `admin:events:read` |

### 3.3 Module Structure

```
modules/admin/
  controllers/
    admin-dashboard.controller.ts
    admin-companies.controller.ts
    admin-audit.controller.ts
  services/
    admin-dashboard.service.ts
    admin-companies.service.ts
  repositories/
    admin-dashboard.repository.ts      # Aggregation queries only
    admin-companies.repository.ts
  dto/
    dashboard-summary.dto.ts
    company-query.dto.ts
  mappers/
    admin-dashboard.mapper.ts
  admin.module.ts
```

### 3.4 Key Metrics

```typescript
// Dashboard summary DTO
interface DashboardSummary {
  // System health
  system: {
    status: 'healthy' | 'degraded' | 'down';
    uptime: number;
    memoryUsagePercent: number;
    cpuLoad: number;
    dbConnections: number;
    redisMemory: number;
    queueDepth: number;
  };

  // Companies
  companies: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    newThisMonth: number;
    churnThisMonth: number;
  };

  // Revenue
  revenue: {
    mrr: string;         // Monthly Recurring Revenue
    arr: string;         // Annual Run Rate
    averageRevenuePerAccount: string;
    activeSubscriptions: number;
    byPlan: Array<{ plan: string; count: number; revenue: string }>;
  };

  // Usage
  usage: {
    totalApiCallsLast24h: number;
    avgResponseTimeMs: number;
    p95ResponseTimeMs: number;
    errorRatePercent: number;
    activeUsers: number;
  };
}
```

---

## 4. AI Assistant Architecture

### 4.1 Design Principles

1. **Modular** — AI module is a separate bounded context. It never modifies business data directly.
2. **Event-driven** — AI reads events published by other modules, never couples to internal implementations.
3. **Async by default** — AI predictions are generated asynchronously. The dashboard always shows the last known prediction.
4. **LLM-agnostic** — The architecture supports OpenAI, Anthropic, local models, or future providers.
5. **Privacy-first** — Company data never leaves the deployment. Sensitive calculations run in-process.

### 4.2 Module Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│                        AI Module                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │  Prediction Engine   │  │  AI Assistant                 │  │
│  │                      │  │                               │  │
│  │  • Sales forecast    │  │  • Natural language ERP      │  │
│  │  • Inventory forecast│  │  • Business insights         │  │
│  │  • Cash flow predict │  │  • Query → SQL translation   │  │
│  │  • Low stock detect  │  │  • Recommendation engine     │  │
│  │  • Demand forecasting│  │  • Anomaly detection         │  │
│  └─────────┬────────────┘  └──────────┬───────────────────┘  │
│            │                          │                       │
│  ┌─────────▼──────────────────────────▼───────────────────┐  │
│  │              AI Service Layer                          │  │
│  │  • Model management (model registry)                  │  │
│  │  • Prompt template management                         │  │
│  │  • LLM provider abstraction                           │  │
│  │  • Rate limiting & cost tracking                      │  │
│  │  • Response caching                                   │  │
│  └─────────┬────────────────────────────────────────────┘  │
│            │                                                 │
│  ┌─────────▼────────────────────────────────────────────┐  │
│  │              LLM Provider Abstraction                  │  │
│  │  • OpenAI provider    • Anthropic provider            │  │
│  │  • Local provider     • Custom provider               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Database Models

```prisma
model AiPrediction {
  id            String   @id @default(uuid()) @db.Uuid
  companyId     String   @db.Uuid
  type          String   @db.VarChar(100)   // "sales_forecast" | "stock_prediction" | "cash_flow"
  metric        String   @db.VarChar(100)   // "next_30_days" | "next_90_days"
  value         Json     // Prediction result: { predicted: 150000, confidence: 0.85, ... }
  actualValue   Json?    // Filled later when actual data is available
  accuracy      Decimal? @db.Decimal(5, 2)  // Accuracy percentage when actual is known
  modelVersion  String   @db.VarChar(50)
  generatedAt   DateTime @default(now())
  expiresAt     DateTime?
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([type])
  @@index([generatedAt])
  @@index([companyId, type, generatedAt])
}

model AiConversation {
  id            String   @id @default(uuid()) @db.Uuid
  companyId     String   @db.Uuid
  userId        String   @db.Uuid
  title         String?  @db.VarChar(255)
  messages      AiMessage[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([userId])
  @@index([updatedAt])
}

model AiMessage {
  id              String         @id @default(uuid()) @db.Uuid
  conversationId  String         @db.Uuid
  role            String         @db.VarChar(20)   // "user" | "assistant" | "system"
  content         String         @db.Text
  metadata        Json?          // Tokens used, model, latency, etc.
  tokenCount      Int?
  createdAt       DateTime       @default(now())
  conversation    AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([createdAt])
}
```

### 4.4 Prediction Engine

```typescript
// Prediction engine interface
interface IPredictionProvider {
  predict(payload: PredictionRequest): Promise<PredictionResult>;
}

// Type of predictions
enum PredictionType {
  SALES_FORECAST = 'sales_forecast',
  INVENTORY_FORECAST = 'inventory_forecast',
  CASH_FLOW = 'cash_flow',
  LOW_STOCK = 'low_stock',
  DEMAND = 'demand',
}

// Simple time-series based prediction (works without LLM)
class StatisticalPredictionProvider implements IPredictionProvider {
  async predict(payload: PredictionRequest): Promise<PredictionResult> {
    // Use historical data from Reports module
    // Apply moving average, exponential smoothing, or linear regression
    // Return prediction with confidence interval
  }
}

// LLM-powered prediction (for complex analysis)
class LLMPredictionProvider implements IPredictionProvider {
  async predict(payload: PredictionRequest): Promise<PredictionResult> {
    const context = await this.buildContext(payload);
    const response = await this.llm.complete({
      prompt: this.templates.get(payload.type),
      context,
    });
    return this.parseResponse(response);
  }
}
```

### 4.5 Event Subscriptions

```typescript
// AI module subscribes to these events for prediction generation
@OnEvent('sale.completed')
async onSaleCompleted(event: SaleCompletedEvent): Promise<void> {
  await this.salesForecastService.updateModel(event.companyId, event);
}

@OnEvent('purchase.received')
async onPurchaseReceived(event: PurchaseReceivedEvent): Promise<void> {
  await this.inventoryForecastService.updateModel(event.companyId, event);
}

@OnEvent('inventory.adjusted')
async onInventoryAdjusted(event: InventoryAdjustedEvent): Promise<void> {
  await this.lowStockDetector.evaluate(event.companyId);
}
```

### 4.6 Natural Language Queries

The AI assistant converts natural language to ERP data queries:

```
User: "What were my top 5 products last month?"
  → AI: Analyzes context + company data
  → Query: GET /reports/products/top?dateFrom=...&dateTo=...&limit=5
  → Response: Human-readable answer with data

User: "Should I reorder any products?"
  → AI: Checks inventory levels, sales velocity, lead times
  → Response: "Yes, 3 products are below reorder point..."
```

### 4.7 LLM Integration

```typescript
// LLM Provider Abstraction
class LlmProvider {
  constructor(private readonly config: LlmConfig) {}

  async complete(prompt: string, context: LlmContext): Promise<LlmResponse> {
    // Determine which provider to use
    // Apply rate limits
    // Track token usage and cost
    // Cache similar requests
    // Return structured response
  }
}

// Prompt templates stored in DB or config
interface PromptTemplate {
  id: string;
  type: 'forecast' | 'query' | 'insight' | 'recommendation';
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  model: string;
}
```

---

## 5. Mobile/Web API Readiness

### 5.1 Current API State

| Aspect | Status | Details |
|--------|--------|---------|
| **REST consistency** | ⚠️ Partial | Some endpoints return `{ items, total, page, limit }`, others don't |
| **Swagger** | ✅ Complete | All endpoints documented |
| **DTO validation** | ✅ Complete | `class-validator` on all DTOs |
| **Pagination** | ⚠️ Partial | All list endpoints accept `page`/`limit` but response format varies |
| **Filtering** | ⚠️ Partial | Some modules support `search`, some don't |
| **Sorting** | ⚠️ Partial | `sortBy`/`sortOrder` supported but not consistently |
| **Response envelope** | ❌ Missing | No standard response wrapper |
| **Error format** | ✅ Complete | `GlobalExceptionFilter`, consistent error shape |
| **Bearer auth** | ✅ Complete | JWT via Authorization header |

### 5.2 Standard Response Envelope

```typescript
// Standard success response
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

// Standard error response
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
    requestId: string;
    timestamp: string;
  };
}

// Paginated response
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Response metadata
interface ResponseMeta {
  requestId: string;
  timestamp: string;
  processingTimeMs: number;
}
```

### 5.3 Pagination Standard

Every list endpoint must follow this contract:

```
Query params:
  ?page=1          (default: 1)
  &limit=20        (default: 20, max: 100)
  &sortBy=createdAt (default: per module)
  &sortOrder=desc   (desc | asc)
  &search=         (optional, full-text search)

Response:
  {
    "success": true,
    "data": [...],
    "meta": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
```

### 5.4 PaginationInterceptor

A single NestJS interceptor wraps all list responses with the standard envelope:

```typescript
@Injectable()
class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        if (this.isPaginated(data)) {
          return {
            success: true,
            data: data.items,
            meta: {
              total: data.total,
              page: data.page,
              limit: data.limit,
              totalPages: Math.ceil(data.total / data.limit),
              hasNextPage: data.page * data.limit < data.total,
              hasPreviousPage: data.page > 1,
            },
          };
        }
        return { success: true, data };
      }),
    );
  }
}
```

### 5.5 API Changelog Template

| Endpoint | Current | Mobile Compatible | Change Required |
|----------|---------|-------------------|-----------------|
| `GET /api/products` | `{ items, total, page, limit }` | ✅ | Add envelope |
| `GET /api/sales` | `{ items, total, page, limit }` | ✅ | Add envelope |
| `GET /api/customers` | `{ items, total, page, limit }` | ✅ | Add envelope |
| `GET /api/suppliers` | `{ items, total, page, limit }` | ✅ | Add envelope |
| `GET /api/inventory/stock` | Raw `Stock[]` | ❌ | Add paginated response |
| `GET /api/reports/*` | Mixed formats | ⚠️ | Standardize |
| `GET /api/finance/*` | Mixed formats | ⚠️ | Standardize |

---

## 6. Infrastructure & Deployment

### 6.1 Current Infrastructure

```
SaaS deployment architecture:

  ┌─────────┐     ┌─────────┐     ┌──────────┐
  │  Nginx   │────▶│  App    │────▶│PostgreSQL│
  │ (proxy)  │     │ (Node)  │     │  (RDS)   │
  └─────────┘     └────┬────┘     └──────────┘
                       │
                  ┌────▼────┐
                  │  Redis  │
                  │(ElastiCache)│
                  └─────────┘
```

### 6.2 Required Infrastructure for SaaS

| Component | Production | Development |
|-----------|------------|-------------|
| **PostgreSQL** | AWS RDS / DigitalOcean Managed DB | Docker |
| **Redis** | AWS ElastiCache / Upstash | Docker |
| **App hosting** | AWS ECS Fargate / Railway | Docker Compose |
| **CDN** | Cloudflare / AWS CloudFront | Not needed |
| **Queue** | BullMQ + Redis | BullMQ + Redis |
| **Object storage** | AWS S3 / DigitalOcean Spaces | Local filesystem |
| **Email** | SendGrid / AWS SES / Mailgun | SMTP mock |
| **LLM API** | OpenAI / Anthropic via API key | Mock provider |
| **Monitoring** | Grafana + Loki + Tempo | Prometheus only |
| **Payment** | Stripe + PayPal + Kaspi | Stripe test mode |
| **Background jobs** | BullMQ worker (separate process) | In-process |

### 6.3 Horizontal Scaling Strategy

```
                       ┌──────────┐
                       │   Nginx   │
                       │ (LB)     │
                       └────┬─────┘
                            │
              ┌─────────────┼─────────────┐
              │              │              │
         ┌────▼───┐    ┌────▼───┐    ┌────▼───┐
         │ Web     │    │ Web     │    │ Web     │
         │ Instance │    │ Instance │    │ Instance │
         │ (Node)  │    │ (Node)  │    │ (Node)  │
         └────┬───┘    └────┬───┘    └────┬───┘
              │              │              │
         ┌────▼──────────────▼──────────────▼────┐
         │            PostgreSQL (Primary)         │
         │            + Read Replicas              │
         └───────────────────┬────────────────────┘
                             │
                        ┌────▼────┐
                        │  Redis   │
                        │ (Shared) │
                        └─────────┘

Separate worker process:
         ┌────▼────┐
         │ Worker   │
         │ (BullMQ) │
         └─────────┘
```

### 6.4 Docker Compose — Production-like

```yaml
services:
  postgres:
    image: postgres:16-alpine
    # ...

  redis:
    image: redis:7-alpine
    # ...

  app:
    build: .
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://...
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      LLM_PROVIDER: openai
    depends_on: [postgres, redis]

  worker:
    build: .
    command: node dist/worker.js
    environment:
      # Same as app but worker-specific
    depends_on: [postgres, redis]
```

---

## 7. Implementation Roadmap

### Phase 7.1 — Foundation (Weeks 1–2)

**Prerequisites:** Prisma migration for billing models, FeatureFlag models, UsageRecord models.

| Task | Effort | Dependencies |
|------|--------|-------------|
| Create `SubscriptionPlan` Prisma model | Small | None |
| Create `CompanySubscription` Prisma model | Small | SubscriptionPlan |
| Create `FeatureFlag` + `PlanFeatureOverride` models | Small | SubscriptionPlan |
| Create `UsageRecord` Prisma model | Small | None |
| Create `Invoice` + `InvoiceLine` models | Medium | CompanySubscription |
| Create `AiPrediction` + `AiConversation` + `AiMessage` models | Small | None |
| Run and verify migration | Small | All models above |
| Create base `BillingModule` structure | Small | None |
| Create base `AdminModule` structure | Small | None |
| Create base `AiModule` structure | Small | None |

### Phase 7.2 — Billing Core (Weeks 3–4)

| Task | Effort | Dependencies |
|------|--------|-------------|
| Implement `SubscriptionPlanService` — CRUD | Medium | Phase 7.1 |
| Implement `CompanySubscriptionService` — create/upgrade/downgrade | Medium | Plan CRUD |
| Implement `FeatureFlagService` — evaluation engine | Medium | Phase 7.1 |
| Implement `UsageTrackingService` — metric recording | Medium | EventBus |
| Create `BillingWebhookController` — Stripe integration | Large | CompanySubscription |
| Create `InvoiceService` — auto-generation at period end | Medium | CompanySubscription |
| Create seed data (Free/Starter/Business/Enterprise plans) | Small | Plans CRUD |
| Unit tests for all billing services | Medium | Implementation |

### Phase 7.3 — Operations Dashboard (Weeks 5–6)

| Task | Effort | Dependencies |
|------|--------|-------------|
| Implement `AdminDashboardService` — aggregation queries | Medium | Phase 7.1 |
| Implement `AdminCompaniesService` — company management | Small | CompanySubscription |
| Create `AdminDashboardController` — all admin endpoints | Medium | Dashboard service |
| Add `admin:dashboard` permission to RBAC | Small | None |
| Create `MetricsService` enhancements — per-company breakdown | Medium | OpenTelemetry |
| Create audit log viewer endpoint | Small | AuditLog model |
| Create background job monitoring endpoint | Medium | BullMQ |
| Tests for admin services | Medium | Implementation |

### Phase 7.4 — AI Assistant (Weeks 7–10)

| Task | Effort | Dependencies |
|------|--------|-------------|
| Create `LlmProvider` abstraction layer | Medium | Phase 7.1 |
| Create `StatisticalPredictionProvider` | Large | Reports module |
| Implement sales forecasting | Medium | Reports, Sales |
| Implement low stock prediction | Medium | Inventory |
| Implement cash flow prediction | Medium | Finance |
| Create AI conversation API | Medium | AiConversation model |
| Implement natural language query → report mapping | Large | All report endpoints |
| Integrate with OpenAI/Anthropic API | Medium | LlmProvider |
| Create prompt template management | Small | AiMessage model |
| Token usage tracking and cost limits | Small | AiMessage model |
| Tests for all AI services | Medium | Implementation |

### Phase 7.5 — Mobile/Web API Hardening (Week 11)

| Task | Effort | Dependencies |
|------|--------|-------------|
| Create `ResponseEnvelopeInterceptor` | Small | None |
| Create `PaginatedResponseInterceptor` | Small | None |
| Apply to all controllers | Medium | Interceptors |
| Add `search` support to all list endpoints | Medium | All repositories |
| Add `sortBy`/`sortOrder` to all list endpoints | Medium | All repositories |
| Create OpenAPI improvements script | Small | Swagger |
| Verify Flutter client compatibility | Medium | API review |
| Test all endpoints with mobile client | Medium | Flutter |

### Phase 7.6 — Production Readiness (Week 12)

| Task | Effort | Dependencies |
|------|--------|-------------|
| Performance test with k6 (simulate 1000 companies) | Medium | All of Phase 7 |
| Fix N+1 queries found during testing | Medium | Performance test |
| Add remaining optimistic locking (Users, Products) | Small | None |
| Connect `CacheService` to actual services | Medium | CacheService |
| Run full CI/CD pipeline | Small | All changes |
| Production readiness review | Small | All of Phase 7 |
| Generate deployment runbook | Medium | All of Phase 7 |

---

## 8. Risk Assessment

### 8.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| AI forecast accuracy too low for production | Medium | High | Implement statistical fallback; gradual rollout to internal use first |
| Stripe integration complexity | Low | High | Use Stripe webhooks with idempotency keys; test all edge cases |
| Performance regression from dashboard aggregation queries | Medium | Medium | Use materialized views for dashboard queries; cache aggressively |
| Multi-tenancy leak in admin dashboard | Low | Critical | Separate admin JWT, never use company-scoped tokens for admin operations |
| LLM API latency blocks user requests | Medium | Medium | Async prediction generation; show cached results immediately |
| Payment provider webhook failures | Low | Medium | Webhook retry with exponential backoff; manual reconciliation tool |

### 8.2 Timeline Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| AI module scope creep | High | Medium | Freeze AI features after sales forecasting + low stock detection |
| Integration test environment complexity | Medium | Medium | Use Docker Compose for CI integration tests |
| Stripe/PayPal certification delays | Low | Medium | Start payment integration in Week 2; allows 2 weeks for certification |

---

## 9. Success Criteria

### 9.1 Phase 7 Complete — Definition of Done

| Criterion | Verification |
|-----------|-------------|
| New companies can register and start a 14-day trial | Automated integration test |
| After trial, companies are auto-downgraded to Free plan | Cron job test |
| Companies can upgrade to Starter/Business/Enterprise | Stripe checkout test |
| Feature flags correctly enable/disable modules per plan | Unit tests for each plan |
| Usage tracking records API calls, sales, storage | Integration test |
| Admin can view dashboard with real metrics | E2E test |
| Admin can suspend/activate companies | Integration test |
| AI can predict next month's sales with ≥80% accuracy | Statistical test on historical data |
| AI can answer "What are my top products?" via chat | Integration test |
| All API endpoints return standard envelope | Controller test |
| Flutter client works with all API changes | Manual QA |
| 1000 simulated companies → p95 response < 500ms | k6 test |
| Zero TypeScript errors | `tsc --noEmit` |
| Zero new `as any` casts | ESLint rule |
| ≥80% test coverage on new modules | Jest coverage |

### 9.2 Production Launch Checklist

- [ ] Phase 6.1 blockers resolved (Account lockout, OL, TOCTOU)
- [ ] Phase 7.1–7.6 all complete
- [ ] Zero TypeScript errors
- [ ] Zero critical/high security vulnerabilities (`npm audit`)
- [ ] ≥80% test coverage on critical paths
- [ ] k6 performance baseline established
- [ ] Stripe integration tested with real test keys
- [ ] Stripe webhook idempotency verified
- [ ] Email sending configured (transactional + billing)
- [ ] Grafana dashboards created
- [ ] PagerDuty/OpsGenie alerts configured
- [ ] Disaster recovery runbook created
- [ ] Database backup verified
- [ ] Rollback plan documented
- [ ] 2 weeks of staging environment testing completed

---

## Appendix A: Prisma Migration Checklist

```bash
# Step 1: Add all Prisma models from this document to schema.prisma
# Step 2: Run migration
npx prisma migrate dev --name add_saas_models

# Step 3: Seed default plans
npx ts-node prisma/seed-plans.ts

# Step 4: Verify
npx prisma validate
npm run build
npm run test
```

## Appendix B: Feature Flag Matrix (Default Plans)

| Feature | Free | Starter | Business | Enterprise |
|---------|------|---------|----------|------------|
| Max Users | 1 | 3 | 10 | Unlimited |
| Max Warehouses | 1 | 2 | 5 | Unlimited |
| Max Products | 100 | 1,000 | 10,000 | Unlimited |
| Max Customers | 50 | 500 | 5,000 | Unlimited |
| Max Sales/month | 500 | 5,000 | 50,000 | Unlimited |
| Reports | Basic | Basic | Advanced | Advanced + Custom |
| AI Assistant | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ✅ | ✅ | ✅ |
| Export (CSV) | ❌ | ✅ | ✅ | ✅ |
| Multi-currency | ❌ | ❌ | ✅ | ✅ |
| Audit Log | 7 days | 30 days | 90 days | 365 days |
| Support | Community | Email | Priority | 24/7 Phone |

## Appendix C: AI Cost Projection

| Feature | Calls/month | Cost/call | Monthly cost (100 companies) |
|---------|------------|-----------|------------------------------|
| Sales forecast | 100 | $0.01 | $1.00/company |
| Low stock detection | 300 | $0.005 | $1.50/company |
| Cash flow prediction | 30 | $0.02 | $0.60/company |
| NLP queries | 200 | $0.02 | $4.00/company |
| **Total per company** | | | **$7.10/company** |
| **Total for 100 companies** | | | **$710/month** |

---

## Summary: Phase 7 Milestones

| Milestone | Target Date | Deliverable |
|-----------|-------------|-------------|
| M1: SaaS Foundation | End of Week 2 | Prisma models + base modules |
| M2: Billing Active | End of Week 4 | Plans, subscriptions, Stripe webhooks working |
| M3: Dashboard Live | End of Week 6 | Admin dashboard with real metrics |
| M4: AI Operational | End of Week 10 | Sales forecasting + NLP assistant running |
| M5: API Hardened | End of Week 11 | Standard response envelope on all endpoints |
| M6: Production Ready | End of Week 12 | k6 baseline, all tests passing, launch checklist complete |
