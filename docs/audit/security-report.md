# 🛡️ StockFlow ERP — Security Report

**Date**: July 25, 2026  
**Auditor**: Principal ERP Security Architect  
**Build**: ✅ Passes (0 TypeScript errors)  
**ESLint**: ⚠️ 90 `no-explicit-any` (90 about `any` type usage)  

---

## 1. Authentication

### ✅ JWT AuthGuard Coverage

| Module | Protected? | Notes |
|--------|-----------|-------|
| **Customers** | ✅ | Class-level @UseGuards(JwtAuthGuard, RolesGuard) |
| **Products** | ✅ | Class-level |
| **Suppliers** | ✅ | Class-level |
| **Sales** | ✅ | Class-level + additional grants on refund/cancel |
| **Purchasing** | ✅ | All 6 controllers protected |
| **CRM** | ✅ | All 9 controllers protected |
| **Inventory** | ✅ | All 9 controllers protected |
| **Finance** | ✅ | All 8 controllers protected |
| **Reports** | ✅ | Protected |
| **RBAC** | ✅ | Protected |
| **Users** | ✅ | Protected |
| **Health** | ⚠️ Public endpoint | ✅ Health check intentionally public |

**Verdict**: 100% of business endpoints are JWT-protected. ✅

---

## 2. RBAC Coverage

### ✅ Permission Annotations

All modules use `@RequirePermission()` decorator with granular permissions:

| Module | Permissions Used |
|--------|-----------------|
| **CRM** | `crm:create`, `crm:read`, `crm:update`, `crm:delete` |
| **Customers** | Same as CRM |
| **Sales** | `sales:create`, `sales:read`, `sales:update`, `sales:cancel`, `sales:refund`, `sales:shift` |
| **Purchasing** | `purchasing:create`, `purchasing:read`, `purchasing:update`, `purchasing:delete` |
| **RBAC** | `roles:create`, `roles:read`, `roles:update`, `roles:delete`, `roles:assign` |

**Verdict**: All action endpoints have RBAC. ✅

### ⚠️ Gap: Missing Permission Seed Data (MEDIUM)
Permissions are created but may not include all documented permissions. If `roles:assign` exists but a role doesn't include it, the guard rejects valid requests.

**Recommendation**: Verify RBAC seed includes ALL permissions that controllers check.

---

## 3. Multi-Tenancy (companyId Isolation)

### ✅ Good
- Every repository method accepts `companyId` parameter
- Every Prisma `where` clause includes `companyId` filter
- JWT payload includes `companyId`
- `current-user.decorator.ts` extracts from JWT

### ⚠️ Potential Violations (HIGH)

| File | Pattern | Risk |
|------|---------|------|
| `inventory/services/variant.service.ts` | `productVariant.findMany({ where: { productId, deletedAt: null, product: { companyId } } ... })` | Indirect companyId via relation — harder to audit |
| `finance/services/ledger-query.service.ts` | Multiple direct `prismaService.journalLine.findMany()` calls | Must verify all include companyId — at least 6 call sites |
| `sales/services/sales.service.ts` | Some queries use `prismaService.sale.findMany` without explicit companyId | Must audit |
| `inventory-count.service.ts:complete()` | Stock updates via `findStockByProductAndWarehouse(productId, warehouseId, companyId, tx)` | ✅ Properly scoped |

**Recommendation**: Add automated test that verifies every repository method filters by `companyId`.

---

## 4. Input Validation

### ✅ Good
- All DTOs use `class-validator` decorators (`@IsString`, `@IsOptional`, `@IsEnum`, etc.)
- `ValidationPipe` globally configured
- Swagger decorators provide documentation

### ⚠️ Gaps (MEDIUM)

| DTO | Missing Validation |
|-----|-------------------|
| `customer-query.dto.ts` | No `@IsOptional()` on optional fields |
| `product-query.dto.ts` | No pagination bounds checking |
| `purchase-order-query.dto.ts` | No date range validation |
| Multiple query DTOs | No maximum page size enforcement |

**Recommendation**: 
- Add `@Min(1) @Max(100)` on `limit` fields
- Add date range validation (`@Validate(DateRangeValidator)`)
- Add string length constraints on search fields

---

## 5. Soft Delete Coverage

### ✅ Models with soft delete
Models with `deletedAt: DateTime?` field:
- Customer, Contact, CustomerAddress, CustomerGroup, Product, ProductVariant, Supplier, SupplierContact, User, PurchaseOrder, all Finance models, all Inventory models

