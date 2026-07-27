# ADR-001: Repository Pattern

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

StockFlow is a multi-tenant ERP system with a PostgreSQL database accessed through Prisma ORM. Early prototypes mixed database access with business logic, making the system hard to test, maintain, and audit. A consistent data-access layer was needed.

## Problem

How should the application interact with the database to ensure testability, maintainability, and consistent multi-tenancy enforcement?

## Decision

Every module implements a strict **Repository Pattern**:

```
Controller → Service → Repository → PrismaService → PostgreSQL
```

**Rules:**

1. **Repositories own all database queries.** No `prismaService` call may exist outside a repository class.
2. **Repositories accept optional `Prisma.TransactionClient`** as the last parameter on every mutation method. When provided, all operations use that transaction client. When omitted, the repository creates its own connection.
3. **Repositories return raw Prisma models only.** Mappers convert to entities.
4. **Repositories enforce tenant isolation.** Every query includes `where: { companyId }`.
5. **Repositories enforce soft delete.** Every query filters `deletedAt: null` on soft-deletable models.
6. **Repositories implement optimistic locking.** Every update uses `updateMany({ where: { id, companyId, rowVersion } })` and throws `ConflictException` on version mismatch.
7. **Repositories never contain business logic.** They map DTO filters to Prisma `where` clauses, but never validate transitions or calculate values.

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **Active Record** (Prisma models with methods) | Mixes persistence with domain logic; breaks SRP |
| **Raw SQL with query builders** | Loses Prisma's type safety, migrations, and relation loading |
| **Generic CRUD base class only** | Not flexible enough for complex ERP queries (aggregations, groupBy, joins) |
| **CQRS with separate read/write models** | Over-engineering at current scale; can be introduced later |

## Consequences

**Positive:**
- Unit-testable services (repositories can be mocked)
- Consistent multi-tenancy across all modules
- Single place to add caching, logging, or audit
- Transaction propagation is explicit via `tx` parameter

**Negative:**
- Boilerplate: every entity needs a repository, even for simple CRUD
- Layer indirection: simple queries require navigating 3+ files

**Neutral:**
- Base repository (`PrismaBaseRepository`) provides shared utilities (`toDecimal`, `findById`, pagination helpers)

## Future Considerations

- Introduce a **specification pattern** for complex queries
- Add **read-only replica** routing at the repository level
- Generate repository boilerplate with Prisma generators or custom scaffolds
