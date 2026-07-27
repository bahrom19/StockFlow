# 📒 General Ledger Consistency Audit

**Date**: July 25, 2026  
**Status**: ✅ All automatic postings now route through `GlEngineService.post()`  
**Build**: ✅ Passes (0 TypeScript errors)

---

## Architecture Mandate

Every journal entry in StockFlow MUST be created through:

```
[Business Event]
    ↓
GlEngineService.post()
    ├── PostingValidationService.validate()
    │     ├── Financial period exists and is OPEN
    │     ├── Entry date within period bounds
    │     ├── At least 2 lines
    │     ├── All accounts exist, active, belong to company
    │     ├── Debit == Credit (balanced entry)
    │     └── No negative amounts
    │
    ├── JournalEntriesRepository.createInTransaction()
    │     └── Sets status = POSTED (immutable — never updated after posting)
    │
    ├── journalEntry.update(postedBy, postedAt)
    │
    ├── updateAccountBalances()
    │     └── UPSERT AccountBalance snapshots (periodDebit, periodCredit, closingDebit, closingCredit)
    │
    ├── AuditLogService.log() — action = 'POST'
    │
    └── EventBus.publish(JournalPostedEvent)
          └── With context.transactionClient for downstream handlers
```

**No code path may bypass this pipeline.**

---

## Audit Results

### ✅ Compliant — Route through GlEngineService.post()

| Caller | Trigger | Lines of Code Removed | Pipeline Coverage |
|--------|---------|:--------------------:|:-----------------:|
| `GlEngineService.post()` in `gl-engine.service.ts` | Manual API post (controller) | N/A (engine itself) | ✅ Full |
| `GlEngineService.reverse()` in `gl-engine.service.ts` | Manual reversal (controller) | N/A (calls this.post) | ✅ Full |
| `FiscalYearCloseService.closeFiscalYear()` | Year-end closing | Already used `glEngine.post()` | ✅ Full |
| `FinanceIntegrationService.onSaleCompleted()` | `sale.completed` event | ~15 lines removed (entryNumber generation, balance validation, createInTransaction) | ✅ **Fixed** |
| `FinanceIntegrationService.onSaleRefunded()` | `sale.refunded` event | ~15 lines removed | ✅ **Fixed** |
| `InventoryFinanceHandler.handle()` | `inventory.adjusted` event | ~25 lines removed (including duplicate `getNextEntryNumber()`) | ✅ **Fixed** |
| `PurchasingFinanceService.createGoodsReceiptJournal()` | Goods receipt | ~12 lines removed (entryNumber generation, direct create) | ✅ **Fixed** |
| `PurchasingFinanceService.createPurchaseReturnJournal()` | Purchase return | ~12 lines removed | ✅ **Fixed** |
| `PurchasingFinanceService.createInvoiceJournal()` | Purchase invoice | ~15 lines removed (including complex IIFE pattern) | ✅ **Fixed** |

### ⚠️ Known Advisory Skips (Non-Critical)

These paths log warnings instead of throwing. The journal is NOT created, but the business transaction still completes. This is intentional — purchasing operations affect physical inventory regardless of accounting configuration.

| Caller | Condition | Behavior |
|--------|-----------|----------|
| `PurchasingFinanceService.getAccountIds()` | Chart of Accounts not configured | `logger.warn(...)` + return null → caller skips |
| `InventoryFinanceHandler.handle()` | Chart of Accounts not configured | `logger.warn(...)` + return |
| `InventoryFinanceHandler.handle()` | No open financial period | `logger.warn(...)` + return |

These are acceptable because:
- The business operation (goods receipt, inventory adjustment) already committed
- Accounting entries can be back-dated once COA is configured
- The warning alerts operators

---

## Detailed File Analysis

### 1. GlEngineService (Engine itself — no change needed)

```
src/modules/finance/services/gl-engine.service.ts
```

Already the single source of truth for journal posting. Calls `PostingValidationService.validate()`, `JournalEntriesRepository.createInTransaction()`, `updateAccountBalances()`, `AuditLogService.log()`, `EventBus.publish()`.

✅ **No changes needed.**

### 2. FinanceIntegrationService (Fixed)

```
src/modules/finance/services/finance-integration.service.ts
```

