# ADR-005: Multi-Tenant Architecture

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

StockFlow serves multiple companies (tenants) from a single application instance. Each tenant's data must be strictly isolated while sharing the same infrastructure.

## Problem

How should multi-tenancy be implemented to ensure data isolation without the operational cost of database-per-tenant?

## Decision

**Shared database, shared schema, companyId isolation.**

```
┌─────────────────────────────────────────┐
│               PostgreSQL                 │
│                                          │
│  products                                │
│  ├── companyId = 'comp-a'               │
│  ├── companyId = 'comp-b'               │
│  └── companyId = 'comp-c'               │
│                                          │
│  sales                                   │
│  ├── companyId = 'comp-a'               │
│  ├── companyId = 'comp-b'               │
│  └── companyId = 'comp-c'               │
└─────────────────────────────────────────┘
```

**Rules:**

1. **Every table has `companyId`** as a mandatory, non-nullable UUID column.
2. **Every repository query includes `where: { companyId }`** derived from the JWT payload.
3. **companyId is NEVER taken from user input.** Always from the authenticated user's JWT.
4. **Composite indexes start with `companyId`:** `@@index([companyId, status, createdAt])`.
5. **Unique constraints include companyId:** `@@unique([companyId, code])` or `@@unique([companyId, saleNumber])`.
6. **Cross-company queries are FORBIDDEN.** No repository may omit `companyId` from WHERE clauses.
7. **Database-level enforcement** (row-level security) is reserved for phase 2 after 5,000+ companies.

**Company resolution flow:**

```
Request → JwtAuthGuard → JWT payload (contains companyId)
  → Controller extracts @CurrentUser() → userId, companyId
  → Service passes companyId to Repository
  → Repository includes companyId in every Prisma query
```

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **Database-per-tenant** | High operational cost (connection pool per DB), complex migrations across N databases, no shared tooling |
| **Schema-per-tenant** | Complex migration management, connection pool per schema, harder to manage at scale |
| **Row-Level Security (RLS)** | Adds complexity to migrations, performance overhead, harder to debug; reserved for phase 2 |
| **Tenant-specific columns (tenant_id pattern)** | Same as companyId but different naming; functionally equivalent |

## Consequences

**Positive:**
- Simple, well-understood pattern
- Single migration per schema change
- Efficient connection pooling
- Easy to backup and restore
- Easy to debug and query across tenants (for support)

**Negative:**
- Risk of data leaks if companyId is omitted from a query (mitigated by review checklist)
- Indexes grow with tenant count (mitigated by companyId-first composite indexes)
- Query performance degrades without proper indexes (mitigated by DBA reviews)
- Database size grows with tenant count (requires pg_partman or partitioning at scale)

**Neutral:**
- Row-Level Security can be added later without schema changes

## Future Considerations

- **RLS policies** for defense-in-depth at 5,000+ tenants
- **Partitioning by companyId** using pg_partman at 10,000+ tenants
- **Read-only replicas** for cross-tenant reporting (internal analytics only)
- **Tenant tier limits** (quotas per tenant enforced at application layer)
