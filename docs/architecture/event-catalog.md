# StockFlow Event Catalog

**Version**: 1.0  
**Date**: 2026-07-25  

This document catalogs every domain event in StockFlow. All events follow the `DomainEvent` interface defined in `common/events/domain-event.interface.ts` and are published through the `EventBus` interface.

---

## Event Definitions

---

### `sale.completed`

| Property | Value |
|---|---|
| **Publisher** | Sales Module — `SalesService.completeSale()` |
| **Current Subscribers** | Finance Module — `SaleCompletedEventHandler` |
| **Future Subscribers** | Inventory Module, Loyalty Module, Notification Module, AI Analytics Module |
| **Trigger** | Sale status transitions from PENDING → COMPLETED |
| **Idempotent** | Yes — handler checks if journal entry for the sale already exists |
| **Transaction** | Always published inside `Prisma.$transaction` — handlers receive `context.transactionClient` |
| **Retry Policy** | No retry (sync in-process); errors propagate and roll back the entire transaction |

**Payload** (`SaleCompletedEventPayload`):
```typescript
{
  saleId: string;
  companyId: string;
  warehouseId: string;
  cashierId: string;
  customerId: string | null;
  saleNumber: string;
  subtotal: string;       // Decimal as string
  discount: string;
  total: string;
  paidAmount: string;
  changeAmount: string;
  currency: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: string;
    costPrice: string;
    discount: string;
    subtotal: string;
    total: string;
    margin: string;
  }>;
  payments: Array<{
    method: string;       // CASH | CARD | QR | BANK_TRANSFER | STORE_CREDIT | GIFT_CARD
    amount: string;
  }>;
}
```

---

### `sale.refunded`

| Property | Value |
|---|---|
| **Publisher** | Sales Module — `SalesService.refundSale()` |
| **Current Subscribers** | Finance Module — `SaleRefundedEventHandler` |
| **Future Subscribers** | Inventory Module, Loyalty Module, Notification Module |
| **Trigger** | Sale status transitions from COMPLETED → REFUNDED |
| **Idempotent** | Yes |
| **Transaction** | Always published inside `Prisma.$transaction` |
| **Retry Policy** | No retry; errors propagate and roll back |

**Payload** (`SaleRefundedEventPayload`):
```typescript
{
  saleId: string;
  companyId: string;
  warehouseId: string;
  cashierId: string;
  saleNumber: string;
  total: string;
  currency: string;
  items: SaleItemEvent[];
  payments: PaymentEvent[];
}
```

---

### `purchase.created`

| Property | Value |
|---|---|
| **Publisher** | Purchasing Module — `PurchaseOrdersService.create()` |
| **Current Subscribers** | None |
| **Future Subscribers** | Finance Module (AP accrual), Notification Module, AI Analytics |
| **Trigger** | Purchase Order transitions from DRAFT → SUBMITTED |
| **Idempotent** | Yes |
| **Transaction** | Yes |
| **Retry Policy** | No retry |

---

### `purchase.received`

| Property | Value |
|---|---|
| **Publisher** | Purchasing Module — `GoodsReceiptService.create()` |
| **Current Subscribers** | None |
| **Future Subscribers** | Inventory Module (stock increase), Finance Module (AP → Payment), Notification Module |
| **Trigger** | Goods Receipt created against a Purchase Order |
| **Idempotent** | Yes |
| **Transaction** | Yes |

---

### `inventory.adjusted`

| Property | Value |
|---|---|
| **Publisher** | Inventory Module — `InventoryService.adjustStock()` |
| **Current Subscribers** | None |
| **Future Subscribers** | Finance Module (inventory valuation), Reports Module, AI Analytics |
| **Trigger** | Manual or system stock adjustment |
| **Idempotent** | Yes |
| **Transaction** | Yes |

---

### `inventory.reserved`

