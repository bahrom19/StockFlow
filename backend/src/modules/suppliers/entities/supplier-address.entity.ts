import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierAddressEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  @ApiPropertyOptional({ example: 'Almaty' })
  city!: string | null;

  @ApiPropertyOptional({ example: 'Kazakhstan' })
  country!: string | null;

  @ApiPropertyOptional({ example: '123 Main St' })
  street!: string | null;

  @ApiPropertyOptional({ example: '050000' })
  postalCode!: string | null;

  @ApiProperty({ example: false })
  isDefault!: boolean;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;
}
