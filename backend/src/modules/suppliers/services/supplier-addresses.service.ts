import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierAddress } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { CreateSupplierAddressDto } from '../dto/create-supplier-address.dto';
import { UpdateSupplierAddressDto } from '../dto/update-supplier-address.dto';
import { SupplierAddressEntity } from '../entities/supplier-address.entity';
import { SupplierAddressesRepository } from '../repositories/supplier-addresses.repository';
import { SuppliersService } from './suppliers.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class SupplierAddressesService {
  constructor(
    private readonly addressesRepository: SupplierAddressesRepository,
    private readonly suppliersService: SuppliersService,
    private readonly prismaService: PrismaService,
  ) {}

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

      return this.addressesRepository.create(
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
      // G2: If isDefault, clear existing default addresses
      if (dto.isDefault) {
        await this.addressesRepository.clearDefault(
          supplierId,
          addressId,
          tx,
        );
      }

      return this.addressesRepository.update(
        addressId,
        supplierId,
        {
          city: dto.city,
          country: dto.country,
          street: dto.street,
          postalCode: dto.postalCode,
          isDefault: dto.isDefault,
        } as Prisma.SupplierAddressUpdateInput,
        tx,
      );
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

    await this.addressesRepository.softDelete(addressId, supplierId);
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
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
      deletedAt: address.deletedAt,
    };
  }
}
