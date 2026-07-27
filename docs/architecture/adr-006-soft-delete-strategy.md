# ADR-006: Soft Delete Strategy

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

ERP data is auditable by law. Deleting a record must be reversible within the audit window. Accounting records (journal entries, payments, invoices) must never be physically deleted.

## Problem

How should record deletion work in StockFlow to satisfy audit requirements, data recovery, and referential integrity?

## Decision

**Soft delete via `deletedAt` timestamp.**

```prisma
model Product {
  id        String    @id @default(uuid())
  companyId String
  deletedAt DateTime?
  // ...

  @@index([companyId, deletedAt])
}
```

**Rules:**

1. **Every mutable entity has `deletedAt DateTime?`**. Immutable entities (journal entries, audit logs) do not.
2. **Soft delete sets `deletedAt`** to the current timestamp. The record remains in the database.
3. **All repository READ queries filter `deletedAt: null`** unless explicitly requesting deleted records.
4. **Soft-delete cascade is manual.** Related records are soft-deleted individually in a transaction.
5. **Unique constraints must account for deletedAt.** Use partial unique indexes:
   ```sql
   CREATE UNIQUE INDEX idx_product_sku_active
   ON product (company_id, sku)
   WHERE deleted_at IS NULL;
   ```
6. **Repository restore method** sets `deletedAt = null` for recovery operations.
7. **Physically deleted records** are only removed via a scheduled purge job for records older than the legal retention period (7 years).

**Modules with soft delete:**
- Products
- Customers
- Suppliers
- Users
- Chart of Accounts
- Sales (DRAFT only — COMPLETED sales are never deleted)
- Purchase Orders (DRAFT only)

**Modules WITHOUT soft delete (immutable):**
- Journal Entries (once posted)
- Audit Logs
- Stock Movements

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **Hard delete** | Violates audit requirements; data loss unrecoverable |
| **IsDeleted boolean** | Less informative than a timestamp; no ability to know WHEN deletion occurred |
| **DeletedAt + deletedBy** | Useful but adds complexity; who deleted can be derived from audit log |
| **Separate archive table** | Complex migration, breaks Prisma relations, harder to manage |

## Consequences

**Positive:**
- All data is recoverable within the audit window
- Referential integrity is preserved
- Users see only active records by default
- Support can query deleted records for troubleshooting

**Negative:**
- Composite unique constraints require partial indexes
- Storage grows (mitigated by scheduled purge)
- Every query needs `deletedAt: null` — easy to forget (mitigated by review checklist)

**Neutral:**
- Scheduled purge job runs monthly for records > 7 years old
- Purge uses a separate archive database before deleting

## Future Considerations

- **deletedBy** field for tracking who performed the deletion (currently from audit log)
- **Legal hold** — prevent purge of records under active legal hold
- **Recycle bin** — UI for restoring recently deleted records (30-day window)
