import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { SupplierQueryDto } from '../dto/supplier-query.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { SupplierEntity } from '../entities/supplier.entity';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly suppliersRepository: SuppliersRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async create(
    createSupplierDto: CreateSupplierDto,
    currentUser: JwtPayload,
  ): Promise<SupplierEntity> {
    // Tenant is always derived from the JWT. An optional body companyId
    // is accepted for backward compatibility but must match the JWT.
    if (
      createSupplierDto.companyId &&
      createSupplierDto.companyId !== currentUser.companyId
    ) {
      throw new BadRequestException(
        'companyId does not match the authenticated company',
      );
    }

    // G1: field-level duplicate checks (replaces broad search)
    if (createSupplierDto.email) {
      const dup = await this.suppliersRepository.findActiveByEmail(
        createSupplierDto.email,
        currentUser.companyId,
      );
      if (dup) {
        throw new ConflictException(
          'A supplier with this email already exists',
        );
      }
    }
    if (createSupplierDto.phone) {
      const dup = await this.suppliersRepository.findActiveByPhone(
        createSupplierDto.phone,
        currentUser.companyId,
      );
      if (dup) {
        throw new ConflictException(
          'A supplier with this phone already exists',
        );
      }
    }
    if (createSupplierDto.bin) {
      const dup = await this.suppliersRepository.findActiveByBin(
        createSupplierDto.bin,
        currentUser.companyId,
      );
      if (dup) {
        throw new ConflictException(
          'A supplier with this BIN already exists',
        );
      }
    }

    const supplier = await this.prismaService.$transaction(async (tx) => {
      return this.suppliersRepository.create(
        {
          company: { connect: { id: currentUser.companyId } },
          companyName: createSupplierDto.companyName,
          bin: createSupplierDto.bin,
          email: createSupplierDto.email,
          phone: createSupplierDto.phone,
          website: createSupplierDto.website,
          notes: createSupplierDto.notes,
          isActive: createSupplierDto.isActive ?? true,
        } as Prisma.SupplierCreateInput,
        tx,
      );
    });

    return this.toEntity(supplier);
  }

  async findAll(
    query: SupplierQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: SupplierEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    }

    const result = await this.suppliersRepository.findAll({
      companyId: currentUser.companyId,
      search: query.search,
      isActive: query.isActive,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: result.items.map((supplier) => this.toEntity(supplier)),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, currentUser: JwtPayload): Promise<SupplierEntity> {
    const supplier = await this.suppliersRepository.findById(
      id,
      currentUser.companyId,
    );

    if (!supplier) {
      throw new NotFoundException(`Supplier with id ${id} not found`);
    }

    return this.toEntity(supplier);
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
    currentUser: JwtPayload,
  ): Promise<SupplierEntity> {
    const current = await this.findById(id, currentUser);

    // G1: field-level duplicate checks on update (exclude self)
    if (updateSupplierDto.email && updateSupplierDto.email !== current.email) {
      const dup = await this.suppliersRepository.findActiveByEmail(
        updateSupplierDto.email,
        currentUser.companyId,
        id,
      );
      if (dup) {
        throw new ConflictException(
          'A supplier with this email already exists',
        );
      }
    }
    if (updateSupplierDto.phone && updateSupplierDto.phone !== current.phone) {
      const dup = await this.suppliersRepository.findActiveByPhone(
        updateSupplierDto.phone,
        currentUser.companyId,
        id,
      );
      if (dup) {
        throw new ConflictException(
          'A supplier with this phone already exists',
        );
      }
    }
    if (updateSupplierDto.bin && updateSupplierDto.bin !== current.bin) {
      const dup = await this.suppliersRepository.findActiveByBin(
        updateSupplierDto.bin,
        currentUser.companyId,
        id,
      );
      if (dup) {
        throw new ConflictException(
          'A supplier with this BIN already exists',
        );
      }
    }

    const updatedSupplier = await this.prismaService.$transaction(
      async (tx) => {
        const existing = await this.suppliersRepository.findById(
          id,
          currentUser.companyId,
          tx,
        );
        const rowVer = existing?.rowVersion ?? 0;
        return this.suppliersRepository.update(
          id,
          {
            companyName: updateSupplierDto.companyName,
            bin: updateSupplierDto.bin,
            email: updateSupplierDto.email,
            phone: updateSupplierDto.phone,
            website: updateSupplierDto.website,
            notes: updateSupplierDto.notes,
            isActive: updateSupplierDto.isActive,
          } as Prisma.SupplierUpdateInput,
          currentUser.companyId,
          rowVer,
          tx,
        );
      },
    );

    return this.toEntity(updatedSupplier);
  }

  async softDelete(
    id: string,
    currentUser: JwtPayload,
  ): Promise<SupplierEntity> {
    await this.findById(id, currentUser);
    const deletedSupplier = await this.prismaService.$transaction(
      async (tx) => {
        const existing = await this.suppliersRepository.findById(
          id,
          currentUser.companyId,
          tx,
        );
        const rowVer = existing?.rowVersion ?? 0;
        return this.suppliersRepository.softDelete(
          id,
          currentUser.companyId,
          rowVer,
          tx,
        );
      },
    );

    return this.toEntity(deletedSupplier);
  }

  private toEntity(supplier: Supplier): SupplierEntity {
    return {
      id: supplier.id,
      companyId: supplier.companyId,
      companyName: supplier.companyName,
      bin: supplier.bin,
      email: supplier.email,
      phone: supplier.phone,
      website: supplier.website,
      notes: supplier.notes,
      isActive: supplier.isActive,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      deletedAt: supplier.deletedAt,
    };
  }
}
