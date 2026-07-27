# 🔄 StockFlow Enterprise — Compatibility Policy v1.0

**Status:** ✅ FROZEN  
**Date:** July 26, 2026  

---

## 1. Purpose

This document defines the compatibility contracts for all StockFlow platform components. Every developer, reviewer, and integrator must follow these rules to ensure backward compatibility, safe upgrades, and predictable API evolution.

---

## 2. API Compatibility

### 2.1 URL Structure

```
/api/{module}/{resource}[/{id}][/action]

Examples:
/api/sales                    — list sales
/api/sales/123                — get sale by ID
/api/sales/123/complete       — complete a sale
/api/sales/123/cancel         — cancel a sale
/api/sales/receipt/456        — get receipt by ID
/api/sales/next-number        — get next sale number
```

### 2.2 HTTP Methods

| Method | Semantics | Idempotent | Safe |
|--------|-----------|------------|------|
| `GET` | Retrieve resource(s) | ✅ Yes | ✅ Yes |
| `POST` | Create resource or execute action | ❌ No | ❌ No |
| `PATCH` | Partial update | ✅ Yes | ❌ No |
| `DELETE` | Soft-delete resource | ✅ Yes | ❌ No |

### 2.3 HTTP Status Codes

| Code | Usage | When |
|------|-------|------|
| `200 OK` | Successful GET, PATCH, DELETE, POST (with return body) | Always |
| `201 Created` | Successful POST (resource created) | Create operations |
| `204 No Content` | Successful DELETE (no return body) | Optional |
| `400 Bad Request` | Invalid input, illegal status transition, validation failure | class-validator errors, domain validation |
| `401 Unauthorized` | Missing or invalid JWT | JwtAuthGuard |
| `403 Forbidden` | JWT valid but insufficient permissions | RolesGuard |
| `404 Not Found` | Resource not found | findById returns null |
| `409 Conflict` | Optimistic locking failure | rowVersion mismatch |
| `429 Too Many Requests` | Rate limit exceeded | ThrottlerGuard |
| `500 Internal Server Error` | Unexpected server error | Global exception filter |

### 2.4 Backward Compatibility Guarantees

| Change | Compatible | Policy |
|--------|------------|--------|
| Adding a new endpoint | ✅ Backward compatible | Allowed without notice |
| Adding an optional query parameter | ✅ Backward compatible | Allowed without notice |
| Adding an optional field to response | ✅ Backward compatible | Allowed without notice |
| Adding a new enum value | ✅ Backward compatible | Allowed without notice |
| Extending pagination parameters | ✅ Backward compatible | Allowed without notice |
| Changing error message text | ✅ Backward compatible | Allowed without notice |
| Renaming an endpoint URL | ❌ Breaking | 3-month deprecation + migration guide |
| Removing an endpoint | ❌ Breaking | 3-month deprecation + migration guide |
| Removing a query parameter | ❌ Breaking | 3-month deprecation |
| Removing a response field | ❌ Breaking | 3-month deprecation |
| Changing response structure | ❌ Breaking | New API version |
| Changing HTTP status code | ❌ Breaking | New API version |
| Changing field type | ❌ Breaking | New API version |
| Renaming a field | ❌ Breaking | Add new field, deprecate old |
| Making an optional field required | ❌ Breaking | New API version |

### 2.5 Deprecation Policy

1. **Mark as deprecated:** Add `@deprecated` JSDoc tag to the controller method
2. **Announce:** Add `Deprecation` header to response:
   ```
   Deprecation: true
   Sunset: Sat, 26 Oct 2026 00:00:00 GMT
   ```
3. **Grace period:** Minimum 3 months from deprecation announcement
4. **Remove:** Only after verifying zero usage in API access logs for 30 days
5. **Migration guide:** Provide migration path to replacement in release notes

### 2.6 API Versioning

StockFlow uses **URL prefix versioning** for breaking changes:

```
/api/v1/sales    — current (stable)
/api/v2/sales    — future (breaking changes)
```

Versioning is introduced only when backward-incompatible changes are required. The default (unversioned) `/api/sales` always points to the latest stable version.

---

## 3. DTO Compatibility

### 3.1 DTO Field Rules