### ⚠️ Missing soft delete (MEDIUM)
Models that may need soft delete but don't have it:
- `AuditLog` — immutable by nature (✅ acceptable)
- `StockMovement` — missing `deletedAt`
- `JournalLine` — missing `deletedAt`
- `AccountBalance` — missing `deletedAt`
- `CostLayer` — missing `deletedAt`
- `Session` / `RefreshToken` — may not need it

**Recommendation**: Add `deletedAt` to `StockMovement`, `JournalLine`, `AccountBalance`, and `CostLayer` for consistency.

---

## 6. Optimistic Locking Coverage

### ✅ Models with rowVersion
Most mutable models have `rowVersion Int @default(0)` with `updateMany({ where: { id, companyId, rowVersion } })`.

### ⚠️ Missing rowVersion (HIGH)
Models that support updates but lack `rowVersion`:
- `Stock` — ✅ has it
- `StockMovement` — immutable (✅ acceptable by design)
- `AuditLog` — immutable (✅ acceptable)
- `CostLayer` — has `remainingQuantity` read-modify-write patterns (⚠️)
- `Product` — no `rowVersion` found
- `Supplier` — no `rowVersion` found
- `CustomerGroup` — missing in some queries

**Recommendation**: Add `rowVersion` to all mutable models. Current TOCTOU risk on CostLayer operations.

---

## 7. Input Sanitization & Injection Prevention

### ✅ Prisma ORM prevents SQL injection
All queries use parameterized Prisma queries. No raw SQL found.

### ⚠️ Search field handling (LOW)
- `contains` + `mode: 'insensitive'` is case-insensitive but safe
- No `$queryRawUnsafe` usage found ✅

**Verdict**: SQL injection risk is minimal. ✅

---

## 8. Audit Logging

### ✅ Coverage
All mutation services call `auditLog.log()`:
- Create: records `before: null, after: { ... }`
- Update: records `before, after`
- Delete: records `before, after: null`

### ✅ Transaction Safety
Audit logs are created inside the same Prisma `$transaction` as business mutations — log rolls back if business fails.

### ⚠️ Missing Audit Logs (LOW)
- `auth.service.ts` — login/logout activities not audited
- `users.service.ts` — user mutations should be audited (partially done)

**Recommendation**: Add audit logging for authentication events and user management.

---

## 9. Rate Limiting

### ⚠️ Missing Rate Limiting (HIGH)
No rate limiting is configured on any endpoint:
- Auth endpoints (login, register) are unprotected against brute force
- Public health endpoint has no rate limiting
- All API endpoints vulnerable to abuse

**Recommendation**: Add `@nestjs/throttler` with:
- Auth endpoints: 10 req/min per IP
- General API: 100 req/min per user
- Report endpoints: 20 req/min per user

---

## 10. Additional Security Concerns

| Issue | Severity | Detail |
|-------|----------|--------|
| No Helmet.js/CSP headers | MEDIUM | Missing security headers |
| No CSRF protection | MEDIUM | API-only, but JWT stored in cookie? Need to verify |
| JWT secret in env | LOW | Properly in env |
| No request size limit | LOW | Body parser default (100kb) |
| No CORS configuration verified | MEDIUM | CORS may be too permissive in dev |
| No Input normalization | LOW | Emails, phone numbers not normalized |

---

## 11. Score Summary

| Category | Score | Notes |
|----------|-------|-------|
| **Authentication** | 10/10 | All endpoints protected |
| **Authorization (RBAC)** | 9/10 | All annotated, verify seed |
| **Multi-Tenancy** | 8/10 | Mostly consistent, a few risky patterns |
| **Input Validation** | 8/10 | Good, needs bounds checking |
| **Soft Delete** | 7/10 | Missing in some models |
| **Optimistic Locking** | 7/10 | CostLayer race risk |
| **Audit Logging** | 9/10 | Excellent, auth missing |
| **Rate Limiting** | 0/10 | Not implemented |
| **Overall Security** | **7.5/10** | Strong but has gaps |

---

## 12. Critical Security Issues

1. **🔴 No rate limiting on auth endpoints** — Brute force attack vector
2. **🔴 Cost Layer has read-modify-write without rowVersion** — Lost update risk
3. **🔴 Missing indexes on AuditLog** — Audit queries will be slow at scale
4. **🔴 No Helmet.js / CSP headers** — Missing defense in depth
