# 🔌 StockFlow Enterprise — Extension Points v1.0

**Status:** ✅ FROZEN  
**Date:** July 26, 2026  

This document defines every official extension point in the StockFlow platform — documented locations where new modules may integrate without violating the frozen architecture.

---

## Table of Contents

1. [How to Use Extension Points](#1-how-to-use-extension-points)
2. [Event-Based Extension Points](#2-event-based-extension-points)
3. [Repository Extension Points](#3-repository-extension-points)
4. [API Extension Points](#4-api-extension-points)
5. [Infrastructure Extension Points](#5-infrastructure-extension-points)
6. [Module-Specific Extension Points](#6-module-specific-extension-points)
7. [Forbidden Extension Points](#7-forbidden-extension-points)
8. [Extension Point Registry](#8-extension-point-registry)

---

## 1. How to Use Extension Points

### 1.1 Principles

1. **Extension modules are bounded contexts** — they own their data and logic
2. **Extensions communicate via EventBus** — never call other modules' services directly
3. **Extensions may read from existing repositories** — if the existing module exports its repository
4. **Extensions may NOT modify existing tables** — create new tables in the extension's schema
5. **Extensions may NOT modify existing code** — all integration is through documented extension points
6. **Extensions must follow ALL ADRs** — repository pattern, OL, multi-tenancy, RBAC, audit, events

### 1.2 Extension Module Template

```typescript
@Module({
  imports: [
    SharedModule,     // PrismaService, AuditLogService, EventBusModule
    AuthModule,       // JwtAuthGuard, JwtStrategy
    RbacModule,       // RolesGuard, @RequirePermission()
  ],
  controllers: [ExtensionController],
  providers: [
    ExtensionService,
    ExtensionRepository,
    ExtensionMapper,
    // Event handlers
    { provide: EVENT_BUS, useExisting: EventBus },
  ],
})
export class ExtensionModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly eventHandler: ExtensionEventHandler,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe('sale.completed', this.eventHandler);
  }
}
```

---

## 2. Event-Based Extension Points

### 2.1 Currently Published Events (Subscribable)

| Event | When | Payload | Transaction Context | Use Case |
|-------|------|---------|-------------------|----------|
| `sale.completed` | Sale transitions to COMPLETED | `{ saleId, companyId, saleNumber, total, paidAmount, items[], payments[] customerId?, warehouseId, cashierId }` | ✅ Yes | Inventory deduction, Finance journal, AI predictions, Customer loyalty, Notifications, Analytics |
| `sale.refunded` | Sale transitions to REFUNDED or PARTIALLY_REFUNDED | `{ saleId, companyId, items[], reason? }` | ✅ Yes | Inventory restoration, Finance reversal, Customer loyalty rollback |
| `purchase.received` | Goods receipt completed | `{ goodsReceiptId, purchaseOrderId, companyId, items[], warehouseId }` | ✅ Yes | Stock increase, Cost layer creation, Supplier performance |
| `purchase.order.created` | Purchase order submitted | `{ purchaseOrderId, companyId, supplierId, total, items[] }` | ✅ Yes | Finance AP entry, Supplier analytics, Budget tracking |
| `inventory.adjusted` | Stock manually adjusted | `{ stockId, productId, warehouseId, companyId, previousQuantity, newQuantity, reason }` | ✅ Yes | Finance adjustment journal, AI anomaly detection |
| `inventory.transferred` | Stock moved between warehouses | `{ transferId, productId, fromWarehouse, toWarehouse, quantity, companyId }` | ✅ Yes | Finance (if transfer cost tracked), Warehouse analytics |
| `customer.created` | New customer registered | `{ customerId, companyId, type, name?, email? }` | ✅ Yes | CRM, Marketing, Loyalty enrollment |
| `customer.updated` | Customer data modified | `{ customerId, companyId, changes }` | ✅ Yes | CRM sync, Audit |
| `customer.deleted` | Customer soft-deleted | `{ customerId, companyId }` | ✅ Yes | CRM cleanup |

### 2.2 Future Events (Planned — Not Yet Published)

| Event | Planned Version | Status |
|-------|----------------|--------|
| `payment.received` | Phase 7.2 | 🚧 Not implemented |
| `payment.failed` | Phase 7.2 | 🚧 Not implemented |
| `journal.posted` | Phase 7.4 | 🚧 Not implemented |
| `period.closed` | Phase 7.4 | 🚧 Not implemented |
| `inventory.reserved` | Phase 7.3 | 🚧 Not implemented |
| `purchase.order.approved` | Phase 7.3 | 🚧 Not implemented |
| `purchase.returned` | Phase 7.3 | 🚧 Not implemented |

### 2.3 Subscribing to Events

```typescript
// 1. Create event handler
@Injectable()
export class MyExtensionHandler implements EventHandler<SaleCompletedEvent> {
  async handle(event: SaleCompletedEvent): Promise<void> {
    // event.payload contains the typed data
    // Access transaction context if available:
    const tx = (event as any).context?.transactionClient;
    // Business logic here
  }
}

// 2. Register in module
@Module({ ... })
export class MyExtensionModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly handler: MyExtensionHandler,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe('sale.completed', this.handler);
  }
}
```

---

## 3. Repository Extension Points

### 3.1 Reports Module — Read-Only Access

The Reports module is the ONLY module that may read from other modules' repositories. New extension modules that need reporting/analytics functionality should use this pattern.

**How to extend:**
1. Create a new repository in your extension module
2. Import the existing module's repository (if exported)
3. Use read-only methods (findAll, findById, aggregate, groupBy)
4. Never mutate data through imported repositories

### 3.2 Cross-Module Read Access

Some repositories are exported for cross-module read access:

| Repository | Exported | Read-Only | Use Case |
|------------|----------|-----------|----------|
| SalesRepository | ❌ Not exported | — | Reports uses event data for aggregation |
| InventoryRepository | ❌ Not exported | — | Reports uses Prisma aggregates directly |
| FinanceRepository | ❌ Not exported | — | Reports uses Prisma aggregates directly |
| CustomerRepository | ❌ Not exported | — | Reports uses Prisma aggregates directly |

**Note:** Currently, no repositories are exported for cross-module read access. The Reports module accesses PrismaService directly for aggregation queries (as a documented exception). Future extensions needing read access should follow the Reports pattern (read-only Prisma queries) or request new event payloads.

---

## 4. API Extension Points

### 4.1 New Module REST Endpoints

New modules may add REST endpoints under the `/api/` prefix:

```typescript
@Controller('my-extension')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('My Extension')
export class MyExtensionController {
  // Standard CRUD endpoints
  // Follow same pattern as existing controllers
}
```

### 4.2 Admin Endpoints

Admin-only endpoints use `/admin/` prefix:

```typescript
@Controller('admin/my-extension')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission('admin:my-extension')
@ApiTags('Admin — My Extension')
export class AdminMyExtensionController {
  // Admin-only operations
}
```

### 4.3 Webhook Endpoints

External webhooks (payment providers, external integrations):

```typescript
@Controller('webhooks')
@SkipThrottle()
@ApiTags('Webhooks')
export class WebhookController {
  @Post('stripe')
  @Public()  // No JWT — verified via webhook signature
  async handleStripeWebhook(@Body() body: unknown, @Headers('stripe-signature') signature: string) {
    // Verify signature, process event
  }
}
```

---

## 5. Infrastructure Extension Points

### 5.1 Health Checks

New modules may register health indicators:

```typescript
@Injectable()
export class MyExtensionHealthIndicator implements HealthIndicator {
  async isHealthy(): Promise<HealthCheckResult> {
    // Check connection, queue, etc.
    return { status: 'up' };
  }
}
```

### 5.2 Metrics

New modules may expose Prometheus metrics:

```typescript
@Injectable()
export class MyExtensionMetrics {
  private readonly counter = new Counter({
    name: 'my_extension_operations_total',
    help: 'Total operations in my extension',
    labelNames: ['status'],
  });

  recordOperation(status: string): void {
    this.counter.inc({ status });
  }
}
```

### 5.3 Cache

New modules may use CacheService for performance:

```typescript
@Injectable()
export class MyExtensionService {
  constructor(private readonly cacheService: CacheService) {}

  async getData(companyId: string): Promise<Data> {
    return this.cacheService.getOrSet(
      `my-ext:${companyId}`,
      () => this.repository.findData(companyId),
      300, // TTL in seconds
    );
  }
}
```

### 5.4 Audit Log

All modules MUST use `AuditLogService` for mutations:

```typescript
// Standard audit pattern
await this.auditLogService.log({
  companyId,
  userId,
  entity: 'MyEntity',
  entityId: entity.id,
  action: 'COMPLETED',
  oldValues: { ... },
  newValues: { ... },
}, tx);  // Always pass transaction client
```

---

## 6. Module-Specific Extension Points

### 6.1 AI Module — Extension Point

**Event subscriptions planned:**

| Event | AI Use |
|-------|--------|
| `sale.completed` | Update sales forecast model |
| `purchase.received` | Update inventory forecast model |
| `inventory.adjusted` | Trigger low-stock detection |
| `inventory.transferred` | Update warehouse demand models |
| `customer.created` | Initialize customer prediction model |

**New Prisma models allowed:**
- `AiPrediction` — forecast results
- `AiConversation` — NLP chat sessions
- `AiMessage` — individual messages

**API endpoints allowed:**
- `GET /api/ai/predictions/:type` — get predictions
- `POST /api/ai/chat` — natural language query
- `GET /api/ai/insights` — business insights

### 6.2 Notifications Module — Extension Point

**Event subscriptions planned:**

| Event | Notification Trigger |
|-------|---------------------|
| `sale.completed` | Receipt notification to customer |
| `purchase.received` | Stock update notification |
| `inventory.adjusted` | Low stock alert |
| `inventory.transferred` | Transfer confirmation |
| `period.closed` | Financial period summary |

**New Prisma models allowed:**
- `Notification` — notification records
- `NotificationTemplate` — message templates
- `NotificationChannel` — email/SMS/push config

**API endpoints allowed:**
- `GET /api/notifications` — list notifications
- `PATCH /api/notifications/:id/read` — mark as read
- `POST /api/notifications/preferences` — user preferences

### 6.3 Marketplace Module — Extension Point

**Future publication events:**

| Event | Marketplace Use |
|-------|----------------|
| `product.created` | List product on marketplace |
| `product.updated` | Update marketplace listing |
| `inventory.adjusted` | Sync inventory levels |
| `sale.completed` | Record marketplace sale |

### 6.4 POS Module — Extension Point

The existing Sales module already supports POS operations. Future POS-specific extensions may:
- Add payment methods (via `PaymentMethod` enum extension)
- Add receipt templates (via `Receipt` model)
- Add barcode scanning integration (via existing `ProductBarcode` model)

### 6.5 Analytics Module — Extension Point

**Consumes all published events for:**
- Real-time dashboards
- Historical trend analysis
- Anomaly detection
- Customer segmentation

### 6.6 Accounting Integrations — Extension Point

**Existing Finance module supports:**
- Chart of Accounts (extendable)
- Journal Entries (extendable)
- Financial Periods (extendable)

**External accounting integration points:**
- Export journal entries (via API or scheduled export)
- Import chart of accounts
- Sync financial periods

### 6.7 Payments Module — Extension Point

**Existing:**
- `PaymentMethod` enum (CASH, CARD, QR, BANK_TRANSFER, GIFT_CARD, STORE_CREDIT)
- `Payment` model linked to Sales
- `Invoice` model (planned — Phase 7.2)

**Extension points:**
- Add new payment methods (extend enum, add provider-specific handlers)
- Payment gateway webhook endpoints
- Payment reconciliation

---

## 7. Forbidden Extension Points

### 7.1 MUST NOT Violate

```
❌ Extensions must NOT modify existing module files (controllers, services, repositories)
❌ Extensions must NOT add columns to existing tables (create extension tables with FK instead)
❌ Extensions must NOT call existing module services directly
❌ Extensions must NOT bypass EventBus for cross-module communication
❌ Extensions must NOT import from another business module (services, repositories, entities)
❌ Extensions must NOT modify the EventBus implementation (InMemoryEventBus is frozen)
❌ Extensions must NOT modify RBAC (existing permissions freeze)
❌ Extensions must NOT inject PrismaService directly — use repositories
❌ Extensions must NOT modify existing API contracts
❌ Extensions must NOT modify existing DTO schemas
```

### 7.2 MUST Maintain

```
✅ Extensions MUST follow the Controller → Service → Repository → Mapper → Entity pattern
✅ Extensions MUST implement JwtAuthGuard + RolesGuard + @RequirePermission() on all endpoints
✅ Extensions MUST filter companyId in every query
✅ Extensions MUST accept tx?: Prisma.TransactionClient in repositories
✅ Extensions MUST use optimistic locking (updateMany + rowVersion) for mutations
✅ Extensions MUST create audit logs inside transactions
✅ Extensions MUST register in app.module.ts
✅ Extensions MUST document their event subscriptions in event-catalog.md
✅ Extensions MUST update module-contracts.md if they publish events
✅ Extensions MUST pass the Architecture Compliance Checklist
```

---

## 8. Extension Point Registry

### 8.1 Registered Extension Points

| Extension Point ID | Type | Module Exposing | Status | Documentation |
|-------------------|------|----------------|--------|---------------|
| `EP-EVENT-001` | Event | `sale.completed` | ✅ Active | `event-catalog.md` |
| `EP-EVENT-002` | Event | `sale.refunded` | ✅ Active | `event-catalog.md` |
| `EP-EVENT-003` | Event | `purchase.received` | ✅ Active | `event-catalog.md` |
| `EP-EVENT-004` | Event | `inventory.adjusted` | ✅ Active | `event-catalog.md` |
| `EP-EVENT-005` | Event | `customer.created` | ✅ Active | `event-catalog.md` |
| `EP-EVENT-006` | Event | `customer.updated` | ✅ Active | `event-catalog.md` |
| `EP-EVENT-007` | Event | `customer.deleted` | ✅ Active | `event-catalog.md` |
| `EP-REPO-001` | Repository | Reports (read-only) | ✅ Active | `module-contracts.md` |
| `EP-API-001` | API | `/api/*` | ✅ Active | `development-guidelines.md` |
| `EP-API-002` | API | `/admin/*` | ✅ Active | `development-guidelines.md` |
| `EP-API-003` | API | `/webhooks/*` | ✅ Active | `development-guidelines.md` |
| `EP-INFRA-001` | Infrastructure | Health checks | ✅ Active | `adr-002-event-driven-architecture.md` |
| `EP-INFRA-002` | Infrastructure | Metrics | ✅ Active | `architecture-freeze-v1.md` |
| `EP-INFRA-003` | Infrastructure | Cache (CacheService) | ⚠️ Experimental | `development-guidelines.md` |
| `EP-AUDIT-001` | Infrastructure | AuditLogService | ✅ Active | `adr-009-audit-logging.md` |
| `EP-EVENTS-FUTURE-001` | Event | `journal.posted` | 🚧 Planned | `event-catalog.md` |
| `EP-EVENTS-FUTURE-002` | Event | `period.closed` | 🚧 Planned | `event-catalog.md` |
| `EP-MODULE-AI` | Module | AI Assistant | 🚧 Future | `extension-points.md` §6.1 |
| `EP-MODULE-NOTIF` | Module | Notifications | 🚧 Future | `extension-points.md` §6.2 |
| `EP-MODULE-MARKET` | Module | Marketplace | 🚧 Future | `extension-points.md` §6.3 |
| `EP-MODULE-ANALYTICS` | Module | Analytics | 🚧 Future | `extension-points.md` §6.5 |
| `EP-MODULE-PAYMENTS` | Module | Payments | 🚧 Future | `extension-points.md` §6.7 |

### 8.2 Requesting a New Extension Point

To request a new extension point:

1. Create an ADR documenting the need
2. Specify the event payload (if event), endpoint (if API), or infrastructure requirement
3. Submit for Architecture Board review
4. If approved: update this document and implement
