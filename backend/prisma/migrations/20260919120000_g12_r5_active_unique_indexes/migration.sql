-- G12-R5: Active-record partial unique indexes for tenant-scoped business keys
-- These indexes only apply to non-deleted records (deletedAt IS NULL)
-- allowing soft-deleted records to coexist with active ones.

-- Customer active partial unique indexes
CREATE UNIQUE INDEX "Customer_companyId_email_active_unique"
ON "Customer" ("companyId", "email")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "Customer_companyId_phone_active_unique"
ON "Customer" ("companyId", "phone")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "Customer_companyId_bin_active_unique"
ON "Customer" ("companyId", "bin")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "Customer_companyId_iin_active_unique"
ON "Customer" ("companyId", "iin")
WHERE "deletedAt" IS NULL;

-- Supplier active partial unique indexes
CREATE UNIQUE INDEX "Supplier_companyId_email_active_unique"
ON "Supplier" ("companyId", "email")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "Supplier_companyId_phone_active_unique"
ON "Supplier" ("companyId", "phone")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "Supplier_companyId_bin_active_unique"
ON "Supplier" ("companyId", "bin")
WHERE "deletedAt" IS NULL;

-- Product active partial unique indexes
CREATE UNIQUE INDEX "Product_companyId_sku_active_unique"
ON "Product" ("companyId", "sku")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "Product_companyId_barcode_active_unique"
ON "Product" ("companyId", "barcode")
WHERE "deletedAt" IS NULL;

-- ProductVariant per-product unique barcode
CREATE UNIQUE INDEX "ProductVariant_productId_barcode_unique"
ON "ProductVariant" ("productId", "barcode");
