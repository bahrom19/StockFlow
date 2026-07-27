import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChartOfAccountEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({ example: '1010' })
  code!: string;

  @ApiProperty({ example: 'Cash' })
  name!: string;

  @ApiPropertyOptional({ example: 'Main operating cash account' })
  description!: string | null;

  @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] })
  accountType!: string;

  @ApiProperty({ enum: ['DEBIT', 'CREDIT'] })
  normalBalance!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isSystem!: boolean;

  @ApiProperty({ example: true })
  isCashOrBank!: boolean;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  parentId!: string | null;

  @ApiProperty({ example: 0 })
  level!: number;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt!: Date | null;
}
