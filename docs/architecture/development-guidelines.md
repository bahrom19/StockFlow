# 📐 StockFlow Enterprise — Development Guidelines v1.0

**Status:** ✅ MANDATORY — All code must comply  
**Date:** July 26, 2026  
**Supersedes:** Coding Standards v1.0 (incorporated and extended)  

---

## 1. Architecture Rules (Must Not Be Violated)

### 1.1 Layer Isolation

```
Request ──► Controller ──► Service ──► Repository ──► Prisma
                    │              │            │
                    │              │            └── Always accept tx?: TransactionClient
                    │              │
                    │              ├── Call Mapper (Prisma → Entity)
                    │              ├── Call EventBus.publish(event, { context: { tx } })
                    │              └── Call AuditLogService.log({ ... }, tx)
                    │
                    └── Validate DTO (class-validator)
```

| Layer | Responsibility | Must NOT |
|-------|---------------|----------|
| **Controller** | Receive request, validate DTO, call service, return result | Access Prisma, contain business logic, call repositories |
| **Service** | Orchestrate business logic, control transactions, publish events | Access Prisma directly, cross-module imports, `as any` |
| **Repository** | Build Prisma queries, enforce company isolation, enforce soft delete, implement OL | Contain business logic, publish events, call other repos |
| **Mapper** | Convert Prisma types → Entity, Decimal → string | Access database, contain business logic, side effects |
| **Entity** | Data shape — plain class or interface | Contain logic |

### 1.2 Forbidden Patterns

```
❌ Controller accessing PrismaService — REJECT PR
❌ Service calling another module's service directly — REJECT PR
❌ Service importing another module's repository — REJECT PR
❌ Repository publishing events — REJECT PR
❌ Repository calling other repositories — REJECT PR
❌ Missing companyId filter in any query — REJECT PR
❌ Missing deletedAt: null filter in soft-deletable entities — REJECT PR
❌ Missing rowVersion check in update/delete — REJECT PR
❌ as any in services — REJECT PR
❌ Cross-module import of business services — REJECT PR
❌ Missing $transaction on multi-table writes — REJECT PR
```

---

## 2. Multi-Tenancy Rules

### 2.1 companyId Isolation

```
✅ Every table has companyId
✅ Every repository query includes where: { companyId }
✅ companyId comes from JWT (req.user.companyId) — NEVER from user input
✅ Composite indexes start with companyId
✅ Unique constraints include companyId: @@unique([companyId, code])
✅ Cross-company queries are FORBIDDEN
```

### 2.2 How companyId Flows

```
Request → JwtAuthGuard decodes JWT → payload.companyId
  → @CurrentUser() decorator extracts companyId
  → Controller passes companyId to Service
  → Service passes companyId to Repository
  → Repository includes companyId in every Prisma query
```

---

## 3. Transaction Rules

### 3.1 When to Use $transaction

```
✅ Multi-table CREATE — MUST use $transaction
✅ Multi-table UPDATE — MUST use $transaction
✅ Status transitions — MUST use $transaction
✅ Event publishing — MUST pass transactionClient in context
✅ Audit logging — MUST pass tx to AuditLogService.log()
✅ Inventory + Finance + Sales cross-cutting operations — MUST use $transaction
❌ Single-table reads — NO transaction needed
❌ Single-table writes (no audit, no events) — NO transaction needed
```

### 3.2 Transaction Pattern

```typescript
// ✅ CORRECT — Service controls transaction
async completeSale(id: string, userId: string, companyId: string): Promise<SaleEntity> {
  return this.prismaService.$transaction(async (tx) => {
    // 1. Read within transaction
    const sale = await this.salesRepo.findById(id, companyId, tx);

    // 2. Validate
    if (!sale) throw new NotFoundException('Sale not found');

    // 3. Mutate
    const updated = await this.salesRepo.update(id, data, companyId, rowVer, tx);

    // 4. Audit
    await this.auditLogService.log({ ... }, tx);

    // 5. Events (with transaction context)
    await this.eventBus.publish(event, { context: { transactionClient: tx } });

    // 6. Return
    return SaleMapper.toEntity(updated);
  });
}
```

