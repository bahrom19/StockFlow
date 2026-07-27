# StockFlow DDD Context Map

**Version**: 1.0  
**Date**: 2026-07-25  

This document defines all bounded contexts in the StockFlow ERP system and their communication paths.

---

## Context Map Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         StockFlow ERP                           │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │   Sales    │  │  Finance   │  │ Inventory  │  │Purchasing  ││
│  │  Context   │  │  Context   │  │  Context   │  │  Context   ││
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘│
│         │               │               │               │       │
│         └───────────────┼───────────────┘               │       │
│                         │                               │       │
│                  ┌──────▼───────┐                ┌──────▼──────┐│
│                  │   EventBus   │                │  Reports    ││
│                  │   (Context)  │                │  Context    ││
│                  └──────────────┘                └──────┬──────┘│
│                                                         │       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────▼──────┐│
│  │ Customers  │  │ Suppliers  │  │   Users    │  │    Auth     ││
│  │  Context   │  │  Context   │  │  Context   │  │  Context    ││
│  └────────────┘  └────────────┘  └────────────┘  └──────┬──────┘│
│                                                         │       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────▼──────┐│
│  │     AI     │  │Analytics   │  │Notific.    │  │    RBAC     ││
│  │  Context   │  │  Context   │  │  Context   │  │  Context    ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                 │
│  ┌────────────┐  ┌────────────┐                                  │
│  │ Manufact.  │  │     HR     │  (Future)                       │
│  └────────────┘  └────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Bounded Contexts

### 1. Sales Context

| Property | Value |
|---|---|
| **Ubiquitous Language** | Sale, SaleItem, Payment, Receipt, CashShift, Cashier, Customer |
| **Core Domain** | Yes — primary revenue-generating context |
| **Owned Data** | Sales, payments, receipts, cash shifts |
| **Module** | `modules/sales` |

**Relationships:**
- Publishes events → Finance, Inventory, AI, Analytics, Notifications
- Depends on → RBAC (authorization), Auth (authentication), Users (cashier)
- Reads from → Products (read-only for sale items), Customers (read-only)

---

### 2. Finance Context

| Property | Value |
|---|---|
| **Ubiquitous Language** | ChartOfAccount, JournalEntry, JournalLine, FinancialPeriod, CashAccount, BankAccount, FinancialTransaction, Debit, Credit, COGS, Revenue |
| **Core Domain** | Yes — financial backbone of the ERP |
| **Owned Data** | Chart of accounts, journal entries, financial periods, accounts, transactions |
| **Module** | `modules/finance` |

**Relationships:**
- Consumes events from → Sales (sale.completed, sale.refunded)
- Publishes events → Reports, AI, Analytics
- Depends on → RBAC, Auth

---

### 3. Inventory Context

| Property | Value |
|---|---|
| **Ubiquitous Language** | Stock, StockMovement, Warehouse, Product, Quantity, ReservedQuantity, CostPrice |
| **Core Domain** | Yes — stock accuracy is critical for manufacturing and sales |
| **Owned Data** | Stock levels, stock movements, warehouse definitions |
| **Module** | `modules/inventory` |

**Relationships:**
- Consumes events from → Sales, Purchasing
- Publishes events → Finance, Reports, AI
- Depends on → RBAC, Auth, Products

---

### 4. Purchasing Context

| Property | Value |
|---|---|
| **Ubiquitous Language** | PurchaseOrder, PurchaseOrderItem, GoodsReceipt, PurchaseReturn, Supplier |
| **Core Domain** | Yes — procurement drives inventory and AP |
| **Owned Data** | Purchase orders, goods receipts, purchase returns |
| **Module** | `modules/purchasing` |

**Relationships:**
- Publishes events → Inventory, Finance, AI, Analytics
- Depends on → RBAC, Auth, Suppliers, Products

---

### 5. CRM Context (Customers & Suppliers)

