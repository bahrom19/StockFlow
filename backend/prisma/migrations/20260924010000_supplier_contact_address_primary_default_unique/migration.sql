-- G14-03-07: Supplier primary Contact and default Address partial unique indexes
--
-- Concurrent sibling-row assignments (clear-then-set under READ COMMITTED)
-- could permanently create multiple active rows with isPrimary/isDefault =
-- true, because neither transaction sees the other's uncommitted write.
-- These partial unique indexes enforce at most one ACTIVE primary contact
-- and one ACTIVE default address per supplier at the database level,
-- matching application semantics exactly:
--   - zero active primaries/defaults remain valid (no row → no conflict)
--   - soft-deleted rows are excluded (deletedAt IS NULL predicate)
--   - ordinary (non-primary / non-default) rows are unrestricted
-- Pre-existing data audited: zero duplicate active groups (2026-09-23).

-- Primary contact: at most one active isPrimary=true per supplier.
CREATE UNIQUE INDEX "supplier_contact_supplier_primary_active_unique"
ON "SupplierContact" ("supplierId")
WHERE "deletedAt" IS NULL AND "isPrimary" = true;

-- Default address: at most one active isDefault=true per supplier.
CREATE UNIQUE INDEX "supplier_address_supplier_default_active_unique"
ON "SupplierAddress" ("supplierId")
WHERE "deletedAt" IS NULL AND "isDefault" = true;