---

## 4. Optimistic Locking Rules

### 4.1 Every Mutation Must Use updateMany

```typescript
// ✅ CORRECT
async update(
  id: string, data: Prisma.XxxUpdateInput,
  companyId: string, rowVersion?: number,
  tx?: Prisma.TransactionClient,
): Promise<Xxx> {
  const prisma = tx ?? this.prismaService;
  const result = await prisma.xxx.updateMany({
    where: { id, companyId, rowVersion },
    data: { ...data, rowVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    const existing = await prisma.xxx.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException();
    throw new ConflictException('Modified by another user — refresh and retry');
  }
  return prisma.xxx.findUnique({ where: { id } }) as Promise<Xxx>;
}

// ❌ WRONG — TOCTOU race condition
async update(id, data, companyId) {
  const existing = await this.prisma.xxx.findUnique({ where: { id } }); // Step 1
  // ... concurrent update happens here ...
  return this.prisma.xxx.update({ where: { id }, data }); // Step 2 — overwrites silently
}
```

### 4.2 Service Must Read rowVersion

```typescript
// ✅ CORRECT
async update(id: string, dto: UpdateDto, userId: string, companyId: string): Promise<Entity> {
  return this.prismaService.$transaction(async (tx) => {
    const existing = await this.repo.findById(id, companyId, tx);
    if (!existing) throw new NotFoundException();
    const updated = await this.repo.update(id, data, companyId, existing.rowVersion, tx);
    // ...
  });
}
```

---

## 5. Event Publishing Rules

### 5.1 Correct Pattern

```typescript
// ✅ CORRECT
await this.eventBus.publish(new SaleCompletedEvent({
  saleId: sale.id,
  companyId: companyId,
  // ...
}), {
  context: { transactionClient: tx }  // Pass tx so handlers run in same transaction
});

// ❌ WRONG — handler cannot participate in the same transaction
await this.eventBus.publish(event);
```

### 5.2 Event Naming

```
Format: "<module>.<action>"
Examples: sale.completed, sale.refunded, purchase.received, inventory.adjusted

Module names: sale, purchase, inventory, finance, customer, supplier, journal
Action names: completed, refunded, received, adjusted, created, updated, deleted, posted, closed, cancelled
```

---

## 6. RBAC Rules

### 6.1 Every Endpoint Must Be Protected

```typescript
// ✅ CORRECT — every endpoint
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission('module:action')
@Post()
async create(@Body() dto: CreateDto, @CurrentUser() user: JwtPayload) {
  return this.service.create(dto, user.userId, user.companyId);
}

// ❌ WRONG — missing guards
@Post()
async create(@Body() dto: CreateDto) {
  return this.service.create(dto);
}
```

### 6.2 Permission Format

```
Format: "<module>:<action>"

Module prefixes:
  sales:create, sales:read, sales:update, sales:refund, sales:cancel
  inventory:create, inventory:read, inventory:update, inventory:delete
  finance:create, finance:read, finance:update, finance:delete
  purchasing:create, purchasing:read, purchasing:update, purchasing:delete
  customers:create, customers:read, customers:update, customers:delete
  suppliers:create, suppliers:read, suppliers:update, suppliers:delete
  products:create, products:read, products:update, products:delete
  reports:read
  users:create, users:read, users:update, users:delete
  admin:dashboard, admin:companies:read, admin:companies:update
```

---

## 7. Audit Logging Rules

### 7.1 When to Log

```
✅ CREATE — log after creation with newValues
✅ UPDATE — log after update with oldValues + newValues
✅ DELETE — log before soft delete with oldValues
✅ Status transition — log with action matching the transition name
✅ POST / CLOSE / COMPLETE / REFUND / CANCEL — log with action name
```

