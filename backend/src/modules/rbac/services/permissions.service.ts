import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { PermissionEntity } from '../entities/permission.entity';
import { PermissionsRepository } from '../repositories/permissions.repository';

/**
 * G16-N-4 P0-A — Permission is the GLOBAL authorization substrate.
 *
 * Every field of this service operates on rows that belong to no tenant, so
 * every mutation is platform-only (enforced by `@RequirePlatformOperator()` on
 * the controller plus the pre-existing tenant permission) and every mutation
 * is audited with `companyId: null`, because a global row has no owning
 * tenant. Recording it under a tenant id would assert a false security
 * boundary in the very trail used to detect boundary violations.
 */
@Injectable()
export class PermissionsService {
  constructor(
    private readonly permissionsRepository: PermissionsRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async create(
    dto: CreatePermissionDto,
    userId: string,
  ): Promise<PermissionEntity> {
    const existing = await this.permissionsRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(
        `Permission with code "${dto.code}" already exists`,
      );
    }

    const permission = await this.permissionsRepository.create({
      code: dto.code,
      name: dto.name,
      description: dto.description,
      module: dto.module,
    });

    await this.prismaService.auditLog.create({
      data: {
        action: 'PERMISSION_CREATED',
        entity: 'Permission',
        entityId: permission.id,
        newValues: {
          code: permission.code,
          name: permission.name,
          module: permission.module,
        },
        companyId: null,
        userId,
      },
    });

    return PermissionEntity.fromPrisma(permission);
  }

  async findAll(params?: {
    module?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: PermissionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    }

    const result = await this.permissionsRepository.findAll({
      module: params?.module,
      page,
      limit,
    });

    return {
      items: PermissionEntity.fromPrismaList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<PermissionEntity> {
    const permission = await this.permissionsRepository.findById(id);
    if (!permission) {
      throw new NotFoundException(`Permission with id "${id}" not found`);
    }
    return PermissionEntity.fromPrisma(permission);
  }

  async findByCode(code: string): Promise<PermissionEntity> {
    const permission = await this.permissionsRepository.findByCode(code);
    if (!permission) {
      throw new NotFoundException(`Permission with code "${code}" not found`);
    }
    return PermissionEntity.fromPrisma(permission);
  }

  async update(
    id: string,
    dto: UpdatePermissionDto,
    userId: string,
  ): Promise<PermissionEntity> {
    const existing = await this.permissionsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Permission with id "${id}" not found`);
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.permissionsRepository.findByCode(dto.code);
      if (duplicate) {
        throw new ConflictException(
          `Permission with code "${dto.code}" already exists`,
        );
      }
    }

    const updated = await this.permissionsRepository.update(id, {
      ...(dto.code ? { code: dto.code } : {}),
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.module ? { module: dto.module } : {}),
    });

    // A permission `code` rename silently re-points the meaning of every
    // tenant's RolePermission grants, so the before/after codes are recorded.
    await this.prismaService.auditLog.create({
      data: {
        action: 'PERMISSION_UPDATED',
        entity: 'Permission',
        entityId: id,
        oldValues: {
          code: existing.code,
          name: existing.name,
          module: existing.module,
        },
        newValues: {
          code: updated.code,
          name: updated.name,
          module: updated.module,
        },
        companyId: null,
        userId,
      },
    });

    return PermissionEntity.fromPrisma(updated);
  }

  /**
   * G16-N-4 P0-A: the deletion of a global authorization primitive is audited
   * inside the same transaction as the delete, and the audit row is written
   * FIRST.
   *
   * `RolePermission.permissionId` is `ON DELETE CASCADE`, so deleting one
   * Permission row silently strips that permission from EVERY role in EVERY
   * company. Both statements therefore share one transaction: if the audit
   * write fails, the deletion is rolled back and the authorization substrate
   * cannot be destroyed without leaving a trace.
   *
   * The delete goes through the transaction client rather than
   * PermissionsRepository because that repository is not transaction-aware;
   * adding tx support to it is outside this workstream's file boundary.
   */
  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.permissionsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Permission with id "${id}" not found`);
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: 'PERMISSION_DELETED',
          entity: 'Permission',
          entityId: id,
          oldValues: {
            code: existing.code,
            name: existing.name,
            module: existing.module,
          },
          companyId: null,
          userId,
        },
      });

      await tx.permission.delete({ where: { id } });
    });
  }
}
