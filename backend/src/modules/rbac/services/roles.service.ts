import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleEntity } from '../entities/role.entity';
import { RolesRepository } from '../repositories/roles.repository';

@Injectable()
export class RolesService {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async create(dto: CreateRoleDto, companyId: string): Promise<RoleEntity> {
    const existing = await this.rolesRepository.findByName(dto.name, companyId);
    if (existing) {
      throw new ConflictException(
        `Role with name "${dto.name}" already exists in this company`,
      );
    }

    return this.prismaService.$transaction(async (tx) => {
      const role = await this.rolesRepository.create(
        {
          name: dto.name,
          description: dto.description,
          isSystem: dto.isSystem ?? false,
          company: { connect: { id: companyId } },
        },
        tx,
      );

      if (dto.permissionIds && dto.permissionIds.length > 0) {
        await this.rolesRepository.setPermissions(
          role.id,
          dto.permissionIds,
          tx,
        );
      }

      const fullRole = await this.rolesRepository.findById(role.id, companyId);
      return RoleEntity.fromPrisma(fullRole!);
    });
  }

  async findAll(
    companyId: string,
    params?: { page?: number; limit?: number; isActive?: boolean },
  ): Promise<{
    items: ReturnType<typeof RoleEntity.fromPrisma>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    }

    const result = await this.rolesRepository.findAllByCompany(companyId, {
      page,
      limit,
      isActive: params?.isActive,
    });

    return {
      items: result.items.map((r) => RoleEntity.fromPrisma(r)),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, companyId: string): Promise<RoleEntity> {
    const role = await this.rolesRepository.findById(id, companyId);
    if (!role) {
      throw new NotFoundException(`Role with id "${id}" not found`);
    }
    return RoleEntity.fromPrisma(role);
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    companyId: string,
  ): Promise<RoleEntity> {
    const existing = await this.rolesRepository.findById(id, companyId);
    if (!existing) {
      throw new NotFoundException(`Role with id "${id}" not found`);
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.rolesRepository.findByName(
        dto.name,
        companyId,
      );
      if (duplicate) {
        throw new ConflictException(
          `Role with name "${dto.name}" already exists in this company`,
        );
      }
    }

    return this.prismaService.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.isSystem !== undefined) updateData.isSystem = dto.isSystem;

      if (Object.keys(updateData).length > 0) {
        const rowVer = existing.rowVersion ?? 0;
        await this.rolesRepository.update(
          id,
          updateData,
          companyId,
          rowVer,
          tx,
        );
      }

      if (dto.permissionIds !== undefined) {
        await this.rolesRepository.setPermissions(id, dto.permissionIds, tx);
      }

      const updated = await this.rolesRepository.findById(id, companyId);
      return RoleEntity.fromPrisma(updated!);
    });
  }

  async softDelete(id: string, companyId: string): Promise<void> {
    const existing = await this.rolesRepository.findById(id, companyId);
    if (!existing) {
      throw new NotFoundException(`Role with id "${id}" not found`);
    }
    const rowVer = existing.rowVersion ?? 0;
    await this.rolesRepository.softDelete(id, companyId, rowVer);
  }

  /**
   * Assign a role to a user within the current company.
   */
  async assignRoleToUser(dto: AssignRoleDto, companyId: string): Promise<void> {
    const role = await this.rolesRepository.findById(dto.roleId, companyId);
    if (!role) {
      throw new NotFoundException(`Role with id "${dto.roleId}" not found`);
    }

    const companyMemberId = await this.rolesRepository.findCompanyMemberId(
      dto.userId,
      companyId,
    );
    if (!companyMemberId) {
      throw new NotFoundException(
        `User with id "${dto.userId}" is not a member of this company`,
      );
    }

    await this.rolesRepository.assignRoleToUser(companyMemberId, dto.roleId);
  }

  /**
   * Remove a role from a user within the current company.
   */
  async removeRoleFromUser(
    dto: AssignRoleDto,
    companyId: string,
  ): Promise<void> {
    const role = await this.rolesRepository.findById(dto.roleId, companyId);
    if (!role) {
      throw new NotFoundException(`Role with id "${dto.roleId}" not found`);
    }

    const companyMemberId = await this.rolesRepository.findCompanyMemberId(
      dto.userId,
      companyId,
    );
    if (!companyMemberId) {
      throw new NotFoundException(
        `User with id "${dto.userId}" is not a member of this company`,
      );
    }

    await this.rolesRepository.removeRoleFromUser(companyMemberId, dto.roleId);
  }

  /**
   * Get users with their assigned roles for the current company.
   */
  async findUsersByCompany(
    companyId: string,
  ): Promise<{ userId: string; roleIds: string[] }[]> {
    return this.rolesRepository.findUsersByCompany(companyId);
  }
}
