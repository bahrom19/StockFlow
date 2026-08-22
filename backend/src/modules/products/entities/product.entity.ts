import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';

export class ProductEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({ example: 'Wireless Mouse' })
  name!: string;

  @ApiPropertyOptional({ example: 'Ergonomic wireless mouse' })
  description!: string | null;

  @ApiPropertyOptional({ example: 'SKU-1001' })
  sku!: string | null;

  @ApiPropertyOptional({ example: '1234567890123' })
  barcode!: string | null;

  /** NTIN (National Trade Item Number) — independent identifier. */
  @ApiPropertyOptional({ example: '123456789', nullable: true })
  ntin!: string | null;

  @ApiProperty({ example: '49.9900' })
  price!: Decimal | string | null;

  @ApiPropertyOptional({ example: '35.5000' })
  costPrice!: Decimal | string | null;

  @ApiPropertyOptional({ example: 'pcs' })
  unit!: string | null;

  @ApiPropertyOptional({ example: 'Electronics' })
  category!: string | null;

  @ApiPropertyOptional({ example: 'Logitech' })
  brand!: string | null;

  @ApiProperty({ example: 25 })
  stockQuantity!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-07-07T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-07T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;
}
