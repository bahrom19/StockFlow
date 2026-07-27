# 🧹 StockFlow ERP — Technical Debt Report

**Date**: July 25, 2026  
**Auditor**: Principal ERP Architect  
**Total TypeScript files**: 354  
**Build**: ✅ Passes (0 errors)  

---

## Priority Classification

| Priority | Definition | Count |
|----------|-----------|-------|
| **🔴 Critical** | Production blocker, must fix before launch | 8 |
| **🟠 High** | Will cause issues at scale or with specific inputs | 12 |
| **🟡 Medium** | Best practice violation, should fix soon | 18 |
| **🟢 Low** | Nice to have, cosmetic or minor improvement | 24 |

---

## 🔴 Critical Issues

### C1. Missing Database Indexes (13+ indexes)
**Problem**: Several foreign keys and query patterns lack indexes, causing full table scans.
**Risk**: Performance degradation at 1,000+ records in SaleItem, JournalLine, StockMovement, AuditLog.
**Files**: `prisma/schema.prisma`
**Effort**: 2 hours
**Fix**: Add `@@index([...])` blocks.

### C2. Repository Pattern Violations (6 files)
**Problem**: Services bypass repositories and access `prismaService` directly.
**Risk**: Inconsistent query patterns, harder to mock, transaction leaks.
**Files**: `ledger-query.service.ts`, `variant.service.ts`, `barcode.service.ts`, `uom.service.ts`, `inventory-costing.service.ts`, `customers.service.ts`
**Effort**: 4 hours
**Fix**: Create proper repository methods.

### C3. No Rate Limiting
**Problem**: All endpoints unprotected against abuse.
**Risk**: Brute force auth attacks, API abuse.
**Effort**: 1 hour
**Fix**: Add `@nestjs/throttler`.

### C4. Cost Layer Race Condition (TOCTOU)
**Problem**: `consumeFifoLayers()` reads, modifies, and writes cost layers without optimistic locking on `remainingQuantity`.
**Risk**: Lost update → inventory value corruption under concurrent writes.
**Files**: `inventory/services/costing.service.ts`
**Effort**: 2 hours
**Fix**: Add `rowVersion` to CostLayer, use `updateMany` with version check.

### C5. Orphan Domain Events (10+ events)
**Problem**: Events published but no handlers subscribe.
**Risk**: Silent data loss — "completed" sales, "adjusted" inventory not synced.
**Files**: Multiple services
**Effort**: 3 hours
**Fix**: Implement handlers for all published events.

### C6. O(n²) in Costing Service
**Problem**: `getValuation()` calls `calculateAverageCost()` per stock item in a loop.
**Risk**: At 10,000+ products, this becomes 10,000+ sequential DB queries.
**Files**: `inventory/services/costing.service.ts`
**Effort**: 3 hours
**Fix**: Batch query all cost layers at once.

### C7. Missing Optimistic Locking on Core Models
**Problem**: `Product`, `Supplier`, `CustomerGroup` lack `rowVersion`.
**Risk**: Concurrent updates can silently overwrite each other.
**Files**: `prisma/schema.prisma`
**Effort**: 2 hours
**Fix**: Add `rowVersion` and update repository methods.

### C8. No Tests Anywhere
**Problem**: Zero unit, integration, or E2E tests found.
**Risk**: No regression safety net. Every refactor is risky.
**Effort**: 40+ hours for baseline coverage
**Fix**: Start with critical paths (Sales → Inventory → Finance flow).

---

## 🟠 High Priority Issues

### H1. Reports Without Pagination
**Problem**: `/reports/profit`, `/reports/inventory/value` return unbounded results.
**Risk**: Timeout/memory exhaustion with large datasets.
**Effort**: 2 hours

### H2. Redis Cache Unused
**Problem**: Redis configured but only "hot data" queries hit the database.
**Risk**: Unnecessary DB load for stable data (financial periods, chart of accounts).
**Effort**: 3 hours

### H3. Missing Swagger on Some DTOs
**Problem**: Not all DTO properties have `@ApiProperty()` decorators.
**Risk**: Incomplete OpenAPI documentation.
**Effort**: 2 hours

### H4. Audit Log Indexes Missing
**Problem**: `AuditLog` queries lack covering indexes.
**Risk**: Audit trail queries become slow at 100K+ entries.
**Effort**: 1 hour

### H5. Deep Relative Imports
**Problem**: All imports use `../../../` path traversal.
**Risk**: Brittle when restructuring modules.
**Effort**: 2 hours (with path aliases)

