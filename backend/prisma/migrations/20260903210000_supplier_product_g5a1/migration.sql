-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "supplierSku" VARCHAR(100),
    "purchasePrice" DECIMAL(18,4),
    "currency" "Currency" NOT NULL DEFAULT 'KZT',
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lastPurchaseAt" TIMESTAMP(3),
    "rowVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_product_company_supplier_product_unique"
ON "SupplierProduct"("companyId", "supplierId", "productId")
WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "SupplierProduct_companyId_idx" ON "SupplierProduct"("companyId");

-- CreateIndex
CREATE INDEX "SupplierProduct_supplierId_idx" ON "SupplierProduct"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierProduct_productId_idx" ON "SupplierProduct"("productId");

-- CreateIndex
CREATE INDEX "SupplierProduct_companyId_supplierId_idx" ON "SupplierProduct"("companyId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierProduct_companyId_productId_idx" ON "SupplierProduct"("companyId", "productId");

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
