import { Injectable } from '@nestjs/common';
import { SalesOpportunity as PrismaOpportunity } from '@prisma/client';
import { SalesOpportunityEntity } from '../entities/sales-opportunity.entity';

@Injectable()
export class OpportunityMapper {
  toEntity(prisma: PrismaOpportunity): SalesOpportunityEntity {
    return new SalesOpportunityEntity({
      id: prisma.id,
      companyId: prisma.companyId,
      customerId: prisma.customerId,
      title: prisma.title,
      description: prisma.description ?? undefined,
      status: prisma.status,
      priority: prisma.priority,
      value: prisma.value.toNumber().toFixed(2),
      probability: prisma.probability,
      expectedCloseDate: prisma.expectedCloseDate ?? undefined,
      assignedTo: prisma.assignedTo ?? undefined,
      notes: prisma.notes ?? undefined,
      rowVersion: prisma.rowVersion,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deletedAt: prisma.deletedAt ?? undefined,
    });
  }

  toEntityList(prismaList: PrismaOpportunity[]): SalesOpportunityEntity[] {
    return prismaList.map((p) => this.toEntity(p));
  }
}
