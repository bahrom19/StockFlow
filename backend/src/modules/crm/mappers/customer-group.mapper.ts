import { Injectable } from '@nestjs/common';
import { CustomerGroup as PrismaCustomerGroup } from '@prisma/client';
import { CustomerGroupEntity } from '../entities/customer-group.entity';

@Injectable()
export class CustomerGroupMapper {
  toEntity(prisma: PrismaCustomerGroup): CustomerGroupEntity {
    return new CustomerGroupEntity({
      id: prisma.id,
      companyId: prisma.companyId,
      name: prisma.name,
      discountPercent: prisma.discountPercent?.toString() ?? undefined,
      description: prisma.description ?? undefined,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deletedAt: prisma.deletedAt ?? undefined,
    });
  }

  toEntityList(prismaList: PrismaCustomerGroup[]): CustomerGroupEntity[] {
    return prismaList.map((p) => this.toEntity(p));
  }
}