| Directive | Rule |
|-----------|------|
| **Adding fields** | New fields MUST be `@IsOptional()`. Never make existing optional fields required. |
| **Removing fields** | Deprecate field with `@deprecated JSDoc`. Keep for 3 months. Then remove in new API version. |
| **Renaming fields** | Add new field with new name, mark old field as `@deprecated`. Remove old after 3 months. |
| **Changing types** | Create new field with new type, deprecate old. Never change type of an existing field. |
| **Validation rules** | May be strengthened only if they become MORE permissive. Tightening validation is breaking. |
| **Default values** | Existing defaults must not change. New fields with defaults are fine. |
| **Enums** | New values may be added. Existing values must never be removed. |

### 3.2 DTO Structure Rules

```typescript
// ✅ CORRECT — backward-compatible evolution
class CreateSaleDto {
  @IsString()
  @ApiProperty()
  customerId: string;          // Original field

  @IsOptional()
  @IsString()
  @ApiProperty({ deprecated: true })
  legacyField?: string;        // Deprecated — removed in v2

  @IsOptional()
  @IsString()
  @ApiProperty()
  newField?: string;           // Added in v1.2 — backward compatible
}

// ❌ WRONG — breaking change
class CreateSaleDto {
  @IsString()
  @ApiProperty()
  customerId: string;          // Was optional in v1.0 → now required → BREAKING
}
```

### 3.3 Query DTO Rules

```typescript
// Every query DTO MUST support these fields:
class XxxQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty({ required: false, default: 1 })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiProperty({ required: false, default: 20 })
  limit?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  search?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, default: 'createdAt' })
  sortBy?: string;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  @ApiProperty({ required: false, default: 'desc' })
  sortOrder?: 'asc' | 'desc';
}
```

---

## 4. Migration Compatibility

### 4.1 Safe Migrations (Non-Breaking)

| Operation | SQL | Risk |
|-----------|-----|------|
| Add table | `CREATE TABLE` | None |
| Add nullable column | `ALTER TABLE ADD COLUMN ... NULL` | None (existing rows get NULL) |
| Add non-nullable column with default | `ALTER TABLE ADD COLUMN ... DEFAULT ... NOT NULL` | Low (table must be locked briefly) |
| Add index | `CREATE INDEX` | None (may slow writes slightly) |
| Add unique constraint | `CREATE UNIQUE INDEX` | Medium (fails if duplicates exist) |
| Add foreign key | `ALTER TABLE ADD CONSTRAINT ... FOREIGN KEY` | Low (validates existing data) |
| Extend varchar length | `ALTER TABLE ALTER COLUMN TYPE VARCHAR(NEW)` | Low (PostgreSQL allows) |
| Add enum value | `ALTER TYPE ... ADD VALUE` | None |

### 4.2 Risky Migrations

| Operation | Risk | Mitigation |
|-----------|------|------------|
| Add unique constraint on existing data | Medium — fails if duplicates exist | Clean data first, or use `NOT VALID` + validate later |
| Add NOT NULL to existing column | Medium — fails if NULLs exist | Backfill NULLs first |
| Change column type | High — may fail silently or lose precision | Add new column, migrate data, drop old column |
| Rename column | High — breaks all queries using old name | Add new column, dual-write, migrate, drop old |
| Drop column | High — data loss | Mark as deprecated first, remove in separate release |
| Drop table | High — data loss | Mark as deprecated, archive first, remove in separate release |

### 4.3 Migration Deployment Procedure

```
1. Review migration.sql in PR — ensure no destructive operations without Architecture Board approval
2. Test migration on staging with copy of production data
3. Run migration in production during maintenance window:
   a. Backup database
   b. Run: npx prisma migrate deploy
   c. Verify schema: npx prisma validate
   d. Run health check: GET /api/health
   e. Run smoke tests
4. Monitor error rates and response times for 30 minutes post-migration
5. Rollback plan: npx prisma migrate resolve --rolled-back <migration_name>
```

### 4.4 Zero-Downtime Migration Strategy

For breaking schema changes, use expand-migrate-contract pattern:

