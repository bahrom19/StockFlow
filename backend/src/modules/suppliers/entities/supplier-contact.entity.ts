import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierContactEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  @ApiPropertyOptional({ example: 'John' })
  firstName!: string | null;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName!: string | null;

  @ApiPropertyOptional({ example: '+77001234567' })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'john@example.com' })
  email!: string | null;

  @ApiPropertyOptional({ example: 'Purchasing Manager' })
  position!: string | null;

  @ApiProperty({ example: false })
  isPrimary!: boolean;

  @ApiPropertyOptional({ example: 'Main point of contact' })
  notes!: string | null;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;
}
