# 🚩 StockFlow Enterprise — Feature Flag Engine v1.0

**Status:** Architecture Design — Ready for Implementation  
**Date:** July 26, 2026  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Feature Flag Registry](#2-feature-flag-registry)
3. [Plan Feature Matrix](#3-plan-feature-matrix)
4. [Evaluation Engine](#4-evaluation-engine)
5. [Resolution Priority](#5-resolution-priority)
6. [Override System](#6-override-system)
7. [Caching Strategy](#7-caching-strategy)
8. [API Design](#8-api-design)
9. [Integration Patterns](#9-integration-patterns)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Architecture Overview

```
                         ┌─────────────────────────────────────┐
                         │       FeatureFlagService             │
                         │                                     │
                         │  ┌───────────────────────────────┐  │
                         │  │   Evaluation Pipeline          │  │
                         │  │                               │  │
                         │  │  1. Plan defaults (JSON)      │  │
                         │  │  2. Company overrides (DB)    │  │
                         │  │  3. Temporary promotions (DB) │  │
                         │  │  4. Trial features (code)     │  │
                         │  └───────────────────────────────┘  │
                         │                                     │
                         │  Cache: Redis (TTL 5 min)          │
                         │  DB: PostgreSQL                     │
                         └─────────────────────────────────────┘
                               │              │
                    ┌──────────┴────────┐ ┌───┴──────────────┐
                    │  SubscriptionPlan │ │  CompanyOverride  │
                    │  { featureFlags:  │ │  { feature:      │
                    │    JSON }         │ │    enabled: bool  │
                    └───────────────────┘ │    config: JSON   │
                                          └──────────────────┘
```

### Data Flow

```
HTTP Request
    │
    ├──► Interceptor extracts companyId from JWT
    │
    ├──► FeatureFlagService.resolve(companyId)
    │       │
    │       ├──► Check cache (Redis)
    │       │       │
    │       │       ├──► Cache HIT → return resolved flags
    │       │       │
    │       │       └──► Cache MISS → evaluate → store in cache
    │       │
    │       └──► Return resolved FeatureFlags object
    │
    └──► Controller checks specific flag
            │
            ├──► if (!flags.isEnabled('reports.advanced'))
            │        throw new ForbiddenException('Upgrade required')
            │
            └──► Continue processing
```

---

## 2. Feature Flag Registry

### 2.1 Flag Definition

```typescript
interface FeatureFlagDefinition {
  /** Unique identifier (kebab-case) */
  key: string;

  /** Human-readable name */
  name: string;

  /** Category for grouping in admin UI */
  category: FeatureCategory;

  /** Description shown to users */
  description: string;

  /** Type of flag determines how it's resolved */
  type: 'boolean' | 'limit' | 'config';

  /** Default value when no plan or override is set */
  defaultValue: boolean | number | Record<string, unknown>;

  /** Which plan tiers support changing this flag */
  mutableInPlans: ('free' | 'starter' | 'business' | 'enterprise')[];

  /** Whether enterprise plans can override this */
  enterpriseOverridable: boolean;

  /** UI visibility */
  uiVisible: boolean;
}

type FeatureCategory =
  | 'inventory'
  | 'sales'
  | 'purchasing'
  | 'reports'
  | 'finance'
  | 'crm'
  | 'ai'
  | 'api'
  | 'integration'
  | 'administration'
  | 'support';
```

### 2.2 Full Flag Registry

#### Boolean Flags

| Key | Name | Category | Default | Free | Starter | Business | Enterprise |
|-----|------|----------|---------|------|---------|----------|------------|
| `inventory.basic` | Basic Inventory | inventory | `false` | ✅ | ✅ | ✅ | ✅ |
| `inventory.advanced` | Advanced Inventory | inventory | `false` | ❌ | ❌ | ✅ | ✅ |
| `inventory.batches` | Batch Tracking | inventory | `false` | ❌ | ❌ | ✅ | ✅ |
| `inventory.serial` | Serial Numbers | inventory | `false` | ❌ | ❌ | ❌ | ✅ |
| `inventory.expiry` | Expiry Tracking | inventory | `false` | ❌ | ❌ | ✅ | ✅ |
| `inventory.barcodes` | Barcode Scanning | inventory | `false` | ❌ | ✅ | ✅ | ✅ |
| `inventory.multi_warehouse` | Multiple Warehouses | inventory | `false` | ❌ | ❌ | ✅ | ✅ |
| `inventory.costing.fifo` | FIFO Costing | inventory | `false` | ❌ | ❌ | ✅ | ✅ |
| `inventory.costing.average` | Average Costing | inventory | `false` | ❌ | ✅ | ✅ | ✅ |
| `inventory.transfers` | Stock Transfers | inventory | `false` | ❌ | ❌ | ✅ | ✅ |
| `inventory.physical_count` | Physical Count | inventory | `false` | ❌ | ❌ | ✅ | ✅ |
| `reports.standard` | Standard Reports | reports | `false` | ✅ | ✅ | ✅ | ✅ |
| `reports.advanced` | Advanced Reports | reports | `false` | ❌ | ❌ | ✅ | ✅ |
| `reports.custom` | Custom Reports | reports | `false` | ❌ | ❌ | ❌ | ✅ |
| `reports.scheduled` | Scheduled Reports | reports | `false` | ❌ | ❌ | ✅ | ✅ |
| `reports.export.csv` | CSV Export | reports | `false` | ✅ | ✅ | ✅ | ✅ |
| `reports.export.pdf` | PDF Export | reports | `false` | ❌ | ✅ | ✅ | ✅ |
| `reports.dashboard` | Custom Dashboard | reports | `false` | ❌ | ❌ | ✅ | ✅ |
| `sales.pos` | Point of Sale | sales | `false` | ❌ | ✅ | ✅ | ✅ |
| `sales.invoicing` | Invoicing | sales | `false` | ❌ | ✅ | ✅ | ✅ |
| `sales.quotes` | Quotes | sales | `false` | ❌ | ✅ | ✅ | ✅ |
| `sales.returns` | Returns Management | sales | `false` | ❌ | ✅ | ✅ | ✅ |
| `sales.discounts` | Discount Management | sales | `false` | ✅ | ✅ | ✅ | ✅ |
| `purchasing.basic` | Basic Purchasing | purchasing | `false` | ✅ | ✅ | ✅ | ✅ |
| `purchasing.rfq` | RFQ Management | purchasing | `false` | ❌ | ❌ | ✅ | ✅ |
| `purchasing.approval` | Purchase Approval | purchasing | `false` | ❌ | ❌ | ✅ | ✅ |
| `purchasing.budget` | Purchase Budgeting | purchasing | `false` | ❌ | ❌ | ❌ | ✅ |
| `finance.basic` | Basic Finance | finance | `false` | ❌ | ✅ | ✅ | ✅ |
| `finance.accounting` | Full Accounting | finance | `false` | ❌ | ❌ | ✅ | ✅ |
| `finance.gl` | General Ledger | finance | `false` | ❌ | ❌ | ✅ | ✅ |
| `finance.budgeting` | Budgeting | finance | `false` | ❌ | ❌ | ❌ | ✅ |
| `finance.forecasting` | Forecasting | finance | `false` | ❌ | ❌ | ❌ | ✅ |
| `finance.multi_currency` | Multi-Currency | finance | `false` | ❌ | ❌ | ✅ | ✅ |
| `crm.basic` | Basic CRM | crm | `false` | ✅ | ✅ | ✅ | ✅ |
| `crm.advanced` | Advanced CRM | crm | `false` | ❌ | ❌ | ✅ | ✅ |
| `crm.loyalty` | Loyalty Program | crm | `false` | ❌ | ❌ | ✅ | ✅ |
| `crm.credit_limits` | Credit Limits | crm | `false` | ❌ | ✅ | ✅ | ✅ |
| `crm.price_lists` | Price Lists | crm | `false` | ❌ | ✅ | ✅ | ✅ |
| `crm.opportunities` | Sales Opportunities | crm | `false` | ❌ | ❌ | ✅ | ✅ |
| `ai.assistant` | AI Assistant | ai | `false` | ❌ | ❌ | ✅ | ✅ |
| `ai.forecasting` | AI Forecasting | ai | `false` | ❌ | ❌ | ❌ | ✅ |
| `ai.anomaly_detection` | AI Anomaly Detection | ai | `false` | ❌ | ❌ | ❌ | ✅ |
| `api.webhooks` | Webhooks | api | `false` | ❌ | ❌ | ✅ | ✅ |
| `api.custom_integrations` | Custom Integrations | api | `false` | ❌ | ❌ | ❌ | ✅ |
| `api.rate_limit.boost` | Rate Limit Boost | api | `false` | ❌ | ❌ | ✅ | ✅ |
| `administration.team` | Team Management | administration | `false` | ✅ | ✅ | ✅ | ✅ |
| `administration.roles` | Custom Roles | administration | `false` | ❌ | ❌ | ✅ | ✅ |
| `administration.audit` | Audit Trail | administration | `false` | ❌ | ✅ | ✅ | ✅ |
| `administration.branding` | White Label | administration | `false` | ❌ | ❌ | ❌ | ✅ |
| `support.priority` | Priority Support | support | `false` | ❌ | ❌ | ✅ | ✅ |
| `support.dedicated` | Dedicated Support | support | `false` | ❌ | ❌ | ❌ | ✅ |
| `integration.shopify` | Shopify Integration | integration | `false` | ❌ | ❌ | ✅ | ✅ |
| `integration.woocommerce` | WooCommerce | integration | `false` | ❌ | ❌ | ✅ | ✅ |
| `integration.tax` | Tax Automation | integration | `false` | ❌ | ❌ | ✅ | ✅ |
| `integration.shipping` | Shipping Integration | integration | `false` | ❌ | ❌ | ✅ | ✅ |

#### Limit Flags

| Key | Name | Category | Free | Starter | Business | Enterprise |
|-----|------|----------|------|---------|----------|------------|
| `limits.users` | Max Users | administration | `1` | `3` | `10` | `-1` (unlimited) |
| `limits.warehouses` | Max Warehouses | inventory | `1` | `1` | `5` | `-1` |
| `limits.products` | Max Products | inventory | `50` | `500` | `5000` | `-1` |
| `limits.customers` | Max Customers | crm | `50` | `500` | `5000` | `-1` |
| `limits.suppliers` | Max Suppliers | purchasing | `10` | `100` | `1000` | `-1` |
| `limits.sales_month` | Monthly Sales | sales | `100` | `1000` | `10000` | `-1` |
| `limits.invoices_month` | Monthly Invoices | sales | `50` | `500` | `5000` | `-1` |
| `limits.api_calls_day` | Daily API Calls | api | `1000` | `10000` | `100000` | `-1` |
| `limits.storage_mb` | Storage (MB) | administration | `100` | `1000` | `10000` | `-1` |
| `limits.report_rows` | Max Report Rows | reports | `1000` | `10000` | `100000` | `-1` |
| `limits.ai_queries_day` | Daily AI Queries | ai | `0` | `0` | `100` | `1000` |

#### Config Flags

| Key | Name | Type | Description |
|-----|------|------|-------------|
| `config.theme` | Brand Color | `string` | Hex color code (Enterprise: white-label) |
| `config.logo_url` | Custom Logo | `string` | Logo URL (Enterprise only) |
| `config.default_language` | Default Language | `string` | Company default locale |
| `config.currency` | Base Currency | `string` | Company base currency |
| `config.timezone` | Timezone | `string` | Company timezone |
| `config.date_format` | Date Format | `string` | Date display format |
| `config.invoice_prefix` | Invoice Prefix | `string` | Invoice number prefix |
| `config.tax_rate` | Default Tax Rate | `string` | Default tax rate (Decimal string) |
| `config.session_timeout` | Session Timeout | `number` | Minutes before session expires |

---

## 3. Plan Feature Matrix

### 3.1 Plan Configuration

```typescript
// Each plan defines its feature defaults as JSON
// Stored in SubscriptionPlan.featureFlags (JSON column)

interface PlanFeatureConfig {
  /** Boolean features: enabled or disabled */
  booleanFeatures: Record<string, boolean>;

  /** Numeric limits: positive integer or -1 for unlimited */
  limits: Record<string, number>;

  /** Configuration values */
  config: Record<string, string | number | boolean>;
}

// Example: Business Plan
const businessPlanFeatures: PlanFeatureConfig = {
  booleanFeatures: {
    'inventory.basic': true,
    'inventory.advanced': true,
    'inventory.batches': true,
    'inventory.expiry': true,
    'inventory.barcodes': true,
    'inventory.multi_warehouse': true,
    'inventory.costing.fifo': true,
    'inventory.costing.average': true,
    'inventory.transfers': true,
    'inventory.physical_count': true,
    'reports.standard': true,
    'reports.advanced': true,
    'reports.scheduled': true,
    'reports.export.csv': true,
    'reports.export.pdf': true,
    'reports.dashboard': true,
    'sales.pos': true,
    'sales.invoicing': true,
    'sales.quotes': true,
    'sales.returns': true,
    'sales.discounts': true,
    'purchasing.basic': true,
    'purchasing.rfq': true,
    'purchasing.approval': true,
    'finance.basic': true,
    'finance.accounting': true,
    'finance.gl': true,
    'finance.multi_currency': true,
    'crm.basic': true,
    'crm.advanced': true,
    'crm.loyalty': true,
    'crm.credit_limits': true,
    'crm.price_lists': true,
    'crm.opportunities': true,
    'ai.assistant': true,
    'api.webhooks': true,
    'api.rate_limit.boost': true,
    'administration.team': true,
    'administration.roles': true,
    'administration.audit': true,
    'support.priority': true,
    'integration.shopify': true,
    'integration.woocommerce': true,
    'integration.tax': true,
    'integration.shipping': true,
  },
  limits: {
    'limits.users': 10,
    'limits.warehouses': 5,
    'limits.products': 5000,
    'limits.customers': 5000,
    'limits.suppliers': 1000,
    'limits.sales_month': 10000,
    'limits.invoices_month': 5000,
    'limits.api_calls_day': 100000,
    'limits.storage_mb': 10000,
    'limits.report_rows': 100000,
    'limits.ai_queries_day': 100,
  },
};
```

### 3.2 Feature Inheritance

```
Free (limited) ← Starter (growing) ← Business (professional) ← Enterprise (unlimited)
```

- **Higher plans inherit all features from lower plans**
- Enterprise plan has `-1` (unlimited) on all limits
- Feature definitions define the minimum plan that enables each feature
- The plan JSON only stores enabled features for that plan tier

---

## 4. Evaluation Engine

### 4.1 Core Service

```typescript
@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly subscriptionRepository: CompanySubscriptionRepository,
    private readonly planRepository: SubscriptionPlanRepository,
    private readonly overrideRepository: CompanyOverrideRepository,
    private readonly cacheService: CacheService,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────

  /** Check if a feature is enabled for a company */
  async isEnabled(companyId: string, featureKey: string): Promise<boolean> {
    const flags = await this.getResolvedFlags(companyId);
    const value = flags.booleanFeatures[featureKey];
    return value === true;
  }

  /** Get a numeric limit for a company */
  async getLimit(companyId: string, limitKey: string): Promise<number> {
    const flags = await this.getResolvedFlags(companyId);
    return flags.limits[limitKey] ?? 0;
  }

  /** Get a config value for a company */
  async getConfig(companyId: string, configKey: string): Promise<string | number | boolean | null> {
    const flags = await this.getResolvedFlags(companyId);
    return flags.config[configKey] ?? null;
  }

  /** Get all resolved flags (cached) */
  async getResolvedFlags(companyId: string): Promise<ResolvedFeatureFlags> {
    const cacheKey = `feature-flags:${companyId}`;

    // 1. Check cache
    const cached = await this.cacheService.get<ResolvedFeatureFlags>(cacheKey);
    if (cached) return cached;

    // 2. Evaluate
    const flags = await this.evaluateFlags(companyId);

    // 3. Cache (TTL: 5 minutes)
    await this.cacheService.set(cacheKey, flags, { ttl: 300 });

    return flags;
  }

  /** Invalidate cache for a company (called when plan/override changes) */
  async invalidateCache(companyId: string): Promise<void> {
    await this.cacheService.del(`feature-flags:${companyId}`);
  }

  /** Force re-evaluation and update cache */
  async refreshFlags(companyId: string): Promise<ResolvedFeatureFlags> {
    await this.invalidateCache(companyId);
    return this.getResolvedFlags(companyId);
  }

  // ── Private: Evaluation Pipeline ─────────────────────────────────────

  private async evaluateFlags(companyId: string): Promise<ResolvedFeatureFlags> {
    const subscription = await this.subscriptionRepository.findByCompany(companyId);
    const plan = await this.planRepository.findById(subscription.planId);
    const overrides = await this.overrideRepository.findByCompany(companyId);
    const isTrial = subscription.status === 'TRIAL';

    // Start with plan defaults
    const planFlags = plan.featureFlags as PlanFeatureConfig;

    // Apply overrides
    const booleanFeatures = { ...planFlags.booleanFeatures };
    const limits = { ...planFlags.limits };
    const config = { ...planFlags.config };

    for (const override of overrides) {
      if (override.type === 'BOOLEAN' && override.featureKey in booleanFeatures) {
        booleanFeatures[override.featureKey] = override.enabled;
      } else if (override.type === 'LIMIT' && override.limitKey in limits && override.limitValue !== undefined) {
        limits[override.limitKey] = override.limitValue;
      } else if (override.type === 'CONFIG' && override.configKey && override.configValue !== undefined) {
        config[override.configKey] = override.configValue;
      }
    }

    // Apply trial override: enable all features during trial
    if (isTrial) {
      // Enable ALL boolean features during trial
      for (const key of ALL_FEATURE_KEYS) {
        booleanFeatures[key] = true;
      }
      // Set limits to enterprise level during trial
      for (const key of ALL_LIMIT_KEYS) {
        limits[key] = -1; // Unlimited during trial
      }
    }

    return { booleanFeatures, limits, config };
  }
}
```

### 4.2 Evaluation Pipeline

```
1. Load plan defaults
   │
   ├──► Get SubscriptionPlan.featureFlags JSON
   │
   ├──► Extract booleanFeatures, limits, config
   │
2. Apply company overrides
   │
   ├──► Query CompanyFeatureOverride table
   │
   ├──► For each override:
   │     ├──► boolean: overrides booleanFeatures[key]
   │     ├──► limit: overrides limits[key]
   │     └──► config: overrides config[key]
   │
3. Apply trial overrides (if status === 'TRIAL')
   │
   ├──► Enable all boolean features
   ├──► Set all limits to -1 (unlimited)
   └──► Keep config overrides
   │
4. Return resolved flags
   │
   ├──► Cache in Redis (TTL: 5 min)
   └──► Return to caller
```

---

## 5. Resolution Priority

### 5.1 Priority Order (highest to lowest)

```
1. Temporary Promotion (time-limited override)
   → E.g., "Free AI forecasting for 30 days"
   
2. Company Override (admin-set)
   → E.g., "Customer X gets boosted API limit"
   
3. Trial Override (automatic for TRIAL subscriptions)
   → All features enabled, unlimited limits
   
4. Plan Defaults (from SubscriptionPlan.featureFlags)
   → Normal plan-level feature configuration
   
5. Global Default (from FeatureFlagDefinition.defaultValue)
   → Fallback if plan has no configuration for this feature
```

### 5.2 Implementation

```typescript
private async evaluateFlags(companyId: string): Promise<ResolvedFeatureFlags> {
  const subscription = await this.subscriptionRepository.findByCompany(companyId, {
    include: { plan: true, promotions: { where: { active: true } } },
  });
  const plan = subscription.plan;
  const overrides = await this.overrideRepository.findByCompany(companyId);
  const promotions = subscription.promotions ?? [];
  const isTrial = subscription.status === 'TRIAL';

  // Priority 4: Start with plan defaults
  const planFlags = plan.featureFlags as PlanFeatureConfig;
  const booleanFeatures = { ...planFlags.booleanFeatures };
  const limits = { ...planFlags.limits };
  const config = { ...planFlags.config };

  // Priority 3: Trial override (unless promotion is higher)
  if (isTrial) {
    for (const key of ALL_FEATURE_KEYS) booleanFeatures[key] = true;
    for (const key of ALL_LIMIT_KEYS) limits[key] = -1;
  }

  // Priority 2: Company overrides
  for (const override of overrides) {
    if (!override.isActive) continue;
    applyOverride(booleanFeatures, limits, config, override);
  }

  // Priority 1: Time-limited promotions (highest)
  for (const promo of promotions) {
    if (!promo.isActive || promo.expiresAt < new Date()) continue;
    for (const [key, value] of Object.entries(promo.featureOverrides)) {
      if (typeof value === 'boolean') booleanFeatures[key] = value;
      else if (typeof value === 'number') limits[key] = value;
    }
  }

  return { booleanFeatures, limits, config };
}
```

### 5.3 Conflict Resolution Rules

| Scenario | Resolution |
|----------|------------|
| Plan says A, override says B | **Override wins** (admin has explicit intent) |
| Trial says unlimited, override says limited | **Override wins** (admin explicitly limited) |
| Promotion says enabled, override says disabled | **Promotion wins** (temporary, time-boxed) |
| Two promotions conflict | **Most recently created wins** |
| Override + Promotion on same feature | **Promotion wins** during its active period |

---

## 6. Override System

### 6.1 Database Model

```typescript
model CompanyFeatureOverride {
  id            String   @id @default(uuid()) @db.Uuid
  companyId     String   @db.Uuid
  featureKey    String?  // For boolean overrides
  limitKey      String?  // For limit overrides
  configKey     String?  // For config overrides
  type          OverrideType  // BOOLEAN | LIMIT | CONFIG
  enabled       Boolean? // For boolean overrides
  limitValue    Int?     // For limit overrides
  configValue   Json?    // For config overrides
  reason        String?  // Admin note explaining override
  createdBy     String   @db.Uuid
  isActive      Boolean  @default(true)
  expiresAt     DateTime? // Optional expiration
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  company       Company  @relation(fields: [companyId], references: [id])

  @@index([companyId, isActive])
  @@index([featureKey, companyId])
}
```

### 6.2 Temporary Promotions

```typescript
model CompanyPromotion {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @db.Uuid
  promotionName   String   // e.g., "Free AI Month"
  featureOverrides Json    // { "ai.assistant": true, "ai.forecasting": true, "limits.ai_queries_day": 1000 }
  startsAt        DateTime
  expiresAt       DateTime
  isActive        Boolean  @default(true)
  createdBy       String   @db.Uuid
  createdAt       DateTime @default(now())

  company         Company  @relation(fields: [companyId], references: [id])

  @@index([companyId, isActive, startsAt, expiresAt])
}
```

### 6.3 Admin Override API

```typescript
@Controller('admin/companies/:companyId/features')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission('admin:billing')
@ApiBearerAuth()
export class AdminFeatureOverrideController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  // ── Set boolean override ─────────────────────────────────────
  @Post('overrides')
  async setOverride(
    @Param('companyId') companyId: string,
    @Body() dto: CreateOverrideDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.featureFlagService.setOverride(companyId, {
      featureKey: dto.featureKey,
      enabled: dto.enabled,
      reason: dto.reason,
      expiresAt: dto.expiresAt,
      createdBy: user.userId,
    });
    await this.featureFlagService.invalidateCache(companyId);
  }

  // ── List active overrides ────────────────────────────────────
  @Get('overrides')
  async listOverrides(@Param('companyId') companyId: string): Promise<CompanyOverrideEntity[]> {
    const overrides = await this.featureFlagService.listOverrides(companyId);
    return overrides.map(o => this.overrideMapper.toEntity(o));
  }

  // ── Remove override ──────────────────────────────────────────
  @Delete('overrides/:id')
  async removeOverride(
    @Param('companyId') companyId: string,
    @Param('id') overrideId: string,
  ): Promise<void> {
    await this.featureFlagService.removeOverride(overrideId);
    await this.featureFlagService.invalidateCache(companyId);
  }

  // ── Set temporary promotion ──────────────────────────────────
  @Post('promotions')
  async createPromotion(
    @Param('companyId') companyId: string,
    @Body() dto: CreatePromotionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.featureFlagService.createPromotion(companyId, {
      name: dto.name,
      overrides: dto.overrides,
      startsAt: dto.startsAt,
      expiresAt: dto.expiresAt,
      createdBy: user.userId,
    });
    await this.featureFlagService.invalidateCache(companyId);
  }
}
```

---

## 7. Caching Strategy

### 7.1 Cache Layers

| Layer | Technology | TTL | Invalidation Trigger |
|-------|------------|-----|---------------------|
| **L1: In-Memory** | `Map<string, ResolvedFeatureFlags>` (CompanyModule local) | 60 seconds | None (auto-expire) |
| **L2: Redis** | `feature-flags:{companyId}` | 300 seconds (5 min) | Plan change, override change, subscription status change |
| **L3: Database** | PostgreSQL (raw evaluation) | N/A | Manual refresh |

### 7.2 Cache Invalidation Events

```typescript
@OnEvent('billing.subscription.changed')
async onSubscriptionChanged(event: SubscriptionChangedEvent): Promise<void> {
  await this.featureFlagService.invalidateCache(event.companyId);
}

@OnEvent('billing.subscription.cancelled')
async onSubscriptionCancelled(event: SubscriptionCancelledEvent): Promise<void> {
  await this.featureFlagService.invalidateCache(event.companyId);
}

@OnEvent('billing.subscription.expired')
async onSubscriptionExpired(event: SubscriptionExpiredEvent): Promise<void> {
  await this.featureFlagService.invalidateCache(event.companyId);
}

// Called directly when admin modifies overrides
async setOverride(companyId: string, override: CreateOverrideDto): Promise<void> {
  await this.prismaService.$transaction(async (tx) => {
    await this.overrideRepository.create(companyId, override, tx);
    // Cache is invalidated AFTER transaction commits
  });
  // Invalidate after successful commit
  await this.featureFlagService.invalidateCache(companyId);
}
```

### 7.3 Cache Warm-Up

```typescript
// On application startup, warm cache for active companies
@OnApplicationBootstrap()
async warmCache(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;

  const activeCompanies = await this.subscriptionRepository.findActiveCompanies();
  const batchSize = 100;

  for (let i = 0; i < activeCompanies.length; i += batchSize) {
    const batch = activeCompanies.slice(i, i + batchSize);
    await Promise.all(
      batch.map(c => this.featureFlagService.getResolvedFlags(c.companyId)),
    );
  }

  this.logger.log(`Warmed feature flag cache for ${activeCompanies.length} companies`);
}
```

---

## 8. API Design

### 8.1 Public Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/billing/features` | Get all features for current company | `JwtAuthGuard`, `billing:read` |
| `GET` | `/api/billing/features/:key` | Check specific feature | `JwtAuthGuard`, `billing:read` |
| `GET` | `/api/billing/limits` | Get all limits for current company | `JwtAuthGuard`, `billing:read` |

### 8.2 Admin Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/admin/billing/features/:companyId` | Get features for any company | `admin:billing` |
| `POST` | `/api/admin/companies/:companyId/features/overrides` | Create override | `admin:billing` |
| `GET` | `/api/admin/companies/:companyId/features/overrides` | List overrides | `admin:billing` |
| `DELETE` | `/api/admin/companies/:companyId/features/overrides/:id` | Remove override | `admin:billing` |
| `POST` | `/api/admin/companies/:companyId/features/promotions` | Create promotion | `admin:billing` |
| `POST` | `/api/admin/features/cache/flush` | Flush entire feature cache | `admin:billing` |

### 8.3 Response Format

```typescript
// GET /api/billing/features
{
  "booleanFeatures": {
    "inventory.basic": true,
    "inventory.advanced": true,
    "inventory.batches": false,
    // ... all boolean features
  },
  "limits": {
    "limits.users": 10,
    "limits.warehouses": 5,
    "limits.products": 5000,
    // ... all limits
  },
  "config": {
    "config.theme": "#1890ff",
    "config.default_language": "en",
    // ... all config
  }
}

// GET /api/billing/features/inventory.batches
{
  "key": "inventory.batches",
  "enabled": false,
  "source": "plan",
  "plan": "starter",
  "upgradeRequired": true,
  "upgradeTo": "business"
}

// GET /api/billing/limits
{
  "usage": {
    "limits.users": { "limit": 10, "current": 5, "remaining": 5 },
    "limits.sales_month": { "limit": 10000, "current": 2341, "remaining": 7659 },
    "limits.storage_mb": { "limit": 10000, "current": 452, "remaining": 9548 }
  }
}
```

### 8.4 Client-Side Usage

```typescript
// Frontend: check feature before rendering
const features = await api.get('/api/billing/features');
if (features.booleanFeatures['reports.advanced']) {
  renderAdvancedReportsTab();
} else {
  renderUpgradeBanner('Unlock Advanced Reports with the Business plan');
}
```

---

## 9. Integration Patterns

### 9.1 Decorator for Endpoint Guarding

```typescript
// Custom decorator: @RequiresFeature('inventory.batches')
export const RequiresFeature = (featureKey: string) =>
  applyDecorators(
    SetMetadata('feature:key', featureKey),
  );

// Guard that checks the feature flag
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<string>('feature:key', context.getHandler());
    if (!featureKey) return true;

    const request = context.switchToHttp().getRequest();
    const companyId = request.user?.companyId;
    if (!companyId) return false;

    const enabled = await this.featureFlagService.isEnabled(companyId, featureKey);
    if (!enabled) {
      throw new ForbiddenException(`This feature requires an upgrade. Feature: ${featureKey}`);
    }

    return true;
  }
}

// Usage in controller
@Post('batches')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
@RequiresFeature('inventory.batches')
@RequirePermission('inventory:create')
async createBatch(@Body() dto: CreateBatchDto): Promise<BatchEntity> {
  return this.batchService.create(dto);
}
```

### 9.2 Limit Guard

```typescript
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limitKey = this.reflector.get<string>('quota:key', context.getHandler());
    if (!limitKey) return true;

    const request = context.switchToHttp().getRequest();
    const companyId = request.user.companyId;
    const limit = await this.featureFlagService.getLimit(companyId, limitKey);

    if (limit === -1) return true; // Unlimited
    if (limit === 0) throw new ForbiddenException('This feature is not available on your plan');

    // Call service to check current usage
    const current = await this.usageTrackingService.getCurrent(companyId, limitKey);
    if (current >= limit) {
      throw new ForbiddenException(
        `Limit reached: ${limitKey} (${current}/${limit}). Upgrade to increase.`,
      );
    }

    return true;
  }
}

// Usage
@Post()
@UseGuards(JwtAuthGuard, RolesGuard, QuotaGuard)
@SetMetadata('quota:key', 'limits.products')
async createProduct(@Body() dto: CreateProductDto): Promise<ProductEntity> {
  return this.productService.create(dto);
}
```

### 9.3 Service-Level Check

```typescript
// For business logic that needs to check features
@Injectable()
export class SalesService {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  async createSale(dto: CreateSaleDto, companyId: string): Promise<SaleEntity> {
    // Check quota
    const limit = await this.featureFlagService.getLimit(companyId, 'limits.sales_month');
    const current = await this.salesRepository.countMonth(companyId);
    if (limit !== -1 && current >= limit) {
      throw new ForbiddenException('Monthly sales limit reached. Upgrade plan.');
    }

    // Check feature
    const canUseLoyalty = await this.featureFlagService.isEnabled(companyId, 'crm.loyalty');
    if (dto.loyaltyPoints > 0 && !canUseLoyalty) {
      throw new ForbiddenException('Loyalty program requires plan upgrade.');
    }

    return this.createSaleInternal(dto, companyId);
  }
}
```

### 9.4 Frontend Integration

```typescript
// React hook for feature flags
function useFeatureFlag(key: string): {
  enabled: boolean;
  loading: boolean;
  source: 'plan' | 'override' | 'trial';
} {
  const { data, loading } = useQuery('/api/billing/features');
  return {
    enabled: data?.booleanFeatures[key] ?? false,
    loading,
    source: data?.sources?.[key] ?? 'plan',
  };
}

// Usage
function InventoryPanel() {
  const batches = useFeatureFlag('inventory.batches');
  const expiry = useFeatureFlag('inventory.expiry');

  return (
    <div>
      {batches.enabled && <BatchTrackingPanel />}
      {expiry.enabled && <ExpiryTrackingPanel />}
      {!batches.enabled && (
        <UpgradeBanner feature="Batch Tracking" plan="Business" />
      )}
    </div>
  );
}
```

### 9.5 Event-Driven Cache Invalidation

```typescript
// Events that trigger cache invalidation
@Injectable()
export class FeatureFlagCacheInvalidator {
  constructor(private readonly cacheService: CacheService) {}

  @OnEvent('billing.subscription.changed')
  async onSubscriptionChanged(event: SubscriptionChangedEvent): Promise<void> {
    await this.cacheService.del(`feature-flags:${event.companyId}`);
  }

  @OnEvent('billing.subscription.cancelled')
  async onCancelled(event: SubscriptionCancelledEvent): Promise<void> {
    await this.cacheService.del(`feature-flags:${event.companyId}`);
  }

  @OnEvent('billing.subscription.expired')
  async onExpired(event: SubscriptionExpiredEvent): Promise<void> {
    await this.cacheService.del(`feature-flags:${event.companyId}`);
  }

  // Called directly by admin override endpoints
  async invalidateCompany(companyId: string): Promise<void> {
    await this.cacheService.del(`feature-flags:${companyId}`);
  }

  // Emergency: flush ALL feature flag caches
  async flushAll(): Promise<void> {
    await this.cacheService.delByPattern('feature-flags:*');
  }
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Test | Description |
|------|-------------|
| `should load plan defaults` | Verify plan JSON is parsed correctly |
| `should apply company override` | Override `inventory.batches` to `true` |
| `should apply trial full access` | All features enabled during trial |
| `should apply promotion as highest priority` | Promotion overrides plan and override |
| `should fall back to global default` | Feature not in plan JSON uses default |
| `should handle missing feature key` | Graceful fallback to `false` |
| `should return correct limit values` | Verify limit values at each plan tier |
| `should cache resolved flags` | Second call returns cached value |
| `should invalidate cache on event` | Cache cleared after subscription change |

### 10.2 Integration Tests

| Test | Description |
|------|-------------|
| `free plan has correct limits` | `limits.products` = 50 |
| `starter plan has multi_warehouse disabled` | `inventory.multi_warehouse` = `false` |
| `business plan has all features` | 80+ boolean features enabled |
| `enterprise plan has unlimited limits` | All limits = -1 |
| `override + plan: override wins` | Admin override takes precedence |
| `trial + override: override wins on explicit` | Admin can limit during trial |
| `promotion + override: promotion wins` | Temporary promotion > permanent override |
| `concurrent plan change + feature check` | Cache invalidated after plan change |
| `cache miss → evaluate → store` | Full pipeline on cold start |
| `cache warm-up on startup` | 100 companies cached on bootstrap |

### 10.3 Performance Tests

| Test | Target |
|------|--------|
| Cache hit latency | `< 5ms` |
| Cache miss evaluation | `< 50ms` (per company) |
| Concurrent evaluation (1000 companies) | `< 500ms` |
| Cache invalidation (1000 keys) | `< 100ms` |
| Memory per cached company | `< 2KB` |
| Redis memory for 10,000 companies | `< 20MB` |
