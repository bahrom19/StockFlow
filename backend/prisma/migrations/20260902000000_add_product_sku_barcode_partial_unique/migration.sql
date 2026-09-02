-- CreatePartialUniqueIndex
-- SKU uniqueness within company, excluding soft-deleted products.
-- Multiple NULLs are allowed (PostgreSQL treats NULL ≠ NULL in unique constraints).
CREATE UNIQUE INDEX "product_company_sku_unique"
ON "Product"("companyId", "sku")
WHERE "deletedAt" IS NULL;

-- Barcode uniqueness within company, excluding soft-deleted products.
-- Multiple NULLs are allowed.
CREATE UNIQUE INDEX "product_company_barcode_unique"
ON "Product"("companyId", "barcode")
WHERE "deletedAt" IS NULL;