### H6. No Request Context Propagation
**Problem**: Request ID, correlation ID not consistently propagated.
**Risk**: Hard to trace requests across services/events.
**Effort**: 4 hours

### H7. Customers Service Injecting PrismaService Directly
**Problem**: Dual pattern — uses `CustomersRepository` AND direct `prismaService`.
**Risk**: Inconsistent code style, harder to maintain.
**Effort**: 1 hour

### H8. Missing companyId in Some Finance Queries
**Problem**: `ledger-query.service.ts` has multiple direct Prisma accesses — companyId verification needed.
**Risk**: Cross-company data leak.
**Effort**: 2 hours

### H9. No E2E Test for Critical Business Flow
**Problem**: Sale → Inventory deduction → Journal creation flow untested.
**Risk**: Regression in core ERP logic.
**Effort**: 8 hours

### H10. ESLint `no-explicit-any` (90 errors)
**Problem**: Pre-existing any annotations across codebase.
**Risk**: Hides type safety issues.
**Effort**: 4 hours

### H11. No Helmet.js / Security Headers
**Problem**: Missing CSP, X-Frame-Options, X-Content-Type-Options headers.
**Risk**: XSS, clickjacking vulnerabilities.
**Effort**: 1 hour

### H12. Missing Materialized Views for Reports
**Problem**: All reports aggregate live data.
**Risk**: Slow dashboard loading with 10K+ companies.
**Effort**: 8 hours (design + implementation)

---

## 🟡 Medium Priority Issues

### M1. Missing DTO Bounds Validation
**Problem**: Pagination params (`page`, `limit`) not bounded with `@Min`/`@Max`.
**Details**: Could allow `limit: 1000000`, causing OOM.

### M2. No `@ApiBearerAuth()` on Some Controllers
**Problem**: Swagger UI may not show auth button for some endpoints.
**Fix**: Add class-level decorator.

### M3. Missing `select` in Report Queries
**Problem**: Reports load entire entity rows when 2-3 fields needed.
**Performance**: Wastes I/O and memory.

### M4. Missing Auth Audit Logging
**Problem**: Login/logout not audited.
**Security**: Cannot detect brute force or unauthorized access.

### M5. Missing User Mutation Audit Logging
**Problem**: User CRUD operations not fully audited.
**Security**: Cannot track admin changes.

### M6. No TypeScript Path Aliases
**Problem**: All imports use relative paths like `../../../common/prisma`.
**Maintainability**: Refactoring requires updating all imports.

### M7. Large Transaction Scope in Inventory Count
**Problem**: Complete inventory count holds transaction for potentially hundreds of items.
**Performance**: Lock contention risk.

### M8. Missing Composite Index on StockMovement
**Problem**: `[productId, companyId, createdAt]` not indexed.
**Performance**: Stock history queries scan.

### M9. CashShift Missing Warehouse Index
**Problem**: `[warehouseId, companyId]` not indexed.
**Performance**: Shift lookups by warehouse.

### M10. No Request Size Limiting
**Problem**: No payload size limits configured.
**Security**: DoS via large request bodies.

### M11. Missing CORS Configuration Audit
**Problem**: CORS configuration not verified for production.
**Security**: May be too permissive.

### M12. No Email/Phone Normalization
**Problem**: Duplicate customer records possible due to inconsistent casing.
**Data Quality**: "john@example.com" ≠ "John@Example.com".

### M13. Missing `updatedBy` on Some Models
**Problem**: Not all models track who last updated them.
**Audit**: Makes audit trail less useful.

### M14. No Database Migration Strategy
**Problem**: No migration files committed.
**DevOps**: Cannot deploy to new environments.

### M15. Missing Health Check Deep Probes
**Problem**: Health check only returns OK without checking DB/Redis connectivity.
**Operations**: False positive health status.

### M16. No Graceful Shutdown Handling
**Problem**: NestJS graceful shutdown may not wait for active transactions.
**Operations**: Possible data loss during deployment.

### M17. Missing Event Retry Logic
**Problem**: Event handlers that fail are not retried.
**Reliability**: Transient errors cause silent data loss.

### M18. Missing Idempotency Keys
**Problem**: No idempotency for event handlers.
**Reliability**: Duplicate events could cause duplicate journal entries.

---

## 🟢 Low Priority Issues

### L1. No `.env.example` File
**Problem**: Environment variables not documented.

### L2. No Docker Compose Health Checks
**Problem**: Services may start before DB is ready.

### L3. No `pre-commit` Hooks
**Problem**: Linting/build not enforced before commits.

