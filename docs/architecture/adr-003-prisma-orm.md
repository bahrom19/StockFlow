# ADR-003: Prisma ORM

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

StockFlow requires a database access layer that provides type safety, migration management, and support for PostgreSQL-specific features (Decimal, UUID, indexes, composite keys).

## Problem

Which ORM should be used to access PostgreSQL in a TypeScript NestJS application?

## Decision

**Prisma ORM v6** is the single data-access technology.

**Rules:**

1. **Prisma is the only ORM.** No TypeORM, MikroORM, Knex, or raw SQL.
2. **Schema is the single source of truth.** Every database change starts with `schema.prisma`.
3. **All database access goes through Prisma clients.** Never through raw connections or query builders.
4. **Prisma Client is generated on build** via `npx prisma generate`.
5. **Migrations are managed with Prisma Migrate** — never manual SQL migrations.
6. **Prisma Studio** is used for development debugging only, never in production.

**Key Prisma features used:**

- `@unique` and `@@unique` constraints
- `@@index` and `@@id([companyId, id])` composite indexes
- `Decimal(18, 4)` for all money fields
- `@default(uuid())` for primary keys
- `@updatedAt` / `@default(now())` for audit fields
- `deletedAt DateTime?` for soft delete
- `rowVersion Int @default(0)` for optimistic locking
- `relationMode = "foreignKeys"` for referential integrity
- `prisma.$transaction()` for multi-table writes
- `prisma.$transaction(async (tx) => { ... })` for interactive transactions

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **TypeORM** | Heavier, less performant at scale, decorator-based schema (mixes concerns), slower migration tooling |
| **MikroORM** | Smaller community, less enterprise adoption, complex identity map |
| **Knex.js** | No type-safe queries, no migration generation, manual schema management |
| **Raw SQL with pg** | Loses all type safety, no migration management, error-prone |
| **Drizzle ORM** | Newer, smaller ecosystem, less mature for enterprise use cases |

## Consequences

**Positive:**
- Full type safety — Prisma generates TypeScript types from the schema
- Auto-complete in IDE for all queries, relations, and filters
- Migration generation and validation
- Excellent PostgreSQL support (enums, Decimal, arrays, JSON)
- Interactive transactions for multi-table business operations

**Negative:**
- Generated client must be re-generated after every schema change
- N+1 queries require explicit `include` or `select` — no lazy loading
- Complex queries (window functions, CTEs) require raw queries or Prisma raw access
- Schema changes require migrations, adding latency to development

**Neutral:**
- Prisma's `select` and `include` approach is explicit but verbose
- Middleware/hooks are available for cross-cutting concerns (audit, soft delete)

## Future Considerations

- Evaluate **Prisma Pulse** for real-time change data capture
- Consider **Prisma Accelerate** for connection pooling at global scale
- Monitor Drizzle ORM maturity for potential future migration if Prisma adoption declines
