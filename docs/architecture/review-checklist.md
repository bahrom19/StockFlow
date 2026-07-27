# StockFlow Architecture Review Checklist

**Version**: 1.0  
**Date**: 2026-07-25  

This checklist MUST be completed before every Pull Request is merged. Each item must be checked and signed off by the reviewer.

---

## Module Structure

- [ ] Module follows `Controller → Service → Repository → Mapper → DTO → Entity` pattern
- [ ] No new files outside the module directory (controllers in `controllers/`, services in `services/`, etc.)
- [ ] Barrel export (`index.ts`) exists where multiple files are exported
- [ ] No unused imports (ESLint must pass)

---

## Controller

- [ ] `@UseGuards(JwtAuthGuard, RolesGuard)` present
- [ ] `@RequirePermission('<module>:<action>')` present on every endpoint
- [ ] `@CurrentUser()` used for user context (not `@Req()` or request object)
- [ ] `companyId` from JWT, never from DTO or URL params
- [ ] No business logic — only calls one service method
- [ ] No access to PrismaService or database
- [ ] No `as any` casts
- [ ] Swagger decorators present (`@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`)
- [ ] DTO validation via `class-validator` decorators
- [ ] Pagination DTO: `page`, `limit`, `sortBy`, `sortOrder`
- [ ] Consistent HTTP status codes: POST → 201, GET → 200, DELETE → 204

---

## Service

- [ ] No direct PrismaService usage — all DB access through repositories
- [ ] Business transaction wrapped in `prisma.$transaction(async (tx) => { ... })` for multi-table writes
- [ ] `tx` passed to every repository mutation
- [ ] `tx` passed to `AuditLogService.log()`
- [ ] `tx` passed to `EventBus.publish()` via `{ context: { transactionClient: tx } }`
- [ ] No `as any` — all type assertions use specific types
- [ ] No method longer than 80 lines — split into private methods
- [ ] Status transitions validated with meaningful error messages
- [ ] Money calculations use `Decimal` (never `Number` or `parseFloat`)
- [ ] Mapper used for entity conversion (no manual conversion in services)
- [ ] `NotFoundException` for missing records
- [ ] `BadRequestException` for invalid state transitions
- [ ] `ConflictException` for optimistic locking conflicts

---

## Repository

- [ ] `companyId` in every WHERE clause
- [ ] `deletedAt: null` in every SELECT query (for soft-deletable entities)
- [ ] `updateMany` with `rowVersion` in WHERE for all updates (not `findFirst` + check + `update`)
- [ ] `rowVersion: { increment: 1 }` in every update data
- [ ] `ConflictException` when `updateMany` returns count === 0
- [ ] Diagnostic `findFirst` only AFTER `updateMany` returns 0 (to distinguish not-found vs conflict)
- [ ] All mutation methods accept `tx?: Prisma.TransactionClient` as last parameter
- [ ] `private prisma(tx?)` helper used to select client
- [ ] No business logic (status checks, transition validation)
- [ ] No event publishing
- [ ] Pagination: `skip` + `take`, with total count query
- [ ] Filtering/searching uses correct Prisma `contains`, `mode: 'insensitive'` for text search
- [ ] Sorting uses a whitelist of allowed columns (no dynamic sort injection)

---

## Mapper

- [ ] Converts Prisma model fields to Entity fields
- [ ] Decimal fields converted to strings (`.toString()`)
- [ ] `rowVersion` included in entity
- [ ] Entity list method exists (`toEntityList`)
- [ ] No business logic
- [ ] No database access
- [ ] No side effects

---

## DTO

- [ ] `@ApiProperty()` decorators on all fields
- [ ] `class-validator` decorators on all fields
- [ ] Validation groups for CREATE vs UPDATE where appropriate
- [ ] Optional fields for PATCH / UPDATE
- [ ] Required fields for POST
- [ ] Pagination query DTO has defaults: `page = 1`, `limit = 20`
- [ ] Money fields as `string` type (not `number`)
- [ ] UUID fields as `string` type

---

## Audit Logging

- [ ] Every mutation creates an audit log entry
- [ ] Audit log inside the same transaction as the business operation
- [ ] `action` uses UPPER_SNAKE_CASE (CREATE, UPDATE, DELETE, POST, CLOSE, COMPLETED)
- [ ] `entity` matches the Prisma model name
- [ ] No sensitive data in `oldValues` / `newValues`
- [ ] `tx` passed to `AuditLogService.log()`

