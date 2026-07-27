# 🏛️ StockFlow Enterprise — Architecture Freeze v1.0

**Status:** ✅ FROZEN — No architectural changes permitted without Architecture Board approval  
**Date:** July 26, 2026  
**Version:** 1.0  
**Supersedes:** All previous architecture documents (ADR-001 through ADR-010, Coding Standards v1.0, Module Contracts v1.0)  

---

## Table of Contents

1. [Freeze Declaration](#1-freeze-declaration)
2. [Architecture Overview](#2-architecture-overview)
3. [Module Dependency Graph](#3-module-dependency-graph)
4. [Public Module Contracts](#4-public-module-contracts)
5. [Repository Contracts](#5-repository-contracts)
6. [Service Contracts](#6-service-contracts)
7. [EventBus Contracts](#7-eventbus-contracts)
8. [DTO Compatibility Rules](#8-dto-compatibility-rules)
9. [Migration Rules](#9-migration-rules)
10. [API Compatibility Rules](#10-api-compatibility-rules)
11. [Stable APIs](#11-stable-apis)
12. [Deprecated APIs](#12-deprecated-apis)
13. [Architecture Compliance Checklist](#13-architecture-compliance-checklist)

---

## 1. Freeze Declaration

### 1.1 What Is Frozen

The following architectural decisions are **frozen and may not be changed** without a formal Architecture Decision Record (ADR) approved by the Architecture Board:

| Component | Frozen Since | ADR Reference |
|-----------|-------------|----------------|
| Repository Pattern | v1.0 | ADR-001 |
| Event-Driven Architecture (InMemoryEventBus) | v1.0 | ADR-002 |
| Prisma ORM as sole data-access layer | v1.0 | ADR-003 |
| PostgreSQL as sole database engine | v1.0 | ADR-004 |
| Shared-database multi-tenancy via companyId | v1.0 | ADR-005 |
| Soft delete via deletedAt timestamp | v1.0 | ADR-006 |
| Optimistic locking via rowVersion + updateMany | v1.0 | ADR-007 |
| RBAC with permission-level granularity | v1.0 | ADR-008 |
| Structured audit logging inside transactions | v1.0 | ADR-009 |
| Interactive Prisma $transaction with tx propagation | v1.0 | ADR-010 |
| Controller → Service → Repository → Mapper → Entity | v1.0 | ADR-001 |
| Multi-module modular monolith (not microservices) | v1.0 | ADR-001 |

### 1.2 What Is NOT Frozen

| Component | Reason |
|-----------|--------|
| Individual module implementations | Feature development continues |
| DTO validation rules | Can be added/strengthened |
| Swagger documentation | Must be maintained |
| Test coverage | Can be improved |
| Performance optimizations | Can be added within frozen architecture |
| Cache implementation | May be connected (currently dead code) |
| New modules | New bounded contexts may be added via extension points |

### 1.3 Freeze Change Process

To propose a change to a frozen architectural decision:

1. Create ADR documenting context, problem, and proposed solution
2. Submit for Architecture Board review
3. Board votes within 5 business days
4. If approved: update freeze document, migrate codebase within 2 sprints
5. If rejected: document reason in ADR

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           HTTP / HTTPS                                   │
│                              │                                            │
│                         ┌────▼────┐                                      │
│                         │  Nginx  │  (reverse proxy, SSL termination)     │
│                         └────┬────┘                                      │
│                              │                                            │
│          ┌───────────────────┼───────────────────┐                       │
│          │                   │                   │                       │
│    ┌─────▼─────┐      ┌─────▼─────┐      ┌─────▼─────┐                  │
│    │   Auth     │      │  Business  │      │  Health    │                 │
│    │  Guards    │      │  Modules   │      │  Endpoints │                 │
│    │ (JWT+RBAC) │      │           │      │            │                 │
│    └─────┬─────┘      └─────┬─────┘      └───────────┘                  │
│          │                   │                                            │
│          │         ┌─────────▼─────────┐                                 │
│          │         │     EventBus       │                                 │
│          │         │ (InMemoryEventBus) │                                 │
│          │         └─────────┬─────────┘                                 │
│          │                   │                                            │
│          │         ┌─────────▼─────────┐                                 │
│          └─────────►   PostgreSQL       │                                 │
│                    │   (Prisma ORM)     │                                 │
│                    └─────────┬─────────┘                                 │
│                              │                                            │
│                    ┌─────────▼─────────┐                                 │
│                    │      Redis         │                                 │
│                    │  (Cache + Queue)   │                                 │
│                    └───────────────────┘                                  │
│                                                                           │
│  Cross-cutting:  OpenTelemetry  │  Prometheus  │  Audit Log  │  Rate Limit│
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Layer Architecture

```
Request ──► Controller ──► Service ──► Repository ──► Prisma
                │              │            │
                │              │            └── Optional tx?: TransactionClient
                │              │
                │              ├── Mapper (Prisma → Entity)
                │              │
                │              ├── EventBus.publish(event, { context: { tx } })
                │              │
                │              └── AuditLogService.log({ ... }, tx)
                │
                └── DTO (class-validator + @ApiProperty)
```

---

## 3. Module Dependency Graph

### 3.1 Current Modules

```
                    ┌──────────────────┐
                    │      Auth        │
                    │  JwtAuthGuard    │
                    │  JwtStrategy     │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐  ┌─────▼──────┐  ┌────▼────────┐
     │    RBAC      │  │   Users    │  │   Health    │
     │ RolesGuard   │  │  Service   │  │  Check      │
     │ @RequirePerm │  │            │  │             │
     └────────┬─────┘  └────────────┘  └─────────────┘
              │
    ┌─────────┼─────────┬──────────┬──────────┬──────────┐
    │         │         │          │          │          │
 ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
 │Sales │ │Finance│ │Inv.  │ │Purch. │ │Cust.  │ │Supp.  │
 │Module│ │Module │ │Module│ │Module │ │Module │ │Module │
 └──┬───┘ └──┬───┘ └──┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
    │        │        │         │         │         │
    └────────┴────────┴─────────┴─────────┴─────────┘
                         │
                   ┌─────▼─────┐
                   │  Reports  │  ← reads from ALL repositories (read-only)
                   │  Module   │
                   └───────────┘
```

### 3.2 Dependency Rules (Mandatory)

| Rule | Description | Violation Severity |
|------|-------------|-------------------|
| **D1** | No business module depends on another business module | 🔴 Critical |
| **D2** | Cross-module write communication occurs ONLY through EventBus | 🔴 Critical |
| **D3** | Reports module may read from any repository (read-only) | 🟢 Allowed |
| **D4** | RBAC module is depended upon by ALL modules | 🟢 Required |
| **D5** | SharedModule provides PrismaService, AuditLogService, RedisService | 🟢 Required |
| **D6** | No module (except Reports) may import another module's repository | 🔴 Critical |
| **D7** | No module may import another module's service | 🔴 Critical |
| **D8** | EventBus module is @Global() — not imported by business modules | 🟢 Required |
| **D9** | No circular dependencies (enforced by madge in CI) | 🔴 Critical |
| **D10** | Infrastructure modules (Auth, RBAC) never depend on business modules | 🔴 Critical |

---

## 4. Public Module Contracts

### 4.1 Auth Module

**Token:** `AuthModule`  
**Export:** `JwtAuthGuard`, `JwtStrategy`, `AuthService`

```
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/refresh
// POST /api/auth/logout
// POST /api/auth/register   (company creation + admin user)
```

### 4.2 RBAC Module

**Token:** `RbacModule`  
**Exports:** `RolesGuard`, `@RequirePermission()` decorator

### 4.3 Shared Module

**Token:** `SharedModule`  
**Exports:** `PrismaService`, `AuditLogService`, `CacheService`, `EventBusModule`

### 4.4 All Business Modules

Every business module (Sales, Finance, Inventory, Purchasing, Customers, Suppliers, Products, Users):

| Contract | Type | Description |
|----------|------|-------------|
| Module class | NestJS Module | `@Module({ imports, controllers, providers, exports })` |
| Controller(s) | REST endpoints | Protected by `JwtAuthGuard + RolesGuard + @RequirePermission()` |
| Service(s) | Business logic | Injectable, constructor-injected dependencies |
| Repository(ies) | Database access | Accepts `tx?: Prisma.TransactionClient` |
| Mapper(s) | Model → Entity | Stateless, no side effects |
| Entity(ies) | Data shape | Plain TypeScript classes or interfaces |
| DTO(s) | Input validation | `class-validator` + `@ApiProperty()` |
| Event(s) | Domain events | Published via EventBus, never imported by other modules |

---

## 5. Repository Contracts

### 5.1 Repository Method Signature Contract

Every repository mutation method MUST follow this signature pattern:

```typescript
async mutationMethod(
  requiredParams: ...,        // Business-specific parameters
  companyId: string,          // Always required for tenant isolation
  rowVersion?: number,        // Optional for update/delete (optimistic locking)
  tx?: Prisma.TransactionClient,  // Optional — last parameter
): Promise<PrismaModel>;
```

### 5.2 Standard Repository Methods

Every entity repository MUST implement:

| Method | Signature | Notes |
|--------|-----------|-------|
| `create` | `(data: PrismaCreateInput, tx?)` | No companyId in params (uses data relation) |
| `findAll` | `(params: { companyId, search?, page, limit, sortBy, sortOrder, ...filters })` | Returns `{ items: Model[], total: number }` |
| `findById` | `(id, companyId, tx?)` | Returns `Model | null` |
| `update` | `(id, data: PrismaUpdateInput, companyId, rowVersion?, tx?)` | Uses `updateMany` for OL |
| `softDelete` | `(id, companyId, rowVersion?, tx?)` | Sets `deletedAt`, uses `updateMany` for OL |

### 5.3 Repository Rules

```
✅ Accepts optional tx as last parameter
✅ Uses updateMany for updates (not update)
✅ Filters companyId in EVERY query
✅ Filters deletedAt: null in EVERY query on soft-deletable entities
✅ Throws ConflictException on optimistic locking failure
✅ Throws NotFoundException when record not found
✅ Returns raw Prisma types (never entities)
❌ Never contains business logic
❌ Never publishes events
❌ Never calls other repositories
❌ Never accesses HTTP context
❌ Never uses `as any`
```

---

## 6. Service Contracts

### 6.1 Service Method Contracts

Every service method that modifies data MUST:

1. Control the Prisma `$transaction` boundary
2. Pass `tx` to all repository calls
3. Pass `tx` to audit log calls
4. Pass `{ context: { transactionClient: tx } }` to EventBus

### 6.2 Standard Service Methods

| Method | Parameters | Return Type |
|--------|------------|-------------|
| `create` | `(dto: CreateDto, userId, companyId)` | `Entity` |
| `findAll` | `(query: QueryDto, userId, companyId)` | `{ items: Entity[], total, page, limit }` |
| `findById` | `(id, companyId)` | `Entity` |
| `update` | `(id, dto: UpdateDto, userId, companyId)` | `Entity` |
| `softDelete` | `(id, userId, companyId)` | `Entity` |

### 6.3 Service Rules

```
✅ Orchestrates business logic
✅ Controls $transaction boundaries
✅ Validates domain rules (status transitions, state machines)
✅ Publishes events via EventBus
✅ Creates audit logs inside the transaction
✅ Calls mappers for entity conversion
✅ Reads rowVersion before calling repository update methods
❌ Never accesses PrismaService directly
❌ Never calls other business module's services
❌ Never contains `as any`
❌ No method longer than 80 lines
```

---

## 7. EventBus Contracts

### 7.1 EventBus Interface

```typescript
interface EventBus {
  publish<T extends DomainEvent>(
    event: T,
    options?: PublishOptions,
  ): Promise<void>;

  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: EventHandler<T>,
  ): void;
}
```

### 7.2 DomainEvent Interface

```typescript
interface DomainEvent {
  eventName: string;       // Format: "<module>.<action>" (e.g., "sale.completed")
  eventId: string;         // UUID v4 (crypto.randomUUID())
  occurredOn: Date;
  payload: Record<string, unknown>;
}
```

### 7.3 EventHandler Interface

```typescript
interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}
```

### 7.4 PublishOptions

```typescript
interface PublishOptions {
  context?: {
    transactionClient?: Prisma.TransactionClient;
    [key: string]: unknown;
  };
}
```

### 7.5 EventBus Rules

```
✅ Events published via EventBus.publish()
✅ Handlers registered via EventBus.subscribe() in OnModuleInit
✅ Transaction context propagated via PublishOptions.context.transactionClient
✅ Handler errors propagate — no silent try/catch
✅ Handlers must be idempotent
✅ Event names follow "<module>.<action>" format
✅ EventId is UUID v4
❌ Never import another module's event class (use string eventName)
❌ Never call handlers directly — always through EventBus
❌ Never publish events outside a transaction
```

### 7.6 Current Event Registry

| Event | Publisher | Subscribers | Payload |
|-------|-----------|-------------|---------|
| `sale.completed` | Sales Service | Inventory (SaleCompletedEventHandler), Finance (SaleCompletedEventHandler) | `{ saleId, companyId, items[], payments[], customerId? }` |
| `sale.refunded` | Sales Service | Inventory (SaleRefundedEventHandler), Finance (SaleRefundedEventHandler) | `{ saleId, companyId, items[], reason? }` |
| `purchase.received` | Purchasing Service | Inventory (PurchaseReceivedEventHandler) | `{ purchaseOrderId, companyId, items[], warehouseId }` |
| `inventory.adjusted` | Inventory Service | Finance (InventoryFinanceHandler) | `{ productId, companyId, warehouseId, quantity, reason }` |

---

## 8. DTO Compatibility Rules

### 8.1 Naming Conventions

| Type | Format | Example |
|------|--------|---------|
| Create | `Create{Entity}Dto` | `CreateSaleDto` |
| Update | `Update{Entity}Dto` | `UpdateSaleDto` |
| Query | `{Entity}QueryDto` | `SaleQueryDto` |
| Response | `{Entity}ResponseDto` | `SaleResponseDto` (use Entity instead) |

### 8.2 Field Rules

```
✅ @IsOptional() on all Update DTO fields (PATCH semantics)
✅ @IsString(), @IsInt(), @IsDecimal() etc. on Create DTO required fields
✅ @ApiProperty() on every field for Swagger docs
✅ @Transform() for type coercion where needed
✅ Money fields: string type (never number)
✅ UUID fields: string type
✅ Date fields: string (ISO 8601) type
❌ Never accept companyId from DTO (from JWT only)
❌ Never accept rowVersion from DTO (from entity read)
❌ Never use any or object type
❌ Never use @IsOptional() on required Create DTO fields
```

### 8.3 Breaking Change Policy

| Change | Compatibility | Allowed? |
|--------|--------------|----------|
| Adding an optional field to a DTO | Backward compatible | ✅ Yes |
| Renaming a field | Breaking | ❌ No — deprecate old, add new |
| Removing a field | Breaking | ❌ No — deprecate first |
| Changing field type | Breaking | ❌ No — add new field |
| Adding a required field | Breaking (API change) | ❌ No — version endpoint |
| Relaxing validation | Backward compatible | ✅ Yes |
| Tightening validation | Breaking | ❌ No — announce deprecation |

---

## 9. Migration Rules

### 9.1 Prisma Migration Rules

```
✅ Every schema change starts with schema.prisma
✅ Run: npx prisma migrate dev --name <description>
✅ Review generated migration.sql before committing
✅ Rollback: npx prisma migrate reset (dev only)
✅ Production: npx prisma migrate deploy
❌ Never edit migration.sql manually — Prisma owns migrations
❌ Never add raw SQL migrations outside Prisma
```

### 9.2 Migration Compatibility Rules

| Operation | Compatible | Risk |
|-----------|------------|------|
| Adding a nullable column | ✅ Non-breaking | Low |
| Adding a non-nullable column with default | ✅ Non-breaking | Low |
| Adding a table | ✅ Non-breaking | None |
| Removing a column | ❌ Breaking | High — data loss |
| Removing a table | ❌ Breaking | High — data loss |
| Renaming a column | ❌ Breaking | High — needs migration script |
| Changing column type | ❌ Breaking | High — needs migration script |
| Adding an index | ✅ Non-breaking | Low |
| Adding a unique constraint | ⚠️ May break | Medium — existing duplicates |
| Adding an enum value | ✅ Non-breaking | Low (Prisma handles) |
| Removing an enum value | ❌ Breaking | High — existing data uses it |

### 9.3 Data Migration Rules

```
✅ Data migrations are in separate migration files
✅ Data migrations are idempotent (upsert, not insert)
✅ Run data migrations BEFORE schema migrations (if schema depends on data)
✅ Test migrations on a copy of production data
❌ Never run destructive migrations without Architecture Board approval
```

---

## 10. API Compatibility Rules

### 10.1 Versioning

StockFlow uses **URL prefix versioning** for breaking changes:

```
/api/sales              → v1 (current, default)
/api/v2/sales           → v2 (future)
```

### 10.2 Backward Compatibility Guarantees

```
✅ Add new endpoints freely
✅ Add optional query parameters
✅ Add optional fields to responses
✅ Extend enum values (never remove)
❌ Rename endpoints
❌ Remove endpoints (deprecate first)
❌ Change response structure
❌ Remove query parameters
❌ Change error codes
❌ Change HTTP status codes for the same scenario
```

### 10.3 Deprecation Policy

1. Mark deprecated endpoints with `@deprecated` JSDoc tag
2. Add `Deprecated` header to response: `Sunset: <date>`
3. Keep deprecated endpoints for minimum 3 months
4. Remove only after verifying zero usage in logs

### 10.4 Response Envelope

All list endpoints return:

```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

All error responses:

```json
{
  "statusCode": 404,
  "message": "Record not found",
  "error": "Not Found",
  "timestamp": "2026-07-26T12:00:00.000Z",
  "path": "/api/sales/123"
}
```

---

## 11. Stable APIs

| Module | Status | Stability Level |
|--------|--------|----------------|
| Auth module | ✅ Stable | Public |
| RBAC module | ✅ Stable | Public |
| Users module | ✅ Stable | Public |
| Products module | ✅ Stable | Public |
| Inventory module | ✅ Stable | Public |
| Customers module | ✅ Stable | Public |
| Suppliers module | ✅ Stable | Public |
| Sales module | ✅ Stable | Public |
| Purchasing module | ✅ Stable | Public |
| Finance module | ✅ Stable | Public |
| Reports module | ✅ Stable | Public |
| Health module | ✅ Stable | Public |
| EventBus | ✅ Stable | Internal |
| SharedModule (PrismaService) | ✅ Stable | Internal |
| SharedModule (AuditLogService) | ✅ Stable | Internal |
| CacheService | ⚠️ Experimental | Internal — not yet connected |
| Operations Dashboard | 🚧 Not implemented | Future |
| AI Module | 🚧 Not implemented | Future |
| Billing Module | 🚧 Not implemented | Future |
| Notifications | 🚧 Not implemented | Future |

### 11.1 Stability Definitions

| Level | Definition |
|-------|------------|
| **Stable** | Public contract is frozen. Breaking changes require 3-month deprecation + Architecture Board approval. |
| **Internal** | Used by the framework. May change between minor versions. Not exposed to external consumers. |
| **Experimental** | Under development. May change at any time without notice. |
| **Deprecated** | Will be removed. Use replacement specified in JSDoc. |
| **Not implemented** | Planned but not yet built. |

---

## 12. Deprecated APIs

| API | Deprecated Since | Replacement | Removal Date |
|-----|-----------------|-------------|--------------|
| (none currently) | | | |

---

## 13. Architecture Compliance Checklist

Every pull request MUST pass this checklist:

```
□ Controller does not access PrismaService or Repository
□ Service controls $transaction boundaries
□ Repository accepts optional tx parameter
□ Repository uses updateMany for mutations
□ Repository filters companyId in every query
□ Repository filters deletedAt: null (soft-deletable entities)
□ Service reads rowVersion before calling repository update
□ Service publishes events via EventBus (not direct calls)
□ Service creates audit logs inside the transaction
□ Mapper converts Prisma types → Entities
□ Mapper serializes Decimal to string
□ All endpoints have JwtAuthGuard + RolesGuard + @RequirePermission()
□ DTOs use class-validator decorators
□ DTOs use @ApiProperty() for Swagger
□ No cross-module imports (except Reports → repositories)
□ No `as any` in services
□ No methods longer than 80 lines
□ No unused imports
□ All tests pass (npm test)
□ TypeScript build passes (npm run build)
□ ESLint passes (npm run lint)
□ No circular dependencies (npx madge)
```
