import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User, UserStatus } from '@prisma/client';

export class UserEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: '$2b$10$...' })
  passwordHash!: string;

  @ApiPropertyOptional({ example: 'John' })
  firstName!: string | null;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName!: string | null;

  @ApiPropertyOptional({ example: '+77011234567' })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'Manager' })
  position!: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-07-07T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-07T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;

  static fromPrisma(user: User): UserEntity {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      position: user.position,
      status: user.status,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}
