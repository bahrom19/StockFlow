-- G11-E5: Refund Payment Allocation (bucket-level v1).
--
-- Creates:
--   * table "RefundPaymentAllocation" — persisted per-method allocation of a
--     SalesRefund across the original Sale's payment buckets.
--
-- Granularity is bucket-level (PaymentMethod), NOT payment-row-level:
-- paymentId is deliberately absent in v1 (additive migration later if ever
-- needed). Rows are insert-only historical facts: no rowVersion is added and
-- rows are never updated (concurrency is serialized by the Sale rowVersion
-- CAS in the refund transaction). No unique(companyId, salesRefundId, method)
-- constraint — several rows of one method must remain schema-legal.
--
-- FK behavior follows the E1 (G11-E) conventions:
--   Company    → ON DELETE CASCADE (tenant-scoped child, same as SalesRefund)
--   SalesRefund → ON DELETE RESTRICT (refund facts are never cascade-deleted)
--
-- No historical rows are backfilled: historical E4 partial refunds have no
-- allocation facts and Finance retains its interim Cr Cash 1010 fallback for
-- them (no reconstruction of historical accounting).

-- CreateTable
CREATE TABLE "RefundPaymentAllocation" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "salesRefundId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'KZT',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RefundPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefundPaymentAllocation_companyId_idx" ON "RefundPaymentAllocation"("companyId");
CREATE INDEX "RefundPaymentAllocation_salesRefundId_idx" ON "RefundPaymentAllocation"("salesRefundId");
CREATE INDEX "RefundPaymentAllocation_companyId_deletedAt_idx" ON "RefundPaymentAllocation"("companyId", "deletedAt");
CREATE INDEX "RefundPaymentAllocation_salesRefundId_method_idx" ON "RefundPaymentAllocation"("salesRefundId", "method");

-- AddForeignKey
ALTER TABLE "RefundPaymentAllocation" ADD CONSTRAINT "RefundPaymentAllocation_salesRefundId_fkey" FOREIGN KEY ("salesRefundId") REFERENCES "SalesRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundPaymentAllocation" ADD CONSTRAINT "RefundPaymentAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
