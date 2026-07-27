# ADR-007: Optimistic Locking

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

In a multi-user ERP system, concurrent edits to the same record can cause lost updates. For example, two cashiers updating the same product's price, or two buyers confirming the same purchase order. Without locking, the last writer silently overwrites the first writer's changes.

## Problem

How should concurrent write conflicts be detected and prevented in StockFlow?

## Decision

**Optimistic locking via `rowVersion` integer, checked atomically with `updateMany`.**

```prisma
model ChartOfAccount {
  rowVersion Int @default(0)
  // ...
}
```

**Update pattern (REQUIRED in every repository):**

```typescript
async update(
  id: string,
  data: Prisma.XxxUpdateInput,
  companyId: string,
  rowVersion: number,
  tx?: Prisma.TransactionClient,
): Promise<Xxx> {
  const prisma = tx ?? this.prismaService;
  
  const result = await prisma.xxx.updateMany({
    where: { id, companyId, rowVersion },
    data: { ...data, rowVersion: { increment: 1 } },
  });

  if (result.count === 0) {
    const existing = await prisma.xxx.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('Record not found');
    throw new ConflictException(
      'Record was modified by another user. Please refresh and try again.',
    );
  }

  return prisma.xxx.findUnique({ where: { id } }) as Promise<Xxx>;
}
```

**Rules:**

1. **Every mutable entity has `rowVersion Int @default(0)`**.
2. **All update operations use `updateMany` with `rowVersion` in WHERE**, never `update` or `findFirst` + check + `update`.
3. **Soft deletes also use the same pattern:** `updateMany({ where: { id, companyId, rowVersion }, data: { deletedAt: new Date(), rowVersion: { increment: 1 } } })`.
4. **The service MUST pass `rowVersion`** from the entity it read to the repository update call.
5. **The repository MUST throw `ConflictException`** (HTTP 409) on version mismatch.
6. **The `ConflictException` message MUST instruct the user to refresh and retry.
7. **Mappers MUST include `rowVersion`** in entity responses so the frontend can submit it with updates.

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **Pessimistic locking (SELECT FOR UPDATE)** | Locks database rows across HTTP requests; poor DX for long-lived forms; scales poorly |
| **Timestamp-based (updatedAt)** | Prone to clock skew; concurrent updates within the same millisecond are undetected |
| **No locking** | Silent data loss; violates ERP data integrity requirements |
| **Application-level mutex** | Introduces distributed locking complexity; adds latency |

## Consequences

**Positive:**
- No lost updates in concurrent scenarios
- No database row locks — good UX for long-lived edit forms
- Simple integer comparison — fast and reliable
- Self-documenting: the `rowVersion` field is impossible to ignore

**Negative:**
- `ConflictException` requires user to re-apply changes
- All API consumers must track `rowVersion` (frontend, mobile, API clients)
- Adds one extra query on conflict (diagnostic `findFirst`) — acceptable because conflicts are rare

**Neutral:**
- `rowVersion` is incremented automatically by Prisma `increment: 1`
- Reset to 0 on record creation

## Future Considerations

- **ETags** for REST API-level optimistic locking (complementary to database rowVersion)
- **GraphQL** — `rowVersion` maps naturally to a mutation input field
- **Batch operations** — `updateMany` with `rowVersion` checks in WHERE works for batch updates too
