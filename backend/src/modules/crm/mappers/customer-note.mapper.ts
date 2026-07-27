import { Injectable } from '@nestjs/common';
import { CustomerNote as PrismaCustomerNote } from '@prisma/client';
import { CustomerNoteEntity } from '../entities/customer-note.entity';

@Injectable()
export class CustomerNoteMapper {
  toEntity(prisma: PrismaCustomerNote): CustomerNoteEntity {
    return new CustomerNoteEntity({
      id: prisma.id,
      customerId: prisma.customerId,
      title: prisma.title ?? undefined,
      content: prisma.content ?? undefined,
      createdBy: prisma.createdBy ?? undefined,
      rowVersion: prisma.rowVersion,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deletedAt: prisma.deletedAt ?? undefined,
    });
  }

  toEntityList(prismaList: PrismaCustomerNote[]): CustomerNoteEntity[] {
    return prismaList.map((p) => this.toEntity(p));
  }
}