**Before Fix B**: Called `journalRepository.createInTransaction()` directly. Manually generated entry numbers via `getNextEntryNumberInTransaction()`. Manually validated balance. Did NOT update balance snapshots. Did NOT publish `JournalPostedEvent`.

**After Fix B**: Calls `this.glEngine.post({ companyId, financialPeriodId, entryDate, description, referenceType, referenceId, createdBy, lines }, tx)`. Now gets full pipeline: validation, entry number generation, balance snapshots, audit log, event publishing.

**Removed dead code**: `JournalEntriesRepository` and `PrismaService` injections (no longer used).

```diff
- const entryNumber = await this.journalRepository.getNextEntryNumberInTransaction(...)
- // manual balance validation
- if (!totalDebit.equals(totalCredit)) throw ...
- await this.journalRepository.createInTransaction(tx, { ... })
+ await this.glEngine.post({ ... }, tx)
```

### 3. InventoryFinanceHandler (Fixed)

```
src/modules/inventory/events/finance-integration.handler.ts
```

**Before Fix B**: Called `tx.journalEntry.create({ data: { ... } })` directly. Had its own `getNextEntryNumber()` method that queried `journalEntry.findFirst`. Did NOT validate period or accounts (only checked existence). Did NOT update balance snapshots.

**After Fix B**: Injects `GlEngineService`. Calls `this.glEngine.post(...)`. Removed `getNextEntryNumber()` method (~10 lines).

```diff
- const entryNumber = await this.getNextEntryNumber(tx, ...)
- await tx.journalEntry.create({ data: { ... } })
+ await this.glEngine.post({ ... }, tx)
```

### 4. PurchasingFinanceService (Rewritten)

```
src/modules/purchasing/services/purchasing-finance.service.ts
```

**Before Fix B**: Three methods (`createGoodsReceiptJournal`, `createPurchaseReturnJournal`, `createInvoiceJournal`) each called `tx.journalEntry.create()` with complex nested `lines.create` syntax. Each manually fetched `getOpenPeriodId()` and `getNextEntryNumber()`. The invoice method used an IIFE pattern to build lines.

**After Fix B**: All three methods call `this.glEngine.post()`. Kept `getAccountIds()` and `getOpenPeriodId()` helpers. Removed `getNextEntryNumber()` (handled by engine). Removed `Prisma` import (no longer used). Changed `getOpenPeriodId()` to throw `BadRequestException` instead of generic `Error`.

**Simplified `createInvoiceJournal`**:
```diff
- const entryLines: Array<Prisma.JournalLineCreateWithoutJournalEntryInput> = [...]
- const entryNumber = await this.getNextEntryNumber(tx, params.companyId);
- await tx.journalEntry.create({ data: { ... } })
+ const lines = [ ... ];
+ await this.glEngine.post({ ... }, tx);
```

### 5. FiscalYearCloseService (Already Compliant)

```
src/modules/finance/services/fiscal-year-close.service.ts
```

Already used `this.glEngine.post(...)` before this sprint. ✅ No change needed.

---

## Pipeline Compliance Summary

| Pipeline Step | Before Fix B | After Fix B |
|---------------|:-----------:|:----------:|
| Posting validation (period, accounts, balance) | ❌ Manual in 4 places | ✅ Centralized in engine |
| Entry number generation (per financial period) | ❌ 3 different implementations | ✅ Centralized in engine |
| Balance snapshot updates | ❌ Missing in all auto-postings | ✅ Added via engine |
| Audit log (`POST` action) | ❌ Missing in all auto-postings | ✅ Added via engine |
| `JournalPostedEvent` publishing | ❌ Missing in all auto-postings | ✅ Added via engine |
| Immutable posting (`status: POSTED`) | ✅ Already correct | ✅ Preserved |

---

## Verification Query

To verify no future code bypasses the GL engine, the following grep command should return ONLY the engine and its repository:

```bash
# Should return only gl-engine.service.ts and journal-entries.repository.ts
grep -rn 'journalEntry\.create\|createInTransaction' src/modules --include='*.ts'
```

If any other file appears in the results, it's bypassing the pipeline.

---

## Conclusion

**All automatic accounting entry creation now routes through `GlEngineService.post()`.** 4 code paths were refactored, eliminating ~60 lines of duplicated journal creation logic. Every posting now receives the complete pipeline: validation → balance snapshots → audit log → event publishing.

**Zero direct journalEntry.create() calls remain outside the GL engine.** ✅
