# 🏛️ StockFlow Enterprise — Architecture Compliance Audit v1.0

**Auditor:** Automated Architecture Compliance Check  
**Date:** July 26, 2026  
**Reference:** architecture-freeze-v1.md, development-guidelines.md, compatibility-policy.md, extension-points.md  

---

## 1. Compliance Score Summary

| Category | Score | Status |
|----------|-------|--------|
| **Repository Pattern** | 8/10 | ⚠️ Violations found |
| **Transaction Ownership** | 9.5/10 | ✅ Mostly compliant |
| **EventBus Contracts** | 10/10 | ✅ Compliant |
| **DTO Compatibility** | 9/10 | ⚠️ Minor violations |
| **RBAC Protection** | 7/10 | ❌ Violations found |
| **Audit Logging** | 7/10 | ❌ Gaps found |
| **Multi-Tenancy Isolation** | 10/10 | ✅ Compliant |
| **Optimistic Locking** | 6/10 | ❌ Violations found |
| **API Response Envelope** | 9/10 | ⚠️ Minor violations |
| **Dependency Rules** | 10/10 | ✅ Compliant |

**Overall Compliance: 85.5%**
**Production Readiness: 7/10**

---

## 2. Violations by Severity

### 🔴 CRITICAL VIOLATIONS

#### V1: Missing RolesGuard on 2 Controllers

| File | Problem | Impact |
|------|---------|--------|
| `src/modules/users/controllers/users.controller.ts` | `@UseGuards(JwtAuthGuard)` only — missing `RolesGuard` | 5 endpoints have no RBAC protection — any authenticated user can call them |
| `src/modules/suppliers/controllers/suppliers.controller.ts` | `@UseGuards(JwtAuthGuard)` only — missing `RolesGuard` | 5 endpoints have no RBAC protection |

**Fix:** Add `RolesGuard` to class-level `@UseGuards()` and add `@RequirePermission()` to every method.

#### V2: Missing Optimistic Locking in 4 Repositories

| File | Problem | Impact |
|------|---------|--------|
| `src/modules/products/repositories/products.repository.ts` | `update()` and `softDelete()` have no `rowVersion` parameter — use direct `update()` | Lost updates on concurrent product edits |
| `src/modules/users/repositories/users.repository.ts` | `update()` and `softDelete()` have no `rowVersion` parameter — use direct `update()` | Lost updates on concurrent user edits |
| `src/modules/purchasing/repositories/purchase-order.repository.ts` | `update()` and `softDelete()` have no `rowVersion` parameter — use `findById()` then `update()` (TOCTOU pattern) | Lost updates on concurrent purchase order edits |
| `src/modules/rbac/repositories/roles.repository.ts` | `update()` and `softDelete()` have no `rowVersion` parameter — use direct `update()` | Lost updates on concurrent role edits |

**Fix:** Add `rowVersion?: number` parameter, switch to `updateMany` with `rowVersion` check, throw `ConflictException` on mismatch.

#### V3: Missing Audit Logs in UsersService

| File | Problem | Impact |
|------|---------|--------|
| `src/modules/users/services/users.service.ts` | No audit log calls on `create()`, `update()`, `softDelete()` | User mutations are untracked — no accountability |

**Fix:** Add `auditLogService.log()` inside `Prisma.$transaction()` for all mutation operations.

---

### 🟠 HIGH VIOLATIONS

#### V4: Inconsistent RBAC Pattern Across Controllers

Some controllers apply `RolesGuard` at class level, others per-method:

```typescript
// ✅ Standard pattern (Sales, Finance, Reports, RBAC)
@UseGuards(JwtAuthGuard, RolesGuard)
export class XxxController { ... }

// ❌ Inconsistent pattern (CRM controllers)
@UseGuards(JwtAuthGuard)
export class OpportunityController {
  @Post()
  @UseGuards(RolesGuard)  // Per-method — inconsistent
  @RequirePermission('crm:create')
```

**Modules affected:** CRM controllers (OpportunityController, ContactController, etc.)

**Fix:** Move `RolesGuard` to class-level `@UseGuards()` and remove per-method application.

#### V5: ProductsRepository Missing rowVersion

`ProductsRepository.update()` and `ProductsRepository.softDelete()` do not accept `rowVersion`, do not use `updateMany`, and do not throw `ConflictException`.

#### V6: PurchaseOrderRepository TOCTOU Pattern

```typescript
async update(id, data, companyId, tx?) {
  const existing = await this.findById(id, companyId, tx);  // Race window here
  if (!existing) throw new NotFoundException(...);
  return this.getClient(tx).purchaseOrder.update({ where: { id }, data });  // Concurrent write loses
}
```

#### V7: CashShiftRepository Missing OL

`cash-shift.repository.ts` — verify rowVersion presence.

---

### 🟡 MEDIUM VIOLATIONS

#### V8: Missing PaginatedResponseDto on Some Controllers

Reports controller returns custom response shapes instead of standardized format.

#### V9: AuthController Missing RBAC (Expected — Public Endpoints)

`AuthController` has no guards (expected since endpoints are public). However, the compatibility policy requires documentation of public endpoints.

#### V10: `as unknown as` Casts in Repositories

Several repositories use `as unknown as Type` pattern instead of proper typing:
- `sales.repository.ts`: `as unknown as Sale`
- `inventory.repository.ts`: `as unknown as Prisma.TransactionClient`
- `suppliers.repository.ts`: `as unknown as Supplier`

---

### 🟢 LOW VIOLATIONS

