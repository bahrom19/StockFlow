import { Injectable } from '@nestjs/common';
import { CustomerContact as PrismaContact } from '@prisma/client';
import { ContactEntity } from '../entities/contact.entity';

@Injectable()
export class ContactMapper {
  toEntity(prisma: PrismaContact): ContactEntity {
    return new ContactEntity({
      id: prisma.id,
      customerId: prisma.customerId,
      firstName: prisma.firstName ?? undefined,
      lastName: prisma.lastName ?? undefined,
      email: prisma.email ?? undefined,
      phone: prisma.phone ?? undefined,
      position: prisma.position ?? undefined,
      isPrimary: prisma.isPrimary,
      notes: prisma.notes ?? undefined,
      rowVersion: prisma.rowVersion,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deletedAt: prisma.deletedAt ?? undefined,
    });
  }

  toEntityList(prismaList: PrismaContact[]): ContactEntity[] {
    return prismaList.map((p) => this.toEntity(p));
  }
}
