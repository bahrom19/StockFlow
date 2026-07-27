# StockFlow Coding Standards

**Version**: 1.0  
**Effective Date**: 2026-07-25  
**Mandatory for**: All StockFlow backend development

---

## 1. Layer Responsibilities

### 1.1 Controller

**Allowed:**
- Receive HTTP request
- Extract `@CurrentUser()` (JwtPayload)
- Parse and validate DTOs
- Call exactly one Service method
- Return the Service result

**Forbidden:**
❌ Access PrismaService or any database client
❌ Contain business logic (if statements, loops, calculations)
❌ Call repositories directly
❌ Use `as any` or type assertions on DTOs
❌ Catch exceptions (let the global filter handle them)
❌ Access request object for anything other than user context

**Template:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission('module:action')
@ApiOperation({ summary: '...' })
@Post()
async create(
  @Body() dto: CreateDto,
  @CurrentUser() user: JwtPayload,
): Promise<EntityType> {
  return this.service.create(dto, user.userId, user.companyId);
}
```

### 1.2 Service

**Allowed:**
- Orchestrate business logic
- Control Prisma transaction boundaries
- Call repositories
- Publish domain events via EventBus
- Create audit logs
- Validate domain rules (status transitions, state machines)
- Call mappers for entity conversion

**Forbidden:**
❌ Access PrismaService directly (use repositories)
❌ Build Prisma query objects (use repositories)
❌ Contain SQL or Prisma raw queries
❌ Be longer than 80 lines per method
❌ Have `as any` casts — use typed Prisma input objects
❌ Access HTTP request/response objects

### 1.3 Repository

**Allowed:**
- Build Prisma `where`, `select`, `include`, `orderBy` objects
- Execute Prisma queries (find, create, update, delete, aggregate, groupBy)
- Build pagination queries
- Build filter/sort/search queries
- Convert DTO query params to Prisma where clauses
- Implement optimistic locking with `updateMany`
- Accept optional `tx?: Prisma.TransactionClient`

**Forbidden:**
❌ Contain business logic (status validation, transition rules)
❌ Publish events
❌ Call other repositories or services
❌ Use Business entities (return raw Prisma types)
❌ Access HTTP context

### 1.4 Mapper

**Allowed:**
- Convert Prisma models → Business entities
- Convert entity lists
- Decimal to string serialization

**Forbidden:**
❌ Contain business logic
❌ Access database
❌ Depend on services or repositories
❌ Mutate input objects

### 1.5 DTO

**Rules:**
- Use `class-validator` decorators for validation
- Use `@ApiProperty()` for Swagger documentation
- Use `@Transform()` for type coercion where needed
- All fields optional for PATCH; required fields validated on POST
- DTO names: `CreateXxxDto`, `UpdateXxxDto`, `XxxQueryDto`

---

## 2. Exception Handling

- **NotFoundException** — record not found (HTTP 404)
- **BadRequestException** — invalid input, illegal status transition, validation failure (HTTP 400)
- **ConflictException** — optimistic locking conflict, duplicate entry (HTTP 409)
- **UnauthorizedException** — authentication failure (HTTP 401)
- **ForbiddenException** — RBAC permission denied (HTTP 403)
- **Global exception filter** catches all unhandled exceptions and returns a consistent `{ statusCode, message, timestamp, path }` response

---

## 3. Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Controllers | `xxx.controller.ts` | `sales.controller.ts` |
| Services | `xxx.service.ts` | `sales.service.ts` |
| Repositories | `xxx.repository.ts` | `sales.repository.ts` |
| Mappers | `xxx.mapper.ts` | `sale.mapper.ts` |
| Entities | `xxx.entity.ts` | `sale.entity.ts` |
| DTOs | `{create,update}-xxx.dto.ts` | `create-sale.dto.ts` |
| Events | `xxx.event.ts` | `sale-completed.event.ts` |
| Handlers | `xxx.handler.ts` | `sale-completed.handler.ts` |
| Interfaces | `xxx.interface.ts` | `sale-event.interface.ts` |
| Folder names | kebab-case | `chart-of-accounts` |
| Class names | PascalCase | `SalesService` |
| Method names | camelCase | `findAll`, `transitionStatus` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_ACCOUNT_CODES` |
| Permissions | `module:action` | `sales:create` |
| Event names | `module.action` | `sale.completed` |
| Files per entity | 1 file per concern | One class, one file |

---

## 4. Module Structure

Every module follows this structure:

```
modules/
  xxx/
    controllers/
      xxx.controller.ts
    services/
      xxx.service.ts
    repositories/
      xxx.repository.ts
    mappers/
      xxx.mapper.ts
    entities/
      xxx.entity.ts
    dto/
      create-xxx.dto.ts
      update-xxx.dto.ts
      xxx-query.dto.ts
    interfaces/
      xxx.interface.ts
    events/                     (if the module publishes events)
      xxx-completed.event.ts
    xxx.module.ts
```

