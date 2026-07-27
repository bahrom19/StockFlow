import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({ example: 'Acme Supplies' })
  companyName!: string;

  @ApiPropertyOptional({ example: '123456789012' })
  bin!: string | null;

  @ApiPropertyOptional({ example: 'supplier@example.com' })
  email!: string | null;

  @ApiPropertyOptional({ example: '+77001234567' })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'https://acme.example.com' })
  website!: string | null;

  @ApiPropertyOptional({ example: 'Preferred supplier' })
  notes!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;
}
