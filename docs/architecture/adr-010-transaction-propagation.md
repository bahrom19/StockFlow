# ADR-010: Transaction Propagation

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

ERP operations span multiple database tables. A single business operation (completing a sale) may update inventory, create stock movements, insert journal entries, update cash shifts, and create audit logs — across up to 10 tables. If any step fails, all prior steps must roll back.

## Problem

How should transactional boundaries be managed across services and repositories in StockFlow?

## Decision

**Interactive Prisma transactions with explicit transaction propagation via the `tx` parameter.**

```typescript
// ✅ CORRECT — Service controls the transaction
async completeSale(id: string, userId: string, companyId: string): Promise<SaleEntity> {
  return this.prismaService.$transaction(async (tx) => {
    const sale = await this.salesRepository.findById(id, companyId, tx);
    // ... business logic ...
    await this.inventoryRepository.decreaseStock(item.productId, item.quantity, tx);
    await this.stockMovementRepository.create(data, tx);
    await this.eventBus.publish(event, { context: { transactionClient: tx } });
    await this.auditLogService.log({ ... }, tx);
    return SaleMapper.toEntity(updated);
  });
}
```

**Rules:**

1. **The SERVICE controls the transaction boundary**, never the repository.
2. **Every repository mutation accepts an optional `tx?: Prisma.TransactionClient`** as the last parameter.
3. **If `tx` is provided, the repository uses it.** If omitted, the repository creates its own connection.
4. **Multi-table operations use `prisma.$transaction(async (tx) => { ... })`**.
5. **Event handlers execute inside the same transaction** via `context.transactionClient`.
6. **Audit log writes happen inside the same transaction** — they roll back together.
7. **READ operations do not require a transaction** unless they must see their own writes.
8. **No nested transactions.** The Prisma `$transaction` callback provides a single `TransactionClient` that manages all writes atomically.
9. **The helper `private prisma(tx?: Prisma.TransactionClient)`** pattern in repositories ensures consistent client selection:

```typescript
private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
  return tx ?? this.prismaService;
}
```

**Transaction scopes:**

| Operation | Transaction Scope | Tables Involved |
|---|---|---|
| Create Sale | ✅ $transaction | Sale, SaleItem, Payment |
| Complete Sale | ✅ $transaction | Sale, Stock, StockMovement, Receipt, CashShift, AuditLog, JournalEntry |
| Refund Sale | ✅ $transaction | Sale, Stock, StockMovement, AuditLog, JournalEntry |
| Create Purchase Order | ✅ $transaction | PurchaseOrder, PurchaseOrderItem |
| Receive Goods | ✅ $transaction | PurchaseOrder, GoodsReceipt, Stock, StockMovement |
| Post Journal Entry | ✅ $transaction | JournalEntry, JournalLine, FinancialPeriod |
| Close Period | ✅ $transaction | FinancialPeriod (status + version) |

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **@Transactional decorator (like Spring)** | TypeScript decorators cannot wrap Prisma's interactive transaction API; adds magic behavior |
| **Repository-owned transactions** | Repositories would need to know the scope of the business operation — violates SRP |
| **Unit of Work pattern** | Over-engineering; Prisma's $transaction already provides this abstraction |
| **Saga pattern** | Too complex for synchronous in-process operations; reserved for future distributed transactions |

## Consequences

**Positive:**
- Full atomicity — all-or-nothing for every business operation
- Explicit and readable — the transaction boundary is clear in the service code
- Testable — transactions can be mocked at the service boundary
- Consistent pattern across all modules

**Negative:**
- Verbose — every repository method needs a `tx?` parameter
- Long-running transactions can hold database locks (mitigated by keeping transactions short)
- Read operations inside transactions unnecessarily use transaction connections

**Neutral:**
- `$transaction` supports a maximum of 30 seconds (configurable)
- Connection pool size determines concurrent transaction capacity

## Future Considerations

- **Distributed transactions** via Saga pattern when services are split into separate processes
- **Read-only transactions** for consistency-sensitive reads (e.g., financial reports)
- **Transaction timeout monitoring** for detecting long-running transactions
- **Deadlock detection** via Prisma retry logic
