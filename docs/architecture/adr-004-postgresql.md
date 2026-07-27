# ADR-004: PostgreSQL

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

StockFlow is an ERP system that requires ACID compliance, complex queries, JSON support, and enterprise-grade reliability. The database choice affects every aspect of the application.

## Problem

Which database engine should StockFlow use?

## Decision

**PostgreSQL 16** is the single database engine.

**Rules:**

1. **PostgreSQL only.** No MySQL, MSSQL, SQLite, or MongoDB in the stack.
2. **UUID primary keys** (`@default(uuid())`) for all tables.
3. **Decimal(18, 4)** for all monetary columns — never `float` or `double`.
4. **JSONB** for flexible metadata and audit log payloads.
5. **Enums** for fixed-status fields (SaleStatus, PaymentMethod).
6. **Soft delete** via `deletedAt DateTime?` with composite indexes.
7. **Row version** `Int @default(0)` for optimistic locking.
8. **Indexes on all foreign keys** to prevent sequential scans on joins.
9. **Composite indexes** for multi-tenant queries: `@@index([companyId, status, createdAt])`.

**PostgreSQL-specific features used:**

- `DECIMAL(18,4)` — exact monetary arithmetic
- `UUID` — conflict-free distributed ID generation
- `JSONB` — indexed JSON for audit logs and flexible attributes
- `ENUM` — type-safe status fields
- `PARTITION BY RANGE` — for future financial period partitioning (phase 2)
- `MATERIALIZED VIEW` — for future report optimization (phase 2)
- `ROW LEVEL SECURITY` — reserved for future multi-tenant isolation at the DB level

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **MySQL 8** | Weaker JSON support, no native UUID type, weaker DECIMAL implementation, no materialized views, less robust partitioning |
| **Microsoft SQL Server** | Licensing costs, platform lock-in, no native UUID generation |
| **SQLite** | Not suitable for multi-tenant server deployments; no concurrency |
| **MongoDB** | No ACID transactions across collections, no joins, no schema enforcement, higher storage costs |
| **CockroachDB** | Too early for the team's expertise; adds operational complexity without clear benefit at current scale |

## Consequences

**Positive:**
- ACID compliance for financial transactions
- Proven enterprise reliability (used by SAP, Oracle cloud)
- Excellent tooling (pgAdmin, DataGrip, psql)
- Large talent pool of PostgreSQL engineers
- Free and open source (no licensing costs)

**Negative:**
- Not as fast as specialized time-series or key-value databases for specific workloads
- Connection management requires pooling (pgBouncer for 100+ concurrent connections)
- Horizontal scaling requires read replicas or partitioning (more complex than NoSQL sharding)

**Neutral:**
- PostgreSQL ecosystem evolves slower than NoSQL databases but is more stable

## Future Considerations

- **pgBouncer** for connection pooling at production scale
- **Read replicas** for report queries and dashboards
- **Partitioning** by companyId for 10,000+ companies
- **pg_stat_statements** for query performance monitoring
- **PostgreSQL 17+** features (enhanced MERGE, improved vacuuming)
