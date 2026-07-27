import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { PermissionEntity } from '../entities/permission.entity';
import { PermissionsRepository } from '../repositories/permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async create(dto: CreatePermissionDto): Promise<PermissionEntity> {
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

    return PermissionEntity.fromPrisma(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.permissionsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Permission with id "${id}" not found`);
    }
    await this.permissionsRepository.delete(id);
  }
}
