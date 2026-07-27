# StockFlow Module Contracts

**Version**: 1.0  
**Date**: 2026-07-25  

This document defines the public contracts of every StockFlow module. Each module's contract specifies what events it publishes, what events it consumes, and what other modules it may directly depend on.

---

## Sales Module

**Directory**: `modules/sales`

### Publishes

| Event | Payload | When |
|---|---|---|
| `sale.completed` | `SaleCompletedEventPayload` | Sale transitions PENDING → COMPLETED |
| `sale.refunded` | `SaleRefundedEventPayload` | Sale transitions COMPLETED → REFUNDED |

### Consumes

| Event | Handler | Action |
|---|---|---|
| (none currently) | | |

### Direct Dependencies

| Module | Usage | Reason |
|---|---|---|
| SharedModule | AuditLogService, PrismaService | Audit trail, database access |
| EventBus (via common/events) | EventBus | Publish domain events |

### Forbidden Dependencies

❌ FinanceModule  
❌ InventoryModule (future: consume events instead)  
❌ PurchasingModule  
❌ ReportsModule  

---

## Finance Module

**Directory**: `modules/finance`

### Publishes

| Event | Payload | When |
|---|---|---|
| `journal.posted` | (future) | Journal Entry is posted |
| `period.closed` | (future) | Financial period is closed |

### Consumes

| Event | Handler | Action |
|---|---|---|
| `sale.completed` | `SaleCompletedEventHandler` | Create journal entries (debit cash/AR, credit revenue, debit COGS, credit inventory) |
| `sale.refunded` | `SaleRefundedEventHandler` | Reverse journal entries (debit revenue, credit cash) |
| (future) `purchase.received` | | Create AP journal entries |
| (future) `purchase.returned` | | Reverse AP journal entries |
| (future) `inventory.adjusted` | | Create inventory adjustment journal entries |

### Direct Dependencies

| Module | Usage | Reason |
|---|---|---|
| SharedModule | AuditLogService, PrismaService, PrismaBaseRepository | Audit trail, database access |
| EventBus | EventBus | Subscribe to events |

### Forbidden Dependencies

❌ SalesModule  
❌ PurchasingModule  
❌ InventoryModule  
❌ ReportsModule  

---

## Inventory Module

**Directory**: `modules/inventory`

### Publishes

| Event | Payload | When |
|---|---|---|
| `inventory.adjusted` | (future) | Stock adjusted |
| `inventory.reserved` | (future) | Stock reserved |
| `inventory.transferred` | (future) | Stock transferred between warehouses |

### Consumes

| Event | Handler | Action |
|---|---|---|
| (future) `sale.completed` | | Verify stock decrease, update inventory valuation |
| (future) `sale.refunded` | | Verify stock increase, restore inventory value |
| (future) `purchase.received` | | Increase stock, update average cost |

### Direct Dependencies

| Module | Usage | Reason |
|---|---|---|
| SharedModule | PrismaService, AuditLogService | Database access, audit trail |
| EventBus | EventBus | Publish and subscribe to events |

### Forbidden Dependencies

❌ SalesModule  
❌ FinanceModule  
❌ PurchasingModule (except for event payload types)  
❌ ReportsModule  

---

## CRM Module (Customers & Suppliers)

**Directory**: `modules/customers`, `modules/suppliers`

### Publishes

| Event | Payload | When |
|---|---|---|
| `customer.created` | (future) | Customer registered |
| `supplier.created` | (future) | Supplier registered |

### Consumes

| Event | Handler | Action |
|---|---|---|
| (future) `sale.completed` | | Update customer purchase stats (total spent, last purchase date) |
| (future) `payment.received` | | Update customer balance |

### Direct Dependencies

| Module | Usage | Reason |
|---|---|---|
| SharedModule | PrismaService, AuditLogService | Database access, audit trail |
| EventBus | EventBus | Publish and subscribe to events |

---

## Purchasing Module

**Directory**: `modules/purchasing`

### Publishes

| Event | Payload | When |
|---|---|---|
| `purchase.created` | (future) | Purchase order submitted |
| `purchase.received` | (future) | Goods received |

### Consumes

| Event | Handler | Action |
|---|---|---|
| (future) `supplier.created` | | Pre-populate purchase terms |

### Direct Dependencies

| Module | Usage | Reason |
|---|---|---|
| SharedModule | PrismaService, AuditLogService | Database access, audit trail |
| EventBus | EventBus | Publish and subscribe to events |

---

## Reports Module

**Directory**: `modules/reports`

### Publishes

None (read-only module).

### Consumes

None (queries data directly from repositories via Prisma aggregations).

### Direct Dependencies

| Module | Usage | Reason |
|---|---|---|
| SharedModule | PrismaService | Database access for aggregations |
| Sales Module (repositories) | SalesRepository | Direct read-only queries |
| Finance Module (repositories) | JournalEntriesRepository | Direct read-only queries |
| Inventory Module (repositories) | StockRepository | Direct read-only queries |
| CRM Module (repositories) | CustomerRepository, SupplierRepository | Direct read-only queries |
| Purchasing Module (repositories) | PurchaseOrderRepository | Direct read-only queries |

**Note**: Reports module is the ONLY module that may read from other modules' repositories directly. This is an exception because:
1. Reports are read-only — they never mutate data
2. Reports need efficient aggregation queries that are impractical through events
3. Reports are not business operations — they are analytical queries

### Forbidden Dependencies

❌ Any service that can mutate data  
❌ EventBus (reports should not publish events)  

---

## RBAC Module

**Directory**: `modules/rbac`

### Publishes

None.

### Consumes

None.

### Direct Dependencies

| Module | Usage | Reason |
|---|---|---|
| SharedModule | PrismaService | Database access |
| Auth Module | JwtService, AuthRepository | Permission loading |

### Purpose

This module provides:
- Permission definitions
- Role management
- UserRole assignments
- Guards (`RolesGuard`, `@RequirePermission()`)
- Permission seeding

Every other module depends on RBAC for authorization. RBAC depends on no business module.

---

## Auth Module

**Directory**: `modules/auth`

### Publishes

None.

### Consumes

None.

### Direct Dependencies

| Module | Usage | Reason |
|---|---|---|
| SharedModule | PrismaService, RedisService | Database, session caching |
| Users Module | UsersService | User lookup for authentication |
| RBAC Module | RolesService, PermissionsService | Permission loading into JWT |

---

## Users Module

**Directory**: `modules/users`

### Publishes

None.

### Consumes

None.

### Direct Dependencies

| Module | Usage | Reason |
|---|---|---|
| SharedModule | PrismaService | Database access |
| RBAC Module | RolesService, PermissionsService | User-role assignment |

---

## Health Module

**Directory**: `modules/health`

### Publishes

None.

### Consumes

None.

### Direct Dependencies

None (simple health check endpoint).

---

## Dependency Graph

```
Users ──── Auth ──── RBAC
   │                   │
   │                   ├── Sales
   │                   ├── Finance
   │                   ├── Inventory
   │                   ├── Customers
   │                   ├── Suppliers
   │                   ├── Purchasing
   │                   └── Reports ← reads from all modules' repositories
   │
   └─── EventBus ← [Sales, Finance, Inventory, Customers, Suppliers, Purchasing]
```

**Rules:**
1. No business module depends on another business module.
2. All cross-module communication goes through the EventBus.
3. Only Reports module may read from other modules' repositories (read-only).
4. RBAC module is depended upon by all modules (guards, decorators).
5. EventBus is the only allowed cross-module dependency for write operations.
