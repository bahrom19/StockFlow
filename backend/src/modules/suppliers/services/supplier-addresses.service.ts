import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierAddress } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CreateSupplierAddressDto } from '../dto/create-supplier-address.dto';
import { UpdateSupplierAddressDto } from '../dto/update-supplier-address.dto';
import { SupplierAddressEntity } from '../entities/supplier-address.entity';
import { SupplierAddressesRepository } from '../repositories/supplier-addresses.repository';
import { SuppliersService } from './suppliers.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

// G1 (P3-04): bounded audit diff; no free-form user text is written.
type AddressAuditFields = Pick<
  SupplierAddress,
  'supplierId' | 'city' | 'country' | 'street' | 'postalCode' | 'isDefault' | 'rowVersion'
>;

function addressAuditFields(a: SupplierAddress): AddressAuditFields {
  return {
    supplierId: a.supplierId,
    city: a.city,
    country: a.country,
    street: a.street,
    postalCode: a.postalCode,
    isDefault: a.isDefault,
    rowVersion: a.rowVersion,
  };
}

@Injectable()
export class SupplierAddressesService {
  constructor(
    private readonly addressesRepository: SupplierAddressesRepository,
    private readonly suppliersService: SuppliersService,
    private readonly prismaService: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async audit(
    action: string,
    entityId: string,
    before: AddressAuditFields | null,
    after: AddressAuditFields | null,
    currentUser: JwtPayload,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.auditLogService.log(
      {
        companyId: currentUser.companyId,
        userId: currentUser.userId,
        entityType: 'SupplierAddress',
        entityId,
        action,
        before,
        after,
      },
      tx,
    );
  }

  async create(
    supplierId: string,
    dto: CreateSupplierAddressDto,
    currentUser: JwtPayload,
  ): Promise<SupplierAddressEntity> {
    // Verify supplier exists and belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    const address = await this.prismaService.$transaction(async (tx) => {
      // G2: If isDefault, clear existing default addresses
      if (dto.isDefault) {
        await this.addressesRepository.clearDefault(supplierId, undefined, tx);
      }

      const created = await this.addressesRepository.create(
        {
          supplier: { connect: { id: supplierId } },
          city: dto.city,
          country: dto.country,
          street: dto.street,
          postalCode: dto.postalCode,
          isDefault: dto.isDefault ?? false,
        } as Prisma.SupplierAddressCreateInput,
        tx,
      );
      // G1 (P3-04): audit in the SAME transaction as the business write.
      await this.audit('supplier_address.create', created.id, null, addressAuditFields(created), currentUser, tx);
      if (dto.isDefault) {
        await this.audit('supplier_address.default_change', created.id, null, addressAuditFields(created), currentUser, tx);
      }
      return created;
    });

    return this.toEntity(address);
  }

  async findAll(
    supplierId: string,
    currentUser: JwtPayload,
  ): Promise<SupplierAddressEntity[]> {
    // Verify supplier belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    const addresses = await this.addressesRepository.findAllBySupplier(
      supplierId,
    );
    return addresses.map((a) => this.toEntity(a));
  }

  async findById(
    supplierId: string,
    addressId: string,
    currentUser: JwtPayload,
  ): Promise<SupplierAddressEntity> {
    // Verify supplier belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    const address = await this.addressesRepository.findById(
      addressId,
      supplierId,
    );
    if (!address) {
      throw new NotFoundException(
        `Supplier address with id ${addressId} not found`,
      );
    }
    return this.toEntity(address);
  }

  async update(
    supplierId: string,
    addressId: string,
    dto: UpdateSupplierAddressDto,
    currentUser: JwtPayload,
  ): Promise<SupplierAddressEntity> {
    // Verify supplier belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    const updated = await this.prismaService.$transaction(async (tx) => {
      // Get current address for rowVersion
      const current = await this.addressesRepository.findById(
        addressId,
        supplierId,
        tx,
      );
      if (!current) {
        throw new NotFoundException(
          `Supplier address with id ${addressId} not found`,
        );
      }

      // G2: If isDefault, clear existing default addresses
      if (dto.isDefault) {
        await this.addressesRepository.clearDefault(
          supplierId,
          addressId,
          tx,
        );
      }

      const updated = await this.addressesRepository.update(
        addressId,
        supplierId,
        {
          city: dto.city,
          country: dto.country,
          street: dto.street,
          postalCode: dto.postalCode,
          isDefault: dto.isDefault,
        } as Prisma.SupplierAddressUpdateInput,
        current.rowVersion,
        tx,
      );
      // G1 (P3-04): audit in the SAME transaction as the business write.
      await this.audit('supplier_address.update', updated.id, addressAuditFields(current), addressAuditFields(updated), currentUser, tx);
      if (dto.isDefault) {
        await this.audit('supplier_address.default_change', updated.id, addressAuditFields(current), addressAuditFields(updated), currentUser, tx);
      }
      return updated;
    });

    return this.toEntity(updated);
  }

  async softDelete(
    supplierId: string,
    addressId: string,
    currentUser: JwtPayload,
  ): Promise<void> {
    // Verify supplier belongs to company
    await this.suppliersService.findById(supplierId, currentUser);

    await this.prismaService.$transaction(async (tx) => {
      const current = await this.addressesRepository.findById(
        addressId,
        supplierId,
        tx,
      );
      if (!current) {
        throw new NotFoundException(
          `Supplier address with id ${addressId} not found`,
        );
      }

      await this.addressesRepository.softDelete(
        addressId,
        supplierId,
        current.rowVersion,
        tx,
      );
      // G1 (P3-04): audit in the SAME transaction as the tombstone write.
      await this.audit('supplier_address.delete', addressId, addressAuditFields(current), null, currentUser, tx);
    });
  }

  private toEntity(address: SupplierAddress): SupplierAddressEntity {
    return {
      id: address.id,
      supplierId: address.supplierId,
      city: address.city,
      country: address.country,
      street: address.street,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
      rowVersion: address.rowVersion,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
      deletedAt: address.deletedAt,
    };
  }
}
