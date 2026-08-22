-- AddProductNtin — adds an optional NTIN (National Trade Item Number) to Product.
-- Non-destructive: nullable column, no changes to existing sku/barcode data.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "ntin" VARCHAR(100);

-- CreateIndex
CREATE INDEX "Product_ntin_idx" ON "Product"("ntin");
