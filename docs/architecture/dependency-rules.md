# StockFlow Dependency Rules

**Version**: 1.0  
**Date**: 2026-07-25  

This document defines the dependency rules between all architectural layers and modules. Every developer and reviewer must ensure compliance.

---

## Layer Dependency Rules

```
HTTP Request
    │
    ▼
Controller  ────────────  DTO (validation + swagger)
    │
    │  calls
    ▼
Service     ────────────  Mapper (entity conversion)
    │                       │
    │  calls               │
    ▼                       ▼
Repository  ────────────  Prisma ORM (database access)
    │
    │  publishes via
    ▼
EventBus    ────────────  Event Handler (cross-module)
```

### Rule 1: Controller → Service (only)

```
✅ Controller calls Service
✅ Controller reads @CurrentUser()
✅ Controller validates DTO via class-validator
❌ Controller never accesses Prisma
❌ Controller never accesses Repository
❌ Controller never contains business logic
❌ Controller never calls EventBus
```

### Rule 2: Service → Repository | Mapper | EventBus

```
✅ Service calls Repository for data access
✅ Service calls Mapper to convert Prisma types → entities
✅ Service publishes events via EventBus
✅ Service controls Prisma $transaction boundaries
✅ Service calls AuditLogService for audit
❌ Service never accesses Prisma directly
❌ Service never builds raw SQL
❌ Service never contains `as any`
```

### Rule 3: Repository → Prisma (only)

```
✅ Repository builds Prisma query objects
✅ Repository enforces companyId isolation
✅ Repository enforces soft delete (deletedAt: null)
✅ Repository implements optimistic locking (updateMany + rowVersion)
✅ Repository accepts optional tx?: Prisma.TransactionClient
❌ Repository never contains business logic
❌ Repository never publishes events
❌ Repository never calls other repositories
❌ Repository never accesses HTTP context
```

### Rule 4: Mapper → Entity (only)

```
✅ Mapper converts Prisma model → Entity class
✅ Mapper converts Decimal → string
✅ Mapper converts entity lists
❌ Mapper never accesses database
❌ Mapper never contains business logic
❌ Mapper never has side effects
```

### Rule 5: EventBus → EventHandler (only)

```
✅ EventHandler receives DomainEvent
✅ EventHandler receives optional context (transactionClient)
✅ EventHandler calls Service for business operations
❌ EventHandler never publishes events (infinite loop)
❌ EventHandler never accesses HTTP context
```

---

## Module Dependency Rules

### Rule 6: No Business Module depends on Another Business Module

```
❌ Sales → Finance (forbidden)
❌ Finance → Sales (forbidden)
❌ Sales → Inventory (forbidden)
❌ Purchasing → Finance (forbidden)
```

Communication is through events only:

```
✅ Sales → publish → EventBus → Finance (handle)
✅ Finance → publish → EventBus → ... (future)
```

### Rule 7: Reports may read from any Repository (read-only)

```
✅ ReportsModule → SalesRepository.findAll() (read-only)
✅ ReportsModule → JournalEntriesRepository.aggregate() (read-only)
❌ ReportsModule → SalesService.create() (forbidden — mutation)
```

### Rule 8: RBAC is depended upon by all modules

```
✅ SalesModule → RolesGuard, @RequirePermission()
✅ FinanceModule → RolesGuard, @RequirePermission()
✅ All modules → RBAC infrastructure
❌ RBAC → any business module (forbidden)
```

### Rule 9: EventBus is depended upon by modules that publish or consume

```
✅ SalesModule → EventBus (publish)
✅ FinanceModule → EventBus (subscribe)
❌ ReportsModule → EventBus (forbidden — reports don't emit events)
```

### Rule 10: SharedModule provides cross-cutting infrastructure

```
✅ All modules → SharedModule (PrismaService, AuditLogService, RedisService)
❌ SharedModule → any business module (forbidden)
```

---

## File-Level Dependency Rules

### Rule 11: Import Rules

```
✅ import { ... } from './relative/path' — within the same module
✅ import { ... } from '../../../common/events' — event infrastructure
✅ import { ... } from '@prisma/client' — Prisma types
✅ import { ... } from '@nestjs/common' — NestJS decorators
❌ import { ... } from '../other-module/xxx.service' — cross-module service import (forbidden)
❌ import { ... } from '../other-module/xxx.repository' — cross-module repository import (forbidden)
```

### Rule 12: Export Rules

```
✅ Each module exports only its Module class and public services
✅ Repositories are module-scoped (never exported)
✅ Mappers are module-scoped (never exported)
✅ Controllers are module-scoped (never exported)
```

---

## Transaction Dependency Rules

### Rule 13: Service owns the transaction

```
✅ Service opens $transaction
✅ Service passes tx to Repository methods
✅ Service passes tx to AuditLogService
✅ Service passes tx to EventBus via context
❌ Repository never opens its own transaction if tx is provided
❌ Event handler never opens its own transaction if context.tx is provided
```

### Rule 14: No nested transactions

```
❌ prisma.$transaction within another $transaction (forbidden)
✅ Use the same tx object across all operations within a business transaction
```

---

## Circular Dependency Prevention

### Rule 15: No circular imports

```
❌ A → B → C → A (forbidden)
❌ A → B → A (forbidden)

✅ A → B → C (allowed)
✅ A → EventBus → B (allowed)
```

### Rule 16: ESLint enforcement

The project's ESLint configuration should detect and prevent:
- Unused imports
- Cross-module imports (except allowed patterns)
- Circular dependencies

---

## Violation Severity

| Violation | Severity | Action |
|---|---|---|
| Controller accessing Prisma | 🔴 Critical | Reject PR |
| Cross-module service import | 🔴 Critical | Reject PR |
| Repository publishing events | 🟠 High | Reject PR |
| Missing companyId filter | 🔴 Critical | Reject PR |
| Missing soft delete filter | 🟠 High | Reject PR |
| Missing rowVersion check | 🟠 High | Reject PR |
| as any in service | 🟡 Medium | Comment on PR |
| Method > 80 lines | 🟡 Medium | Comment on PR |
| Missing audit log | 🟠 High | Reject PR |
| Missing RBAC permission | 🔴 Critical | Reject PR |
| Missing transaction | 🟠 High | Reject PR |
