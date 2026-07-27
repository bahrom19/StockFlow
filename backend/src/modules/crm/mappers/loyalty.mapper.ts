import { Injectable } from '@nestjs/common';
import { LoyaltyAccount as PrismaLoyaltyAccount } from '@prisma/client';
import { LoyaltyAccountEntity } from '../entities/loyalty-account.entity';

@Injectable()
export class LoyaltyMapper {
  toEntity(prisma: PrismaLoyaltyAccount): LoyaltyAccountEntity {
    return new LoyaltyAccountEntity({
      id: prisma.id,
      customerId: prisma.customerId,
      points: prisma.points,
      lifetimePoints: prisma.lifetimePoints,
      tier: prisma.tier,
      enrolledAt: prisma.enrolledAt,
      lastActivity: prisma.lastActivity ?? undefined,
      rowVersion: prisma.rowVersion,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  toEntityList(prismaList: PrismaLoyaltyAccount[]): LoyaltyAccountEntity[] {
    return prismaList.map((p) => this.toEntity(p));
  }
}
