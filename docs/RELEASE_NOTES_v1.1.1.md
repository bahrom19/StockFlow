# StockFlow v1.1.1 — Release Notes

**Release tag:** `v1.1.1`
**Commit:** `0b4cb93` — `fix(accounting): journal direction for negative stock adjustments and cash-shift refund netting`
**Released:** 2026-08-05
**Type:** Accounting consistency patch (stability release)

---

## What's New

### 🔴 Critical fix — Journal direction for negative inventory adjustments

Negative stock adjustments (write-offs, count-downs, damage) previously posted an **inverted** journal entry:

```
Before:  Decrease:  Dr Inventory (1300) / Cr Adjustment (5100)   ← same as increase
After:   Decrease:  Dr Adjustment (5100) / Cr Inventory (1300)   ← correct
```

Impact fixed: `GL Inventory == Inventory Valuation` now holds after every negative adjustment. Previously the General Ledger silently inflated Inventory and deflated the adjustment account on each decrease (trial balance stayed balanced, masking the defect).

### 🟡 Medium fix — Refunds net out of the active Cash Shift

Refunding a sale now reverses the exact payment allocation applied at completion:

- `totalSales` − sale total
- `cashSales` − (cash tendered − change)
- `cardSales` − non-cash methods (CARD/QR pooled, mirroring completion)

Only the **OPEN** shift is touched (a closed shift's Z report is final). The write is guarded by **rowVersion optimistic locking** — a stale version throws `ConflictException` and rolls back, so a refund can **never be double-counted**. X/Z reports and `expectedClosing` are now correct after refunds; `Cash Shift == Sales` holds.

> Note: the schema has no `qrSales` column, so QR revenue is pooled into `cardSales` (as at completion). A dedicated `qrSales` column is planned for v1.2.

---

## Validation

| Gate | Result |
|---|---|
| Backend `tsc --noEmit` | ✅ 0 errors |
| `prisma validate` | ✅ |
| Backend `jest` | ✅ **47 suites / 414 tests** (+11 new) |
| ESLint (changed files) | ✅ 0 errors |
| Flutter `analyze` | ✅ 0 errors / 0 warnings |
| Flutter `test` | ✅ **227 passed** |
| Flutter `build web --release` | ✅ |
| Flutter `build apk --release` | ✅ (26.2 MB) |
| Production smoke (Railway) | ✅ **81/81 PASS** |
| Post-release audit (Railway) | ✅ **43/43 PASS** — accounting + performance |

## Production verification highlights

- Negative adjustment journal lines verified at line level on production: `Cr 1300 / Dr 5100`
- Refunds net the shift: `totalSales 5700 → 3900`, `cashSales 5100 → 3900`, no double decrement
- Invariants hold: **GL Inventory == Valuation (26500)**, Trial Balance balanced, every journal balanced, Cash Shift == Sales == Profit == Dashboard (3900), no orphan/negative cost layers

---

## Files changed (5)

- `backend/src/modules/inventory/events/finance-integration.handler.ts` — journal direction fix
- `backend/src/modules/sales/services/sales.service.ts` — refund cash-shift netting
- `backend/src/modules/inventory/events/finance-integration.handler.spec.ts` — new (6 tests)
- `backend/src/modules/sales/services/__tests__/sales-refund-netting.spec.ts` — new (5 tests)
- `docs/audit/v1.1.1-accounting-consistency-report.md` — audit report

---

## Roadmap → v1.2 (starting with)

1. **`qrSales` column** on CashShift (Prisma migration) — split QR revenue from card in completion, refund netting, X/Z reports, mapper, Flutter models
2. **Payment analytics** — per-method revenue dashboard, payment-method mix reports
3. P1 debt: `PARTIALLY_REFUNDED` `refundedAmount` tracking, invoice numbering via PostgreSQL sequence
4. P2: slow-query/index review, container memory budget
