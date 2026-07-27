# StockFlow Enterprise — Final Production Blockers (Phase 6.1)

**Date:** 2026-07-26  
**Status:** All verified blockers resolved  
**Verification source:** `docs/audit/verification-phase6.md`

---

## Blocker 1 — Account Lockout (RESOLVED)

### Forensic Finding
Account lockout was **VERIFIED** as missing. `failedLoginAttempts` and `lockedUntil` fields existed in the Prisma schema but were **never read or written** by AuthService.

### Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/auth/services/auth.service.ts` | **MODIFIED** | Added full account lockout logic to `login()` |
| `src/modules/auth/services/__tests__/auth.service.lockout.spec.ts` | **CREATED** | 6 unit tests covering all lockout scenarios |

### Implementation Details

| Requirement | Implementation |
|-------------|---------------|
| Increment `failedLoginAttempts` | `user.update({ data: { failedLoginAttempts: { increment: 1 } } })` on failed password |
| Lock account after `maxFailedAttempts` | When `failedLoginAttempts + 1 >= maxFailedAttempts`, sets `status: BLOCKED` and `lockedUntil: Date.now() + lockDurationMs` |
| `lockedUntil` timestamp | Stored in DB, checked before password validation |
| Automatic unlock | If `lockedUntil < Date.now()`, account is auto-unlocked on next login attempt (resets counters, sets `status: ACTIVE`) |
| Successful login resets counters | Sets `failedLoginAttempts: 0`, `status: ACTIVE`, `lastLoginAt: new Date()` |
| Audit log | Creates `auditLog` entries with action `ACCOUNT_LOCKED` and `LOGIN_FAILED` |
| Configurable | `auth.maxFailedAttempts` (default: 5), `auth.lockDurationMs` (default: 900000 = 15 min) via `ConfigService` |
| Transaction safety | All operations inside `this.prismaService.$transaction()` |

### Test Coverage (6 tests)

1. ✅ Successful login resets `failedLoginAttempts`
2. ✅ Failed login increments counter
3. ✅ Account locked after `maxFailedAttempts`
4. ✅ Login rejected when account is locked
5. ✅ Auto-unlock after lock duration expires
6. ✅ Locked account rejected even with correct password

---

## Blocker 2 — Optimistic Locking: Customers & Suppliers (RESOLVED)

### Forensic Finding
Missing optimistic locking was **VERIFIED** — `customers.repository.ts` and `suppliers.repository.ts` performed `update()` without `rowVersion` checks, allowing lost updates.

### Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/customers/repositories/customers.repository.ts` | **MODIFIED** | Added `rowVersion` support following SalesRepository pattern |
| `src/modules/suppliers/repositories/suppliers.repository.ts` | **MODIFIED** | Added `rowVersion` support following SalesRepository pattern |
| `src/modules/customers/services/customers.service.ts` | **MODIFIED** | Reads `rowVersion` before passing to repository |
| `src/modules/suppliers/services/suppliers.service.ts` | **MODIFIED** | Reads `rowVersion` before passing to repository |

### Implementation Pattern (copied from SalesRepository)

```
update(id, data, companyId, rowVersion?, tx?):
  return updateMany({
    where: { id, companyId, rowVersion },
    data: { ...data, rowVersion: { increment: 1 } }
  })
  → if count === 0 → ConflictException
```

### Protected Methods

| Repository | Methods with Optimistic Locking |
|------------|--------------------------------|
| `customers.repository.ts` | `update()`, `softDelete()` |
| `suppliers.repository.ts` | `update()`, `softDelete()` |

---

## Blocker 3 — AccountBalance TOCTOU (RESOLVED)

### Forensic Finding
Race condition in `AccountBalance.updateAccountBalances()` was **VERIFIED** — it performed a read-then-write pattern without `rowVersion` protection, enabling lost updates under concurrent GL postings.

### Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/finance/services/gl-engine.service.ts` | **MODIFIED** | Changed `accountBalance.update()` to `accountBalance.updateMany()` with `rowVersion` check |

### Before (race condition)
```typescript
const balance = await tx.accountBalance.findFirst({ where: { ... } });
// ... calculate new values ...
await tx.accountBalance.update({
  where: { id: balance.id },
  data: { periodDebit: newBalance, ... }
});
```

### After (atomic optimistic lock)
```typescript
const balance = await tx.accountBalance.findFirst({ where: { ... } });
// ... calculate new values ...
const result = await tx.accountBalance.updateMany({
  where: { id: balance.id, companyId, rowVersion: balance.rowVersion },
  data: { periodDebit: newBalance, rowVersion: { increment: 1 } }
});
if (result.count === 0) {
  throw new ConflictException('Account balance was modified concurrently');
}
```

---

## Integration Tests (CREATED)

| File | Action | Description |
|------|--------|-------------|
| `src/modules/inventory/__tests__/integration-transaction.spec.ts` | **CREATED** | 5 integration tests covering critical business transaction chains |

### Test Scenarios

| # | Scenario | Status |
|---|----------|--------|
| 1 | Rollback sale transaction when inventory update fails (ConflictException) | ✅ |
| 2 | ConflictException when customer `rowVersion` is stale | ✅ |
| 3 | ConflictException when supplier `rowVersion` is stale | ✅ |
| 4 | ConflictException on concurrent AccountBalance update (TOCTOU fix) | ✅ |
| 5 | Rollback audit log when business transaction rolls back | ✅ |

---

## Build & Validation

| Check | Status |
|-------|--------|
| TypeScript build (`npm run build`) | ✅ 0 errors |
| Prisma generate | ✅ Passed |
| ESLint (new/modified files) | ⚠️ Some pre-existing warnings (not introduced by Phase 6.1) |

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Account Lockout | ❌ Not implemented | ✅ Implemented + tested |
| Optimistic Locking (Customers) | ❌ Missing | ✅ Implemented |
| Optimistic Locking (Suppliers) | ❌ Missing | ✅ Implemented |
| AccountBalance TOCTOU | ❌ Race condition | ✅ Fixed |
| Integration tests | ❌ None | ✅ 5 tests |
| TypeScript errors | 3 new on modified files | ✅ 0 errors |
| Production Readiness | 5.5/10 | **6.5/10** |
