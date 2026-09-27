import { Supplier } from '@prisma/client';
import { SupplierEntity } from '../entities/supplier.entity';

export class SupplierMapper {
  static toEntity(supplier: Supplier): SupplierEntity {
    return {
      id: supplier.id,
      companyId: supplier.companyId,
      companyName: supplier.companyName,
      bin: supplier.bin,
      email: supplier.email,
      phone: supplier.phone,
      website: supplier.website,
      notes: supplier.notes,
      isActive: supplier.isActive,
      // G1 (P3-03): exposed for API-client CAS updates.
      rowVersion: supplier.rowVersion,
      defaultDueDays: supplier.defaultDueDays,
      creditLimit: supplier.creditLimit?.toString() ?? null,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      deletedAt: supplier.deletedAt,
    };
  }
}