| Property | Value |
|---|---|
| **Ubiquitous Language** | Customer, Supplier, Contact, Address, CreditLimit, PaymentTerms |
| **Supporting Domain** | Supports Sales and Purchasing |
| **Owned Data** | Customer profiles, supplier profiles, contacts, addresses |
| **Modules** | `modules/customers`, `modules/suppliers` |

**Relationships:**
- Publishes events → AI, Analytics
- Consumes events from → Sales (customer stats), Purchasing (supplier stats)
- Depends on → RBAC, Auth

---

### 6. Reports Context

| Property | Value |
|---|---|
| **Ubiquitous Language** | Report, Dashboard, Aggregation, Metric, KPI |
| **Supporting Domain** | Analytical read-only context |
| **Owned Data** | None — reads from all other contexts |
| **Module** | `modules/reports` |

**Relationships:**
- Reads from → ALL contexts (read-only queries via Prisma aggregations)
- Consumes events → (future) to invalidate materialized views
- Depends on → RBAC, Auth

**Special Status**: Reports is the ONLY context allowed to bypass the EventBus and read directly from other modules' repositories.

---

### 7. Auth Context

| Property | Value |
|---|---|
| **Ubiquitous Language** | User, Login, Password, Token, JWT, Session, RefreshToken |
| **Supporting Domain** | Authentication for all contexts |
| **Owned Data** | User credentials, sessions, refresh tokens |
| **Module** | `modules/auth` |

**Relationships:**
- Depends on → Users, RBAC (permissions)
- No business module may bypass Auth

---

### 8. RBAC Context

| Property | Value |
|---|---|
| **Ubiquitous Language** | Role, Permission, UserRole, RolePermission |
| **Generic Subdomain** | Authorization (can be off-the-shelf) |
| **Owned Data** | Roles, permissions, role assignments |
| **Module** | `modules/rbac` |

**Relationships:**
- Depended upon by → ALL contexts
- Depends on → Auth (identity), Users (assignment)

---

### 9. AI Context (Future)

| Property | Value |
|---|---|
| **Ubiquitous Language** | Prediction, Anomaly, Forecast, Recommendation, Insight |
| **Supporting Domain** | Intelligence layer |
| **Owned Data** | ML models, predictions, training data |
| **Module** | (future) |

**Relationships:**
- Consumes events from → ALL contexts
- Depends on → Analytics (feature store)

---

### 10. Analytics Context (Future)

| Property | Value |
|---|---|
| **Ubiquitous Language** | Metric, Dimension, Fact, Trend, Cohort |
| **Supporting Domain** | Business intelligence |
| **Owned Data** | Aggregated metrics, data warehouse |
| **Module** | (future) |

---

### 11. Notifications Context (Future)

| Property | Value |
|---|---|
| **Ubiquitous Language** | Notification, Email, SMS, Push, Template, Preference |
| **Supporting Domain** | User notifications |
| **Owned Data** | Notification templates, delivery logs, preferences |

---

### 12. Marketplace Context (Future)

| Property | Value |
|---|---|
| **Ubiquitous Language** | App, Integration, Webhook, Plugin, Extension |
| **Supporting Domain** | Third-party integrations |

---

## Communication Rules

| Pattern | Allowed? | Example |
|---|---|---|
| Context A → EventBus → Context B | ✅ Always | Sales → EventBus → Finance |
| Context A reads Context B's repository | ❌ Never (except Reports) | |
| Context A calls Context B's service | ❌ Never | |
| Context A publishes → Context A handles | ✅ Allowed | Sales → SaleCompletedEvent → Sales |
| Context A depends on RBAC | ✅ Always | All modules |
| Context A depends on Auth | ✅ Always | All modules |
| Context A depends on Users | ✅ Only for user data | |
| Context A ← EventBus → Context B | ✅ Future | Kafka/RabbitMQ |

## Anti-Corruption Layer

No bounded context may expose its internal entities directly to another context. Communication happens through:

1. **Domain Events** — structured payloads that represent what changed, not how
2. **Event payloads** are versioned — consumers tolerate unknown fields
3. **Direct repository reads** are only allowed for the Reports context (read-only)
