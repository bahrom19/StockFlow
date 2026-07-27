# ADR-009: Audit Logging

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

ERP systems process financial transactions and customer data that must be auditable for legal, regulatory, and compliance purposes. Every state change must be traceable to who performed it, when, and what changed.

## Problem

How should StockFlow implement audit logging to satisfy SOX, IFRS, and Kazakhstan accounting requirements?

## Decision

**Structured audit logs created inside the same database transaction as the business operation.**

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  companyId String
  userId    String
  entity    String   // e.g., "Sale", "JournalEntry"
  entityId  String   // the ID of the affected record
  action    String   // CREATE, UPDATE, DELETE, POST, CLOSE, COMPLETED, REFUNDED, CANCELLED
  oldValues Json?    // previous state (for UPDATE, DELETE)
  newValues Json?    // new state (for CREATE, UPDATE)
  timestamp DateTime @default(now())
  requestId String?
}
```

**Rules:**

1. **Every mutation logs an audit entry.** Create, update, delete, status transition, post, close, cancel, refund.
2. **Audit logs are created inside the same `Prisma.$transaction()`** as the business operation. If the transaction rolls back, the audit log also rolls back.
3. **`AuditLogService` is a reusable NestJS service** injected into every module's services.
4. **`entity` field follows the Prisma model name** (e.g., "Sale", "ChartOfAccount", "JournalEntry").
5. **`action` field uses UPPER_SNAKE_CASE** (CREATE, UPDATE, DELETE, COMPLETED, REFUNDED).
6. **`oldValues` and `newValues` are JSONB** — they store only the changed fields for updates, or the full record for creates/deletes.
7. **Sensitive fields (passwords, tokens) are NEVER logged.**
8. **Audit logs are immutable** — no update or delete operation on audit log records.
9. **Audit logs have no soft delete** — they are the single source of truth.
10. **Audit logs are never purged.** Historical archive after 7 years.

**Usage pattern:**

```typescript
// Inside a $transaction callback:
await this.auditLog.log({
  companyId,
  userId,
  entity: 'Sale',
  entityId: sale.id,
  action: 'COMPLETED',
  newValues: { status: 'COMPLETED', total: sale.total.toString() },
}, tx);  // pass the transaction client
```

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **Prisma middleware** | Cannot access HTTP context (userId, requestId); runs outside the transaction scope |
| **Database triggers** | Hard to maintain, version-controlled, and debug; cannot access application context |
| **Separate audit service (async)** | Risk of audit log not being created if the async process fails; violates audit integrity |
| **Logging to file** | Not queryable; no structured filtering; hard to produce audit reports |

## Consequences

**Positive:**
- Full traceability of every state change
- Audit logs are automatically rolled back with business transactions — no orphaned logs
- Queryable via Prisma (can filter by company, entity, action, date range)
- JSONB allows flexible schema evolution (oldValues/newValues can hold any structure)

**Negative:**
- Transaction size increases (audit log write adds latency)
- Storage grows with every mutation (mitigated by archive after 7 years)
- Risk of accidentally logging sensitive data (mitigated by code review)

**Neutral:**
- `oldValues`/`newValues` are JSON, not strongly typed — validation happens at write time

## Future Considerations

- **Audit log viewer** — admin UI for filtering and exporting audit logs
- **Compliance reports** — automated SOX/IFRS audit reports from audit log data
- **Change data capture** — use audit log for event sourcing or CDC integration
- **Immutable storage** — WAL-based audit storage for tamper-proof logging (phase 3)
