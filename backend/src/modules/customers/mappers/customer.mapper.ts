import { Customer } from '@prisma/client';
import { CustomerEntity } from '../entities/customer.entity';

export class CustomerMapper {
  static toEntity(customer: Customer): CustomerEntity {
    return {
      id: customer.id,
      companyId: customer.companyId,
      groupId: customer.groupId,
      type: customer.type,
      firstName: customer.firstName,
      lastName: customer.lastName,
      companyName: customer.companyName,
      iin: customer.iin,
      bin: customer.bin,
      email: customer.email,
      phone: customer.phone,
      mobile: customer.mobile,
      discount: customer.discount?.toString() ?? null,
      creditLimit: customer.creditLimit?.toString() ?? null,
      currentDebt: customer.currentDebt?.toString() ?? null,
      bonusPoints: customer.bonusPoints,
      notes: customer.notes,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      deletedAt: customer.deletedAt,
    };
  }
}