### 7.2 Audit Log Pattern

```typescript
// ✅ CORRECT — inside $transaction
await this.auditLogService.log({
  companyId,
  userId,
  entity: 'Sale',           // Prisma model name
  entityId: sale.id,        // Record UUID
  action: 'COMPLETED',       // UPPER_SNAKE_CASE
  oldValues: { status: 'PENDING' },
  newValues: { status: 'COMPLETED', total: sale.total.toString() },
}, tx);  // Pass transaction client

// ❌ WRONG — outside transaction, missing tx
await this.auditLogService.log({ ... });
```

---

## 8. Decimal Handling Rules

### 8.1 Money Must Be Decimal

```
✅ Database: Prisma Decimal(18, 4) — @db.Decimal(18, 4)
✅ API input: string (class-validator @IsString())
✅ API output: string (mapper converts Decimal → string)
✅ Calculations: new Decimal(value) from @prisma/client/runtime/library
✅ Never use Number() or parseFloat() on money values — they lose precision
```

### 8.2 Shared Utility

```typescript
// common/utils/decimal.util.ts
import { Decimal } from '@prisma/client/runtime/library';

export function toDecimal(value: string | number | Decimal | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function decimalToString(value: Decimal | null | undefined): string | null {
  if (value == null) return null;
  return value.toString();
}
```

---

## 9. Soft Delete Rules

```
✅ Every mutable entity has deletedAt DateTime?
✅ Immutable entities (journal entries, audit logs, stock movements) do NOT have deletedAt
✅ Every repository READ query filters deletedAt: null — except when explicitly requesting deleted records
✅ Soft delete uses updateMany with rowVersion OR update (if no rowVersion) — never delete
✅ Unique constraints account for deleted records (partial unique indexes or unique constraints on active records)
❌ Hard delete is FORBIDDEN on entities with deletedAt
❌ Physical deletion only via scheduled purge (7+ year retention)
```

---

## 10. EventBus Handler Rules

### 10.1 Handler Registration

```typescript
// ✅ CORRECT — register in OnModuleInit
@Injectable()
export class SaleCompletedEventHandler implements EventHandler<SaleCompletedEvent> {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async handle(event: SaleCompletedEvent): Promise<void> {
    // Process the event
    // Transaction context is available via (event as any).context?.transactionClient
  }
}

@Module({ ... })
export class InventoryModule implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly handler: SaleCompletedEventHandler,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('sale.completed', this.handler);
  }
}
```

### 10.2 Handler Rules

```
✅ Handlers must be idempotent — processing the same event twice produces the same result
✅ Handlers must NOT silently swallow exceptions — let them propagate
✅ Handlers use transactionClient from context if available
❌ Handlers must NOT publish events (infinite loop risk)
❌ Handlers must NOT access HTTP context (no request object)
```

---

## 11. Import Rules

```
✅ Imports within the same module use relative paths
✅ Imports from common/ use absolute paths (src/common/...)
✅ Imports from @prisma/client for Prisma types
✅ Imports from @nestjs/common for NestJS decorators
✅ Business modules import EventBus via @Inject(EVENT_BUS)
❌ NO cross-module imports (modules/sales → modules/finance) — use EventBus
❌ NO importing another module's entity, DTO, mapper, or repository
❌ NO importing from dist/ or node_modules/ directly
```

---

## 12. Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| DTO files | kebab-case.prefix | `create-sale.dto.ts` |
| Controller methods | camelCase | `findAll`, `transitionStatus` |
| Service methods | camelCase | `create`, `completeSale` |
| Repository methods | camelCase | `findById`, `updateMany` |
| Events | `{Module}{Action}Event` | `SaleCompletedEvent` |
| Handlers | `{Module}{Action}Handler` | `SaleCompletedInventoryHandler` |
| Tests | `{service}.{test-type}.spec.ts` | `sales.service.unit.spec.ts` |
| Permissions | `<module>:<action>` | `sales:create` |
| Event names | `<module>.<action>` | `sale.completed` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Folders | kebab-case | `chart-of-accounts` |