### L4. No Commit Convention (Commitlint)
**Problem**: Commit messages inconsistent.

### L5. No API Versioning
**Problem**: `/api/v1/` prefix not configured.

### L6. Missing `main.ts` Bootstrap Validation
**Problem**: No startup validation of required env vars.

### L7. No Logger Module Configuration
**Problem**: Uses default NestJS logger, no structured logging.

### L8. Missing Correlation ID in Logs
**Problem**: Cannot trace request across services.

### L9. No OpenAPI/Swagger Export Script
**Problem**: Cannot generate client SDKs automatically.

### L10. No Performance Benchmarks
**Problem**: No baseline for performance regression detection.

### L11. Missing Seed Data Scripts
**Problem**: No development seed data for local testing.

### L12. No Code Coverage Configuration
**Problem**: No coverage thresholds or reporting.

### L13. Missing `npm scripts` for Common Tasks
**Problem**: `npm run seed`, `npm run db:reset` not defined.

### L14. No API Contract Tests
**Problem**: No consumer-driven contract tests.

### L15. Missing Docker Multi-stage Build
**Problem**: Dev dependencies in production image.

### L16. No Lint-staged Configuration
**Problem**: No pre-commit linting.

### L17. Missing `.nvmrc` / `.node-version`
**Problem**: Node.js version not pinned.

### L18. No PR Template
**Problem**: PR descriptions inconsistent.

### L19. No CODEOWNERS File
**Problem**: Code review assignments not automated.

### L20. Integration Tests Missing CI Configuration
**Problem**: No CI pipeline configuration.

### L21. No Migration Automation in CI
**Problem**: DB migration step not automated.

### L22. Missing Swagger Theme/Styling
**Problem**: Default Swagger UI look.

### L23. No Monitoring / OpenTelemetry Setup
**Problem**: No metrics, tracing, or APM.

### L24. Missing Backup Strategy Documentation
**Problem**: No documented DB backup/restore process.

---

## 🔧 Technical Debt Roadmap

### Sprint 1 (Production Launch Blockers) — 2 days
1. 🔴 C1 — Add missing indexes
2. 🔴 C8 — Rate limiting
3. 🔴 C4 — Cost Layer race condition
4. 🔴 C3 — Repository pattern violations
5. 🔴 C5 — Implement event subscribers

### Sprint 2 (Scale Readiness) — 3 days
1. 🟠 H1 — Reports pagination
2. 🟠 H2 — Redis caching
3. 🟠 H3 — Swagger completion
4. 🟠 H8 — companyId audit
5. 🟠 H10 — ESLint cleanup
6. 🟠 H11 — Security headers

### Sprint 3 (Quality) — 5 days
1. 🟠 H9 — E2E tests for critical flows
2. 🟠 H12 — Materialized views
3. 🟡 M1-M5 — Validation & DTO improvements
4. 🟡 M6 — Path aliases
5. 🟡 M16-M18 — Event reliability

### Sprint 4 (Polish) — 3 days
1. 🟢 L1-L24 — All low-priority items
2. All remaining medium issues

---

## 📊 Overall Score Summary

| Category | Score | Trend |
|----------|-------|-------|
| **Production Readiness** | 7.5/10 | 🔴 8 critical blockers |
| **Security Posture** | 7.5/10 | 🟠 No rate limiting |
| **Performance Readiness** | 6.5/10 | 🔴 13 missing indexes |
| **Code Quality** | 7.5/10 | 🟠 Repository violations |
| **Test Coverage** | 0/10 | 🔴 No tests at all |
| **Operations Readiness** | 4/10 | 🟠 Missing monitoring |
| **Overall** | **5.5/10** | Needs 2-3 sprints |

---

## 🎯 Estimated Time to Production

| Phase | Effort | Duration |
|-------|--------|----------|
| Critical fixes | 20 hours | 2-3 days |
| High priority | 30 hours | 4-5 days |
| Medium priority | 25 hours | 3-4 days |
| Low priority | 15 hours | 2 days |
| **Total** | **90 hours** | **~3 weeks (1 dev)** |

## 🎯 Estimated Time to SaaS Launch

| Phase | Additional Effort | Duration |
|-------|------------------|----------|
| Multi-tenant hardening | 20 hours | 3 days |
| Rate limiting + monitoring | 15 hours | 2 days |
| CI/CD pipeline | 15 hours | 2 days |
| Test suite (critical paths) | 40 hours | 1 week |
| Documentation | 10 hours | 1 day |
| **Total SaaS Prep** | **100 hours** | **~3-4 weeks** |
