-- G8: Multi-tenant document numbering hardening.
--
-- Replaces GLOBAL unique constraints on document numbers with tenant-scoped
-- composite unique constraints (companyId + documentNumber).
--
-- Rationale (G7 audit finding F1 / G8 audit):
--   DocumentSequenceService numbers documents per (companyId, type), but the
--   DB constraints were global @unique(field). A per-company sequence combined
--   with a global unique index makes deterministic cross-tenant collisions
--   possible (e.g. the first supplier payment in two companies is both
--   "PAY-000001" — the second insert fails with P2002 → HTTP 409 and the
--   tenant is blocked from recording payments until another tenant advances
--   its sequence).
--
-- Safety:
--   * The composite unique constraint is strictly WEAKER than the previous
--     global unique constraint, so existing data (which already satisfies the
--     global constraint) can never violate the new constraint.
--   * No rows, document numbers or sequence counters are modified.
--   * Historical number immutability is preserved: the composite constraint
--     is deliberately NOT partial (no "WHERE deletedAt IS NULL") — financial
--     document numbers must remain unique across soft-deleted records.
--   * Number formats are unchanged.

-- ── SupplierPayment ──────────────────────────────────────────────
DROP INDEX "SupplierPayment_paymentNumber_key";
CREATE UNIQUE INDEX "SupplierPayment_companyId_paymentNumber_key" ON "SupplierPayment"("companyId", "paymentNumber");

-- ── PurchaseInvoice ──────────────────────────────────────────────
DROP INDEX "PurchaseInvoice_invoiceNumber_key";
CREATE UNIQUE INDEX "PurchaseInvoice_companyId_invoiceNumber_key" ON "PurchaseInvoice"("companyId", "invoiceNumber");

-- ── PurchaseReturn ───────────────────────────────────────────────
DROP INDEX "PurchaseReturn_returnNumber_key";
CREATE UNIQUE INDEX "PurchaseReturn_companyId_returnNumber_key" ON "PurchaseReturn"("companyId", "returnNumber");

-- ── RFQ ──────────────────────────────────────────────────────────
DROP INDEX "RFQ_rfqNumber_key";
CREATE UNIQUE INDEX "RFQ_companyId_rfqNumber_key" ON "RFQ"("companyId", "rfqNumber");

-- ── SupplierQuotation ────────────────────────────────────────────
DROP INDEX "SupplierQuotation_quotationNumber_key";
CREATE UNIQUE INDEX "SupplierQuotation_companyId_quotationNumber_key" ON "SupplierQuotation"("companyId", "quotationNumber");

-- ── PurchaseOrder ────────────────────────────────────────────────
DROP INDEX "PurchaseOrder_orderNumber_key";
CREATE UNIQUE INDEX "PurchaseOrder_companyId_orderNumber_key" ON "PurchaseOrder"("companyId", "orderNumber");

-- ── GoodsReceipt ─────────────────────────────────────────────────
DROP INDEX "GoodsReceipt_receiptNumber_key";
CREATE UNIQUE INDEX "GoodsReceipt_companyId_receiptNumber_key" ON "GoodsReceipt"("companyId", "receiptNumber");

-- ── PurchaseCreditNote ───────────────────────────────────────────
-- Removes the duplicated GLOBAL unique index. The tenant-scoped composite
-- unique index "PurchaseCreditNote_companyId_creditNoteNumber_key" already
-- exists (created in migration 20260729014253_add_billing_tables) and is kept.
DROP INDEX "PurchaseCreditNote_creditNoteNumber_key";
