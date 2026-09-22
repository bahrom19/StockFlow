CREATE UNIQUE INDEX "SupplierProduct_companyId_supplierId_productId_key"
ON "SupplierProduct" ("companyId", "supplierId", "productId")
WHERE "deletedAt" IS NULL;
