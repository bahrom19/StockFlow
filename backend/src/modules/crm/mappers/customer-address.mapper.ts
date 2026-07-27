import { Injectable } from '@nestjs/common';
import { CustomerAddress as PrismaCustomerAddress } from '@prisma/client';
import { CustomerAddressEntity } from '../entities/customer-address.entity';

@Injectable()
export class CustomerAddressMapper {
  toEntity(prisma: PrismaCustomerAddress): CustomerAddressEntity {
    return new CustomerAddressEntity({
      id: prisma.id,
      customerId: prisma.customerId,
      city: prisma.city ?? undefined,
      country: prisma.country ?? undefined,
      street: prisma.street ?? undefined,
      postalCode: prisma.postalCode ?? undefined,
      isDefault: prisma.isDefault,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deletedAt: prisma.deletedAt ?? undefined,
    });
  }

  toEntityList(prismaList: PrismaCustomerAddress[]): CustomerAddressEntity[] {
    return prismaList.map((p) => this.toEntity(p));
  }
}
