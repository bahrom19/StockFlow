import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RoleEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({ example: 'Manager' })
  name!: string;

  @ApiPropertyOptional({ example: 'Can manage products and inventory' })
  description!: string | null;

  @ApiProperty({ example: false })
  isSystem!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;

  static fromPrisma(
    role: Role & {
      permissions?: {
        permission: { id: string; code: string; name: string };
      }[];
    },
  ): RoleEntity & {
    permissions?: { id: string; code: string; name: string }[];
  } {
    return {
      id: role.id,
      companyId: role.companyId,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      deletedAt: role.deletedAt,
      ...(role.permissions
        ? {
            permissions: role.permissions.map((rp) => ({
              id: rp.permission.id,
              code: rp.permission.code,
              name: rp.permission.name,
            })),
          }
        : {}),
    };
  }

  static fromPrismaList(roles: Role[]): RoleEntity[] {
    return roles.map((r) => RoleEntity.fromPrisma(r));
  }
}