```
Phase 1 — Expand: Add new column (nullable)
  - Old code ignores new column
  - New code starts writing to both old and new columns

Phase 2 — Migrate: Backfill new column data
  - Run background job to populate new column from old column

Phase 3 — Contract: Make new column required
  - Switch reads to use new column
  - Add NOT NULL constraint to new column
  - Deploy code that reads from new column only

Phase 4 — Remove: Drop old column
  - Drop old column in a separate release (after 3 months)
```

---

## 5. EventBus Compatibility

### 5.1 Event Schema Compatibility

| Change | Compatible | Rules |
|--------|------------|-------|
| Adding a field to event payload | ✅ Backward compatible | Existing handlers ignore new fields |
| Removing a field from event payload | ❌ Breaking | Handlers may depend on removed field |
| Renaming a field | ❌ Breaking | Add new field, keep old field (deprecated) |
| Changing field type | ❌ Breaking | New event version |
| Adding a new event | ✅ Backward compatible | No effect on existing handlers |
| Removing an event | ❌ Breaking | Remove subscribers first, then stop publishing |
| Changing event name | ❌ Breaking | New event with new name |

### 5.2 Event Versioning

Events are versioned by event name:

```
sale.completed.v1    — original (frozen)
sale.completed.v2    — future (if breaking change needed)
```

Handlers subscribe to a specific version:

```typescript
this.eventBus.subscribe('sale.completed.v1', this.handlerV1);
this.eventBus.subscribe('sale.completed.v2', this.handlerV2);
```

### 5.3 Handler Contract

```typescript
// Every handler MUST:
interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
  // MUST be idempotent — same event delivered twice produces same result
  // MUST NOT silently swallow exceptions
  // MUST use transactionClient from context if available
  // MUST NOT publish events (infinite loop risk)
  // MUST NOT access HTTP context
}
```

### 5.4 Idempotency Requirement

All event handlers MUST be idempotent. The EventBus may deliver the same event multiple times (e.g., after a crash recovery or retry).

```typescript
// ✅ IDEMPOTENT — check before creating
async handle(event: SaleCompletedEvent): Promise<void> {
  const existing = await this.repository.findBySaleId(event.payload.saleId);
  if (existing) return; // Already processed — idempotent
  // Process...
}

// ❌ NOT IDEMPOTENT — creates duplicate records on retry
async handle(event: SaleCompletedEvent): Promise<void> {
  await this.repository.create({ saleId: event.payload.saleId }); // Creates duplicate!
}
```

---

## 6. Database Schema Compatibility

### 6.1 Model Rules

| Element | Compatible Change | Breaking Change |
|---------|-------------------|-----------------|
| Table | Adding a table is compatible | Removing a table is breaking |
| Column | Adding nullable column is compatible | Removing a column is breaking |
| Column type | Extending VARCHAR is compatible | Changing DECIMAL precision is breaking |
| Index | Adding index is compatible | Removing index may be breaking (performance) |
| Enum | Adding value is compatible | Removing value is breaking |
| Constraint | Adding is compatible | Removing is breaking |
| Relation | Adding optional relation is compatible | Removing relation is breaking |

### 6.2 Model Immutability

The following models are IMMUTABLE — no update or delete operations:

| Model | Reason |
|-------|--------|
| `AuditLog` | Legal compliance — must be append-only |
| `JournalEntry` (POSTED) | Accounting — posted entries cannot be changed |
| `JournalLine` (POSTED) | Accounting — posted entries cannot be changed |
| `StockMovement` | Inventory audit trail — every movement must be traceable |

### 6.3 Model Soft-Delete Rules

| Model | Soft Deletable | Restorable |
|-------|----------------|------------|
| Product | ✅ Yes | ✅ Yes |
| Customer | ✅ Yes | ✅ Yes |
| Supplier | ✅ Yes | ✅ Yes |
| User | ✅ Yes | ✅ Yes |
| Sale (DRAFT only) | ✅ Yes | ✅ Yes |
| Sale (COMPLETED) | ❌ No — use REFUND | ❌ No |
| PurchaseOrder (DRAFT) | ✅ Yes | ✅ Yes |
| ChartOfAccount | ✅ Yes | ✅ Yes — with history |

---

## 7. Response Envelope Compatibility

### 7.1 Standard List Response

```typescript
// ✅ FROZEN — all list endpoints return this shape
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
```

### 7.2 Standard Error Response

