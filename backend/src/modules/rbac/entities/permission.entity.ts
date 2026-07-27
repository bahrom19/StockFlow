import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission } from '@prisma/client';

export class PermissionEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'products:create' })
  code!: string;

  @ApiProperty({ example: 'Create Products' })
  name!: string;

  @ApiPropertyOptional({ example: 'Allows creating new products' })
  description!: string | null;

  @ApiProperty({ example: 'products' })
  module!: string;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  createdAt!: Date;

  static fromPrisma(permission: Permission): PermissionEntity {
    return {
      id: permission.id,
      code: permission.code,
      name: permission.name,
      description: permission.description,
      module: permission.module,
      createdAt: permission.createdAt,
    };
  }

  static fromPrismaList(permissions: Permission[]): PermissionEntity[] {
    return permissions.map((p) => PermissionEntity.fromPrisma(p));
  }
}