#### V11: Missing Swagger `@ApiBearerAuth()` on Some Controllers

Users and Suppliers controllers lack `@ApiBearerAuth()` decorator.

#### V12: Inline Decimal Creation Instead of Shared Utility

Some services create `new Decimal(value)` directly instead of using `toDecimal()` utility.

---

## 3. Compliance by Module

| Module | Repo Pattern | OL | RBAC | Audit | Multi-Tenant | Transaction | Score |
|--------|-------------|-----|------|-------|-------------|-------------|-------|
| Sales | ✅ 10/10 | ✅ | ✅ | ✅ | ✅ | ✅ | 10/10 |
| Finance | ✅ 9/10 | ✅ Journals | ✅ | ✅ | ✅ | ✅ | 9/10 |
| Inventory | ✅ 9/10 | ⚠️ Partial | ✅ | ✅ | ✅ | ✅ | 9/10 |
| Customers | ✅ 10/10 | ✅ | ✅ | ✅ | ✅ | ✅ | 10/10 |
| Suppliers | ✅ 10/10 | ✅ | ❌ Missing RolesGuard | ✅ | ✅ | ✅ | 8/10 |
| Products | ✅ 7/10 | ❌ Missing OL | ✅ | ✅ | ✅ | ✅ | 7/10 |
| Users | ✅ 6/10 | ❌ Missing OL | ❌ Missing RolesGuard | ❌ Missing Audit | ✅ | ✅ | 6/10 |
| Purchasing | ✅ 7/10 | ❌ TOCTOU in PO repo | ✅ | ✅ | ✅ | ✅ | 7/10 |
| RBAC | ✅ 7/10 | ❌ Missing OL | ✅ | N/A | ✅ | ✅ | 7/10 |
| Reports | ✅ 10/10 | N/A (read-only) | ✅ | N/A | ✅ | N/A | 10/10 |
| Auth | ✅ 10/10 | N/A | N/A (public) | ✅ | N/A | ✅ | 10/10 |
| CRM | ✅ 8/10 | ⚠️ Partial | ⚠️ Inconsistent | ✅ | ✅ | ✅ | 8/10 |

---

## 4. Positive Findings (Compliant Areas)

### 4.1 Multi-Tenancy — 100% Compliant
Every repository query includes `companyId` isolation. No cross-company access possible.

### 4.2 Transaction Ownership — 95% Compliant
All multi-table writes use `prisma.$transaction()`. Services control transaction boundaries.

### 4.3 EventBus Contracts — 100% Compliant
All events are published via `EventBus.publish()` with transaction context. Handlers are registered via `EventBus.subscribe()` in `OnModuleInit`.

### 4.4 Dependency Rules — 100% Compliant
No cross-module imports of business services. All cross-module communication goes through EventBus.

### 4.5 Sales Module — 100% Compliant
Exemplary module — follows all frozen architecture rules correctly.

---

## 5. Required Fixes (Priority Order)

### Phase 1 — Critical (Fix Immediately)

| # | Fix | Effort | Module |
|---|-----|--------|--------|
| 1 | Add `RolesGuard` to SuppliersController + `@RequirePermission()` on all methods | 15 min | Suppliers |
| 2 | Add `RolesGuard` to UsersController + `@RequirePermission()` on all methods | 15 min | Users |
| 3 | Add `rowVersion` + `updateMany` to ProductsRepository | 30 min | Products |
| 4 | Add `rowVersion` + `updateMany` to UsersRepository | 30 min | Users |
| 5 | Add `rowVersion` + `updateMany` to PurchaseOrderRepository | 30 min | Purchasing |
| 6 | Add `rowVersion` + `updateMany` to RolesRepository | 30 min | RBAC |
| 7 | Add audit logging to UsersService (create/update/softDelete) | 30 min | Users |

### Phase 2 — High (Fix This Sprint)

| # | Fix | Effort | Module |
|---|-----|--------|--------|
| 8 | Standardize RBAC pattern — move RolesGuard to class level in CRM controllers | 20 min | CRM |
| 9 | Fix `as unknown as` casts in repositories | 20 min | Multiple |

### Phase 3 — Medium (Fix Next Sprint)

| # | Fix | Effort | Module |
|---|-----|--------|--------|
| 10 | Add `@ApiBearerAuth()` to Users + Suppliers controllers | 10 min | Users, Suppliers |
| 11 | Standardize response format across Reports module | 1 hour | Reports |

---

## 6. Frozen Architecture Conformity

| Component | Required By | Current | Gap |
|-----------|-------------|---------|-----|
| Repository Pattern | ADR-001 | 8/10 | Missing OL in 4 repos |
| EventBus | ADR-002 | 10/10 | None |
| Prisma ORM | ADR-003 | 10/10 | None |
| PostgreSQL | ADR-004 | 10/10 | None |
| Multi-Tenancy | ADR-005 | 10/10 | None |
| Soft Delete | ADR-006 | 10/10 | None |
| Optimistic Locking | ADR-007 | 6/10 | Missing in 4 repos |
| RBAC | ADR-008 | 7/10 | 2 controllers missing RolesGuard |
| Audit Logging | ADR-009 | 7/10 | UsersService missing audit |
| Transaction Propagation | ADR-010 | 9.5/10 | TOCTOU in PurchaseOrder |

**Overall Freeze Conformity: 85.5%** — Requires Priority fixes before Phase 7 begins.

---

## 7. Next Steps

1. Apply Critical and High fixes (estimated: 4 hours)
2. Re-run compliance check
3. Target: ≥95% conformity before Phase 7.1 implementation