| Property | Value |
|---|---|
| **Publisher** | Inventory Module |
| **Current Subscribers** | None |
| **Future Subscribers** | Sales Module, Warehouse Module |
| **Trigger** | Stock reserved for a pending sale or production order |
| **Idempotent** | Yes |
| **Transaction** | Yes |

---

### `inventory.transferred`

| Property | Value |
|---|---|
| **Publisher** | Inventory Module — `InventoryService.transferStock()` |
| **Current Subscribers** | None |
| **Future Subscribers** | Warehouse Module, Reports Module |
| **Trigger** | Stock transferred between warehouses |
| **Idempotent** | Yes |
| **Transaction** | Yes |

---

### `payment.received`

| Property | Value |
|---|---|
| **Publisher** | Sales Module / Finance Module |
| **Current Subscribers** | None |
| **Future Subscribers** | Finance Module (AR reconciliation), Notification Module, AI Analytics |
| **Trigger** | Payment received from customer |
| **Idempotent** | Yes |
| **Transaction** | Yes |

---

### `payment.failed`

| Property | Value |
|---|---|
| **Publisher** | Sales Module |
| **Current Subscribers** | None |
| **Future Subscribers** | Notification Module, Customer Module (credit check) |
| **Trigger** | Payment processing failure (card declined, insufficient funds) |
| **Idempotent** | Yes |
| **Transaction** | Yes |

---

### `journal.posted`

| Property | Value |
|---|---|
| **Publisher** | Finance Module — `JournalEntriesService.post()` |
| **Current Subscribers** | None |
| **Future Subscribers** | Reports Module, AI Analytics, Audit Module |
| **Trigger** | Journal Entry status changes from DRAFT → POSTED |
| **Idempotent** | Yes |
| **Transaction** | Yes |

---

### `period.closed`

| Property | Value |
|---|---|
| **Publisher** | Finance Module — `FinancialPeriodsService.close()` |
| **Current Subscribers** | None |
| **Future Subscribers** | Reports Module, Sales Module (prevent sales in closed period) |
| **Trigger** | Financial Period status changes to CLOSED |
| **Idempotent** | Yes |
| **Transaction** | Yes |

---

### `customer.created`

| Property | Value |
|---|---|
| **Publisher** | CRM Module — `CustomersService.create()` |
| **Current Subscribers** | None |
| **Future Subscribers** | AI Analytics, Notification Module, Loyalty Module |
| **Trigger** | New customer registered |
| **Idempotent** | Yes |
| **Transaction** | Recommended but not required |

---

### `supplier.created`

| Property | Value |
|---|---|
| **Publisher** | CRM Module — `SuppliersService.create()` |
| **Current Subscribers** | None |
| **Future Subscribers** | Purchasing Module, Finance Module (AP setup), AI Analytics |
| **Trigger** | New supplier registered |
| **Idempotent** | Yes |
| **Transaction** | Recommended but not required |

---

## Event Naming Convention

| Pattern | Example |
|---|---|
| `<module>.<action>` | `sale.completed`, `inventory.adjusted` |
| Past tense action | `created`, `updated`, `completed`, `refunded`, `received`, `closed`, `posted`, `failed`, `transferred` |
| Lowercase only | `sale.completed`, `journal.posted` |

---

## Publishing Rules

1. Events are published **after** the primary write (inventory, status update) but **before** the transaction commits.
2. Events carry **snapshot values**, not references — e.g., `total: "100.00"` not `sale.total` (which can change).
3. Events never carry **sensitive data** (passwords, tokens, PII beyond customerId).
4. Events never carry **binary data** (images, files) — only references (URLs, IDs).
5. New event fields must be **optional or defaulted** — consumers must tolerate unknown fields.

---

## Subscriber Registration

Subscribers register via `EventBus.subscribe()` in `OnModuleInit`:

```typescript
@Module({})
export class FinanceModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly handler: SaleCompletedEventHandler,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('sale.completed', this.handler);
  }
}
```
