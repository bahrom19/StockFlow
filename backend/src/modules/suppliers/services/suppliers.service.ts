import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { SupplierQueryDto } from '../dto/supplier-query.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { SupplierEntity } from '../entities/supplier.entity';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

// G1 (P3-04): audit payloads carry a bounded field-level diff only.
// notes is free-form user text that may contain personal data — it is
// never written to the audit trail (REDACTED marker is reserved for
// future fields that must remain visible-but-masked).
type SupplierAuditFields = Pick<
  Supplier,
  | 'companyName'
  | 'bin'
  | 'email'
  | 'phone'
  | 'website'
  | 'isActive'
  | 'defaultDueDays'
  | 'creditLimit'
  | 'rowVersion'
>;

function supplierAuditFields(supplier: Supplier): SupplierAuditFields {
  return {
    companyName: supplier.companyName,
    bin: supplier.bin,
    email: supplier.email,
    phone: supplier.phone,
    website: supplier.website,
    isActive: supplier.isActive,
    defaultDueDays: supplier.defaultDueDays,
    creditLimit: supplier.creditLimit,
    rowVersion: supplier.rowVersion,
  };
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly suppliersRepository: SuppliersRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLogService: AuditLogService,
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
      const created = await this.suppliersRepository.create(
        {
          company: { connect: { id: currentUser.companyId } },
          companyName: createSupplierDto.companyName,
          bin: createSupplierDto.bin,
          email: createSupplierDto.email,
          phone: createSupplierDto.phone,
          website: createSupplierDto.website,
          notes: createSupplierDto.notes,
          isActive: createSupplierDto.isActive ?? true,
          // G9-C: supplier terms & credit foundation (data-only).
          defaultDueDays: createSupplierDto.defaultDueDays,
          creditLimit: createSupplierDto.creditLimit as
            | Prisma.Decimal
            | string
            | number
            | undefined,
        } as Prisma.SupplierCreateInput,
        tx,
      );
      // G1 (P3-04): audit in the SAME transaction — a rollback of the
      // business write rolls the audit entry back with it.
      await this.auditLogService.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'Supplier',
          entityId: created.id,
          action: 'supplier.create',
          before: null,
          after: supplierAuditFields(created),
        },
        tx,
      );
      return created;
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
    // G1 (P3-03): rowVersion is REQUIRED for updates. The repository CAS
    // below rejects a stale token with 409 — silent last-write-wins is no
    // longer possible from API clients that honor the contract.
    const { rowVersion } = updateSupplierDto;
    if (typeof rowVersion !== 'number') {
      throw new BadRequestException(
        'rowVersion is required for supplier update (optimistic locking)',
      );
    }

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
        // Pre-update snapshot for the audit diff (same scoped read the
        // client saw; the CAS itself is keyed on the caller's rowVersion).
        const before = await this.suppliersRepository.findById(
          id,
          currentUser.companyId,
          tx,
        );
        const updated = await this.suppliersRepository.update(
          id,
          {
            companyName: updateSupplierDto.companyName,
            bin: updateSupplierDto.bin,
            email: updateSupplierDto.email,
            phone: updateSupplierDto.phone,
            website: updateSupplierDto.website,
            notes: updateSupplierDto.notes,
            isActive: updateSupplierDto.isActive,
            // G9-C: undefined = leave unchanged; null clears the value.
            defaultDueDays: updateSupplierDto.defaultDueDays,
            creditLimit: updateSupplierDto.creditLimit as
              | Prisma.Decimal
              | string
              | number
              | null
              | undefined,
          } as Prisma.SupplierUpdateInput,
          currentUser.companyId,
          rowVersion,
          tx,
        );
        // G1 (P3-04): audit in the SAME transaction as the business write.
        await this.auditLogService.log(
          {
            companyId: currentUser.companyId,
            userId: currentUser.userId,
            entityType: 'Supplier',
            entityId: updated.id,
            action: 'supplier.update',
            before: before ? supplierAuditFields(before) : null,
            after: supplierAuditFields(updated),
          },
          tx,
        );
        return updated;
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
        // Server-side fresh read supplies the CAS token: the archive action
        // originates from UI without a rowVersion (approved G1 decision).
        const before = await this.suppliersRepository.findById(
          id,
          currentUser.companyId,
          tx,
        );
        const rowVer = before?.rowVersion ?? 0;
        const deleted = await this.suppliersRepository.softDelete(
          id,
          currentUser.companyId,
          rowVer,
          tx,
        );
        // G1 (P3-04): audit in the SAME transaction as the tombstone write.
        await this.auditLogService.log(
          {
            companyId: currentUser.companyId,
            userId: currentUser.userId,
            entityType: 'Supplier',
            entityId: deleted.id,
            action: 'supplier.soft_delete',
            before: before ? supplierAuditFields(before) : null,
            after: supplierAuditFields(deleted),
          },
          tx,
        );
        return deleted;
      },
    );

    return this.toEntity(deletedSupplier);
  }

  /**
   * G1: company-name duplicate warning (application-level, non-blocking).
   *
   * Returns active suppliers in the caller's company whose normalized name
   * equals the normalized query (trim → collapse internal whitespace →
   * lowercase). Case-insensitive equality only — no fuzzy matching by
   * design. Soft-deleted rows are excluded; the result is advisory: the
   * client may proceed with creation regardless.
   */
  async checkDuplicateName(
    rawName: string,
    currentUser: JwtPayload,
  ): Promise<SupplierEntity[]> {
    const normalized = rawName.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!normalized) {
      return [];
    }
    const dupes = await this.suppliersRepository.findActiveByNameNormalized(
      normalized,
      currentUser.companyId,
    );
    return dupes.map((d) => this.toEntity(d));
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
      // G9-C: supplier terms & credit foundation (read-model mapping).
      defaultDueDays: supplier.defaultDueDays,
      creditLimit: supplier.creditLimit?.toString() ?? null,
      isActive: supplier.isActive,
      // G1 (P3-03): exposed so API clients can perform CAS updates.
      rowVersion: supplier.rowVersion,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      deletedAt: supplier.deletedAt,
    };
  }
}