---

## Event Publishing

- [ ] Events published via `EventBus.publish()`, not direct handler calls
- [ ] Transaction context passed: `{ context: { transactionClient: tx } }`
- [ ] Event class extends `DomainEvent` interface
- [ ] Event name follows `<module>.<action>` convention
- [ ] Event ID generated with `crypto.randomUUID()`
- [ ] Payload carries snapshot values (strings), not references

---

## Event Handlers

- [ ] Handler registered in `OnModuleInit` via `EventBus.subscribe()`
- [ ] Handler extracts `tx` from `context?.transactionClient`
- [ ] Handler is idempotent (repeated delivery produces same result)
- [ ] Non-critical errors caught internally (handler never throws for non-critical failures)
- [ ] Handler does NOT publish events (avoids infinite loops)

---

## RBAC

- [ ] `JwtAuthGuard` present on ALL endpoints
- [ ] `RolesGuard` present on ALL endpoints (where permissions are required)
- [ ] `@RequirePermission()` matches the module and action
- [ ] Permission follows `<module>:<action>` format
- [ ] Custom permissions registered in database seed

---

## Multi-Tenancy

- [ ] `companyId` in every repository WHERE clause
- [ ] `companyId` from JWT, never from user input
- [ ] Composite indexes include `companyId` as the first column
- [ ] No cross-company data leaks possible

---

## Transactions

- [ ] Multi-table writes use `prisma.$transaction(async (tx) => { ... })`
- [ ] All repository mutations pass `tx` when inside a transaction
- [ ] Event publishing includes `context.transactionClient`
- [ ] Audit logging includes `tx`
- [ ] No nested transactions
- [ ] No long-running operations inside transactions

---

## Money

- [ ] All money fields use `Prisma.Decimal` in database
- [ ] All money fields use `string` type in API responses and DTOs
- [ ] No `Number()` or `parseFloat()` on money values
- [ ] Calculations use `Decimal` class methods (`.mul()`, `.add()`, `.sub()`, `.div()`)
- [ ] `.toString()` for serialization (not `.toFixed()`, not `.toNumber()`)

---

## Soft Delete

- [ ] `deletedAt DateTime?` on immutable entities
- [ ] `deletedAt: null` in all SELECT queries
- [ ] Soft delete via `updateMany` with `rowVersion` check
- [ ] Unique constraints include partial index excluding deleted records

---

## Testing

- [ ] Unit tests for service methods covering:
  - [ ] Happy path (successful creation, update, delete)
  - [ ] Error path (not found, conflict, bad request)
  - [ ] Status transitions (valid and invalid)
  - [ ] Event publishing (event was called with correct payload)
  - [ ] Transaction propagation (tx passed to dependencies)
  - [ ] Money precision (Decimal calculations correct)
- [ ] Tests use mocked repositories and event bus
- [ ] Tests do NOT require a database connection
- [ ] Test file follows naming: `*.spec.ts`

---

## Code Quality

- [ ] No `as any` in services
- [ ] No method longer than 80 lines
- [ ] No duplicated code (extract to shared utility or base class)
- [ ] No magic numbers or strings (use named constants)
- [ ] No commented-out code
- [ ] No `console.log` (use `Logger`)
- [ ] No unused imports
- [ ] ESLint passes
- [ ] Build passes (`npm run build`)

---

## Sign Off

| Role | Name | Date |
|---|---|---|
| **Author** | | |
| **Reviewer** | | |
| **Architect** | | |

---

## Quick Reference: Common Violations

| Violation | How to Fix |
|---|---|
| `companyId` from DTO | Move to `@CurrentUser().companyId` |
| `as any` for Prisma types | Create explicit `Prisma.XxxUpdateInput` object |
| `as any` for enums | Use typed assertion: `dto.status as SaleStatus` |
| Missing `tx` parameter | Add `tx?: Prisma.TransactionClient` to method |
| Repository calling another repository | Move coordination to Service layer |
| Service calling Prisma directly | Move query to Repository |
| Mapper doing conversions in Service | Create `xxx.mapper.ts` and call `XxxMapper.toEntity()` |
| Method > 80 lines | Extract private helper methods |