---

## 13. Testing Requirements

```
✅ Unit tests for ALL service methods
✅ Test valid status transitions
✅ Test invalid status transitions (must throw BadRequestException)
✅ Test optimistic locking conflicts (must throw ConflictException)
✅ Test audit log creation (every mutation)
✅ Test company isolation (tenant A cannot access tenant B's data)
✅ Test Decimal calculations (no precision loss)
✅ Integration tests for multi-table transactions
✅ Test event publishing
✅ Test event handler execution
❌ No tests that depend on external services (mock them)
❌ No tests that modify production data
```

---

## 14. Code Quality Gates

```
✅ TypeScript build: tsc --noEmit → zero errors
✅ NestJS build: npm run build → zero errors
✅ ESLint: npm run lint → zero errors
✅ Unit tests: npm test → 100% pass
✅ No as any in services (enforced by ESLint)
✅ No methods longer than 80 lines
✅ No unused imports
✅ No commented-out code
✅ No console.log (use Logger from @nestjs/common)
✅ Circular dependency check: npx madge → zero cycles
```

---

## 15. Error Handling Rules

```
✅ Use NestJS built-in exceptions:
  - BadRequestException — invalid input, illegal transition
  - NotFoundException — record not found (404)
  - ConflictException — optimistic locking conflict (409)
  - UnauthorizedException — authentication failure (401)
  - ForbiddenException — RBAC permission denied (403)
✅ GlobalExceptionFilter catches all unhandled exceptions
✅ Always return structured error response:
  { statusCode, message, error, timestamp, path }
❌ Never throw generic Error — use specific HTTP exceptions
❌ Never catch exceptions in controllers (let global filter handle them)
❌ Never expose stack traces in production errors
```

---

## 16. Cache Rules

```
✅ Use CacheService for read-heavy, infrequently-changing data
✅ Set TTL appropriate to data freshness requirements
✅ Invalidate cache on related mutations (publish invalidation event)
✅ Cache at the repository level (transparent to services)
❌ Never cache mutable data for long periods (> 1 hour default)
❌ Never cache user-specific data with global keys (include companyId)
```

---

## 17. Soft Delete & Immutability Rules

| Entity Type | Soft Delete | Immutable |
|-------------|-------------|-----------|
| Sales (DRAFT only) | ✅ `deletedAt` | ❌ |
| Sales (COMPLETED) | ❌ | ✅ |
| Products | ✅ `deletedAt` | ❌ |
| Customers | ✅ `deletedAt` | ❌ |
| Suppliers | ✅ `deletedAt` | ❌ |
| Users | ✅ `deletedAt` | ❌ |
| Journal Entries (POSTED) | ❌ | ✅ |
| Audit Logs | ❌ | ✅ |
| Stock Movements | ❌ | ✅ |
| Financial Periods (CLOSED) | ❌ | ✅ |

---

## 18. Module Creation Checklist

When creating a new module, ensure:

```
□ Module follows Controller → Service → Repository → Mapper → Entity pattern
□ All endpoints protected with JwtAuthGuard + RolesGuard + @RequirePermission()
□ Repositories accept tx?: Prisma.TransactionClient
□ Repositories filter companyId in every query
□ Repositories filter deletedAt: null (soft-deletable entities)
□ Repositories use updateMany with rowVersion for mutations
□ Services control $transaction boundaries
□ Services publish events via EventBus
□ Services create audit logs inside transactions
□ Mapper converts Decimal to string
□ DTOs use class-validator + @ApiProperty()
□ All events documented in event-catalog.md
□ Module registered in app.module.ts
□ Module contracts updated in module-contracts.md
□ All tests written and passing
```
