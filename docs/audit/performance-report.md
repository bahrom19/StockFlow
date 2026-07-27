# ⚡ StockFlow ERP — Performance Report

**Date**: July 25, 2026  
**Auditor**: Principal ERP Architect  
**Database**: PostgreSQL 16 via Prisma ORM  
**Cache**: Redis (configured, limited usage)  

---

## 1. Database Index Coverage

### ✅ Properly Indexed
- All `companyId` fields indexed
- All `createdAt` fields indexed  
- Composite indexes on `[companyId, deletedAt]` for soft-delete queries
- Composite indexes on `[companyId, status]` for status filters
- Composite indexes on `[companyId, isActive]` for active-only queries

### ⚠️ Missing Indexes (HIGH)

| Table | Missing Index | Impact |
|-------|--------------|--------|
| `Sale` | `[companyId, saleNumber]` | Lookups by sale number scan |
| `SaleItem` | `[saleId]` | Nested sale items query without FK index |
| `JournalEntry` | `[companyId, entryNumber]` | Next-entry-number query scans |
| `JournalLine` | `[journalEntryId]` | Lines query on FK without index |
| `JournalLine` | `[accountId, companyId]` | Account statement generation |
| `StockMovement` | `[productId, companyId]` | Product stock movement history |
| `StockMovement` | `[referenceType, referenceId]` | Reference-based lookups |
| `PurchaseOrder` | `[supplierId, companyId]` | Supplier purchase history |
| `Sale` | `[customerId, companyId]` | Customer purchase history |
| `AuditLog` | `[entityType, entityId]` | Entity audit trail queries |
| `AuditLog` | `[companyId, createdAt]` | Audit log queries by company |
| `CashShift` | `[warehouseId, companyId]` | Warehouse shift lookups |
| `CostLayer` | `[productId, companyId, direction]` | FIFO cost layer lookups |

**Recommendation**: Add these indexes before production deployment. Each missing index causes full table scans as data grows.

---

## 2. N+1 Query Analysis

### ✅ No Obvious N+1 Found
No Prisma queries were detected inside `for`/`while` loops across the codebase.

### ⚠️ Potential Performance Concerns (MEDIUM)

| Location | Query Pattern | Risk |
|----------|--------------|------|
| `costing.service.ts:getValuation()` | Loop over stock items, calls `calculateAverageCost()` per item | O(n²) — each iteration hits cost layers |
| `costing.service.ts:consumeFifoLayers()` | Loop over cost layers, updates each sequentially | Sequential updates in loop |
| `inventory-count.service.ts:complete()` | Loop over count items, updates stock per item | Multiple roundtrips per count |
| `purchasing-finance.service.ts` | `getOpenPeriodId()` called for each journal creation | Extra query per journal |
| `reports.repository.ts:supplierList()` | Returns suppliers then separate aggregation query | Two sequential queries |
| `reports.repository.ts:customerList()` | Same pattern as supplierList | Two sequential queries |

**Recommendation**: 
- Batch cost layer queries in `getValuation()` 
- Cache open financial period ID per request
- Use Prisma `include` or nested creates instead of sequential operations where possible

---

## 3. Transaction Usage

### ✅ Good
- Paginated reads use `$transaction([items, count])` → atomic read consistency
- Multi-table writes use `$transaction(async (tx) => { ... })` → rollback safety
- Event publishing inside transactions via context propagation

### ⚠️ Gaps (MEDIUM)

| Service | Issue |
|---------|-------|
| `purchase-order.service.ts:477` | Uses `prismaService.purchaseOrder.count` directly (bypasses repo) |
| `costing.service.ts:consumeFifoLayers()` | Sequential cost layer updates inside transaction, but lock contention risk |
| `inventory-count.service.ts:complete()` | Large transaction scope — inventory count may have hundreds of items |

**Recommendation**: 
- Review transaction boundaries in `inventory-count.service.ts` — consider batch operations
- Add retry logic for serialization failures in high-contention areas (cost layers, stock updates)

---

## 4. Query Optimization Opportunities

### 4.1 Missing Prisma `select` projections (LOW)

Several queries load entire rows when only a few fields are needed:

| File | Query | Fields Needed |
|------|-------|---------------|
| `reports.repository.ts:customerList()` | `findMany` without select | Only basic info |
| `reports.repository.ts:supplierList()` | Same | Only basic info |
| `inventory.repository.ts:findAllStock()` | `findMany` with include | Most fields used — but could be narrowed |

**Recommendation**: Add explicit `select` clauses to all report queries.

### 4.2 Missing Pagination on Reports (MEDIUM)

Reports with potentially large datasets:

| Report | Without Pagination |
|--------|-------------------|
| `GET /reports/products/top` | Returns top 50, but aggregates all sales |
| `GET /reports/inventory/value` | Could scan thousands of products |
| `GET /reports/profit` | Returns all completed sales |

**Recommendation**: Add pagination to all report endpoints.

---

## 5. Redis Cache Utilization (LOW)

Redis is configured but barely used:

| Cache Opportunity | Current Behavior | Impact |
|------------------|-----------------|--------|
| Financial periods | Queried from DB on every journal | ~5ms extra per journal |
| Open financial period ID | Queried fresh each time | Cache-friendly |
| Chart of Accounts | Queried per transaction | Stable data |
| Customer groups | Reloaded on every request | Rarely changes |
| Product costing method | Per-product query | Stable data |

**Recommendation**: Implement Redis caching for:
- Open financial period ID (TTL: 1 hour)
- Chart of Accounts (TTL: 1 hour)
- Product costing method (TTL: 1 day)

---

## 6. Scalability Concerns

### 6.1 At 100 Companies
- Current architecture handles this easily
- All queries filter by `companyId`
- Prisma connection pooling adequate

### 6.2 At 1,000 Companies
- Missing indexes become visible (full table scans)
- Report aggregation queries may timeout
- Redis caching becomes critical
- EventBus should move to message queue (BullMQ/RabbitMQ)

### 6.3 At 10,000 Companies
- Journal Entry table may have 100M+ rows
- Partitioning by `financialPeriodId` or `companyId` required
- Prisma may need read replicas
- Reports need materialized views
- Rate limiting required per company

**Recommendation**: 
- Implement partitioning strategy for Journal Lines and Stock Movements
- Add materialized views for dashboard aggregation
- Plan for read replica deployment

---

## 7. Score Summary

| Category | Score | Notes |
|----------|-------|-------|
| **Index Coverage** | 6/10 | 13+ missing indexes |
| **N+1 Prevention** | 9/10 | Clean, one O(n²) in costing |
| **Transaction Usage** | 9/10 | Consistent, some over-scoped |
| **Query Optimization** | 7/10 | Missing select projections |
| **Redis Usage** | 3/10 | Configured but unused |
| **Scalability Readiness** | 5/10 | Adequate for 100, poor for 10,000 |
| **Overall Performance** | **6.5/10** | Functional, needs optimization |

---

## 8. Critical Performance Issues

1. **🔴 13+ missing indexes** — Will cause full table scans at scale
2. **🔴 O(n²) in costing service** — `getValuation()` hits DB per stock item
3. **🔴 Reports without pagination** — Will timeout on large datasets
