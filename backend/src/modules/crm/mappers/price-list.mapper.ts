import { Injectable } from '@nestjs/common';
import { PriceList as PrismaPriceList } from '@prisma/client';
import { PriceListEntity } from '../entities/price-list.entity';

@Injectable()
export class PriceListMapper {
  toEntity(prisma: PrismaPriceList): PriceListEntity {
    return new PriceListEntity({
      id: prisma.id,
      customerId: prisma.customerId,
      name: prisma.name,
      description: prisma.description ?? undefined,
      isActive: prisma.isActive,
      rowVersion: prisma.rowVersion,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deletedAt: prisma.deletedAt ?? undefined,
    });
  }

  toEntityList(prismaList: PrismaPriceList[]): PriceListEntity[] {
    return prismaList.map((p) => this.toEntity(p));
  }
}