```typescript
// ✅ FROZEN — all errors return this shape
interface ErrorResponse {
  statusCode: number;     // HTTP status code
  message: string;        // Human-readable error message
  error: string;          // Error type (e.g., "Not Found", "Bad Request")
  timestamp: string;      // ISO 8601
  path: string;           // Request URL path
}
```

### 7.3 Response Envelope Evolution

| Change | Compatible | Policy |
|--------|------------|--------|
| Adding a field to paginated response | ✅ Backward compatible | Allowed |
| Adding a field to error response | ✅ Backward compatible | Allowed |
| Removing a field from paginated response | ❌ Breaking | Deprecate, remove in v2 |
| Changing paginated response structure | ❌ Breaking | New API version |

---

## 8. RBAC Compatibility

### 8.1 Permission Changes

| Change | Compatible | Policy |
|--------|------------|--------|
| Adding a new permission | ✅ Backward compatible | Add to seed data, document |
| Renaming a permission | ❌ Breaking | Add new permission, deprecate old, remove after migration |
| Removing a permission | ❌ Breaking | Deprecate for 3 months, then remove |
| Adding a new role | ✅ Backward compatible | Document default permissions |
| Changing role permissions | ✅ Backward compatible | Existing users may need re-login |

### 8.2 Permission Naming

Permissions follow `<module>:<action>` format and are case-sensitive:

```
✅ sales:create, sales:read, sales:update, sales:delete, sales:refund, sales:cancel
❌ Sales:create, SALES:CREATE, sales_create
```

---

## 9. Configuration Compatibility

### 9.1 Environment Variables

| Change | Compatible | Policy |
|--------|------------|--------|
| Adding new env var with default | ✅ Backward compatible | Document default value |
| Adding new required env var | ⚠️ Potentially breaking | Announce in release notes |
| Removing env var | ❌ Breaking | Deprecate first, document migration |
| Changing env var semantics | ❌ Breaking | New env var name, deprecate old |

### 9.2 Deprecation Tags in .env.example

```bash
# ✅ Current required variables
DATABASE_URL=postgresql://...
JWT_SECRET=...

# ❌ Deprecated — will be removed in v2.0
# LEGACY_API_KEY=...  (use API_KEY instead)
```

---

## 10. Build and CI/CD Compatibility

### 10.1 Build Guarantees

```
✅ Backward compatible TypeScript compilation — all existing code compiles without errors
✅ Zero new TypeScript errors — never suppress or ignore errors
✅ Zero new ESLint errors — never disable rules for new code
✅ All existing tests pass — never break existing tests
```

### 10.2 CI/CD Pipeline

The CI/CD pipeline enforces compatibility:

```
⛔ PR rejected if:
  - TypeScript build fails
  - ESLint fails
  - Tests fail
  - Circular dependencies detected
  - Prisma schema is invalid
  - npm audit shows critical vulnerability
  - Coverage drops below threshold
```

---

## 11. Summary: Compatibility Decision Matrix

| Change Type | Example | Compatible? | Action Required |
|------------|---------|-------------|-----------------|
| API: New endpoint | `GET /api/v2/sales` | ✅ Yes | Document |
| API: New response field | `{ items, total, page, limit, meta }` | ✅ Yes | Document new field |
| API: Remove response field | Remove `limit` from response | ❌ No | New API version |
| DTO: New optional field | `newField?: string` | ✅ Yes | Document |
| DTO: Remove field | Remove `customerId` | ❌ No | Deprecate → remove in v2 |
| Schema: New table | `CREATE TABLE notifications` | ✅ Yes | Migration |
| Schema: Remove column | `DROP COLUMN legacy` | ❌ No | Expand-migrate-contract |
| Event: New event | `sale.refunded` | ✅ Yes | Document, add handler |
| Event: Remove field | Remove `items` from payload | ❌ No | New event version |
| Migration: Add index | `CREATE INDEX` | ✅ Yes | Run migration |
| Migration: Rename column | `RENAME COLUMN` | ❌ No | Expand-migrate-contract |
| Env: New optional var | `NEW_FEATURE_ENABLED=false` | ✅ Yes | Document default |
| Env: Remove required var | Remove `DATABASE_URL` | ❌ No | Deprecate → remove |