---

## 5. Decimal Handling

- **All money fields**: `Prisma.Decimal` in the database, `string` in API responses
- **Repository layer**: Store and retrieve as `Prisma.Decimal`
- **Mapper layer**: Convert `Decimal` → `string` using `decimal.toString()`
- **Service layer**: Use `new Decimal(value)` for calculations; use `.toString()` when passing to event payloads
- **DTO layer**: Accept strings, convert to Decimal in service
- **Never use `Number()` or `parseFloat()`** on money values — they lose precision
- **Shared utility**: `toDecimal(value)` in `common/utils/decimal.util.ts`

```typescript
// ✅ Correct
const total = new Decimal(item.unitPrice).mul(item.quantity);
return { total: total.toString() };

// ❌ Wrong
const total = parseFloat(item.unitPrice) * item.quantity;
return { total: Number(total) };
```

---

## 6. UUID Usage

- **All primary keys use UUID v4** (`@default(uuid())` in Prisma)
- **Use `crypto.randomUUID()`** for domain event IDs (no external dependencies)
- **Never use auto-increment integers** as primary keys
- **Never expose internal IDs** in URLs or API responses (use UUIDs)

---

## 7. Soft Delete Policy

- **Mutable entities**: `deletedAt DateTime?`
- **Immutable entities**: No `deletedAt` (journal entries, audit logs, stock movements)
- **All repository reads**: Filter `deletedAt: null` by default
- **Unique constraints**: Must exclude deleted records via partial unique indexes
- **Restore**: `deletedAt = null` in a transaction
- **Hard purge**: Only via scheduled job (7-year retention)

---

## 8. Audit Requirements

- **Every mutation** creates an audit log
- **Audit log inside the same transaction** as the business operation
- **Fields**: companyId, userId, entity, entityId, action, oldValues, newValues, timestamp
- **Action naming**: UPPER_SNAKE_CASE (CREATE, UPDATE, DELETE, COMPLETED, REFUNDED, POST, CLOSE)
- **No sensitive data** in oldValues/newValues (passwords, tokens, secrets)

---

## 9. RBAC Requirements

- **Every endpoint**: Protected with `JwtAuthGuard + RolesGuard + @RequirePermission()`
- **Permissions**: `<module>:<action>` format
- **companyId**: From JWT, never from user input
- **Authorization check**: Before any business logic in the service

---

## 10. Transaction Requirements

- **Multi-table writes**: Always use `prisma.$transaction(async (tx) => { ... })`
- **Repository methods**: Always accept `tx?: Prisma.TransactionClient` as last parameter
- **Event publishing**: Always pass `{ context: { transactionClient: tx } }`
- **Audit logging**: Always pass `tx` to `AuditLogService.log()`
- **No nested transactions**: Use the same `tx` throughout
- **Read operations**: No transaction needed unless consistency-sensitive

---

## 11. Event Publishing

- **Publish events via EventBus**, never call handlers directly
- **Pass transaction context** via `{ context: { transactionClient: tx } }`
- **Event class naming**: `<Module><Action>Event`
- **Event name format**: `<module>.<action>` in lowercase
- **Handlers must be idempotent**
- **Handlers catch non-critical errors** internally

---

## 12. Dependency Injection

- **@Inject(EVENT_BUS)** for EventBus (use `EVENT_BUS` token, never the interface directly)
- **Constructor injection** for all services and repositories
- **Repositories inject PrismaService** (or use `tx` from the caller)
- **Services inject repositories and other services**
- **No circular dependencies** (detect at build time)

---

## 13. Testing Requirements

- **Unit tests** for services: mock repositories and event bus
- **Test all status transitions** (valid and invalid)
- **Test all event scenarios** (cash, card, mixed, credit, refund)
- **Test balanced journal entries** (debit == credit for every finance operation)
- **Test optimistic locking** (ConflictException on stale rowVersion)
- **Test audit log creation** (every mutation creates a log entry)
- **Test company isolation** (tenant A cannot access tenant B's data)
- **Test error conditions** (not found, bad request, conflict, authorization)

---

## 14. Code Quality Rules

- **No `as any` in services** — use typed Prisma input objects or explicit type assertions
- **No methods longer than 80 lines** — split into private methods
- **No duplicated logic** — extract to shared utilities or base classes
- **No magic numbers or strings** — use named constants
- **No commented-out code** — delete it
- **No `console.log` in production code** — use Logger from `@nestjs/common`
- **No unused imports** — configure ESLint to enforce

---

## 15. File Organization

- **One class per file** (except for small enums or constants files)
- **Barrel exports** (`index.ts`) for each module's public API
- **Tests co-located** with the code they test in `__tests__/` directories
- **No test files in the production build** (jest.config excludes them)
