import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierContact } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { CreateSupplierContactDto } from '../dto/create-supplier-contact.dto';
import { UpdateSupplierContactDto } from '../dto/update-supplier-contact.dto';
import { SupplierContactEntity } from '../entities/supplier-contact.entity';
import { SupplierContactsRepository } from '../repositories/supplier-contacts.repository';
import { SuppliersService } from './suppliers.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class SupplierContactsService {
  constructor(
    private readonly contactsRepository: SupplierContactsRepository,
    private readonly suppliersService: SuppliersService,
    private readonly prismaService: PrismaService,
  ) {}

  async create(
    supplierId: string,
    dto: CreateSupplierContactDto,
    currentUser: JwtPayload,
  ): Promise<SupplierContactEntity> {
    // Verify supplier exists and belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    const contact = await this.prismaService.$transaction(async (tx) => {
      // G2: If isPrimary, clear existing primary contacts
      if (dto.isPrimary) {
        await this.contactsRepository.clearPrimary(supplierId, undefined, tx);
      }

      return this.contactsRepository.create(
        {
          supplier: { connect: { id: supplierId } },
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          position: dto.position,
          isPrimary: dto.isPrimary ?? false,
          notes: dto.notes,
        } as Prisma.SupplierContactCreateInput,
        tx,
      );
    });

    return this.toEntity(contact);
  }

  async findAll(
    supplierId: string,
    currentUser: JwtPayload,
  ): Promise<SupplierContactEntity[]> {
    // Verify supplier belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    const contacts = await this.contactsRepository.findAllBySupplier(
      supplierId,
    );
    return contacts.map((c) => this.toEntity(c));
  }

  async findById(
    supplierId: string,
    contactId: string,
    currentUser: JwtPayload,
  ): Promise<SupplierContactEntity> {
    // Verify supplier belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    const contact = await this.contactsRepository.findById(
      contactId,
      supplierId,
    );
    if (!contact) {
      throw new NotFoundException(
        `Supplier contact with id ${contactId} not found`,
      );
    }
    return this.toEntity(contact);
  }

  async update(
    supplierId: string,
    contactId: string,
    dto: UpdateSupplierContactDto,
    currentUser: JwtPayload,
  ): Promise<SupplierContactEntity> {
    // Verify supplier belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    const updated = await this.prismaService.$transaction(async (tx) => {
      // Get current contact for rowVersion
      const current = await this.contactsRepository.findById(
        contactId,
        supplierId,
        tx,
      );
      if (!current) {
        throw new NotFoundException(
          `Supplier contact with id ${contactId} not found`,
        );
      }

      // G2: If isPrimary, clear existing primary contacts
      if (dto.isPrimary) {
        await this.contactsRepository.clearPrimary(
          supplierId,
          contactId,
          tx,
        );
      }

      return this.contactsRepository.update(
        contactId,
        supplierId,
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          position: dto.position,
          isPrimary: dto.isPrimary,
          notes: dto.notes,
        } as Prisma.SupplierContactUpdateInput,
        current.rowVersion,
        tx,
      );
    });

    return this.toEntity(updated);
  }

  async softDelete(
    supplierId: string,
    contactId: string,
    currentUser: JwtPayload,
  ): Promise<void> {
    // Verify supplier belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    await this.prismaService.$transaction(async (tx) => {
      const current = await this.contactsRepository.findById(
        contactId,
        supplierId,
        tx,
      );
      if (!current) {
        throw new NotFoundException(
          `Supplier contact with id ${contactId} not found`,
        );
      }

      await this.contactsRepository.softDelete(
        contactId,
        supplierId,
        current.rowVersion,
        tx,
      );
    });
  }

  private toEntity(contact: SupplierContact): SupplierContactEntity {
    return {
      id: contact.id,
      supplierId: contact.supplierId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email,
      position: contact.position,
      isPrimary: contact.isPrimary,
      notes: contact.notes,
      rowVersion: contact.rowVersion,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      deletedAt: contact.deletedAt,
    };
  }
}
