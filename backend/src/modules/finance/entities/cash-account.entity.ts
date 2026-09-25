import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CashAccountEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiPropertyOptional()
  warehouseId!: string | null;

  @ApiPropertyOptional()
  chartOfAccountId!: string | null;

  @ApiProperty({ example: 'Main Register' })
  name!: string;

  @ApiProperty({ enum: ['PETTY_CASH', 'MAIN_CASH', 'REGISTER', 'SAFE'] })
  type!: string;

  @ApiProperty({ example: 'KZT' })
  currency!: string;

  /**
   * @deprecated Dead since introduction: never written by any producer, always
   * the database default. Retained temporarily for backward compatibility.
   * Canonical balances are derived from the GL (JournalEntry/JournalLine).
   * Do not use for authoritative accounting decisions. Removal is deferred
   * to a future versioned/API-removal workstream.
   */
  @ApiProperty({
    example: '0.0000',
    deprecated: true,
    description:
      'Deprecated: never maintained, always the database default. ' +
      'Retained for backward compatibility. Canonical balances come from ' +
      'the GL; do not use for accounting decisions.',
  })
  openingBalance!: string;

  /**
   * @deprecated Dead since introduction: never written by any producer, always
   * the database default. Retained temporarily for backward compatibility.
   * Canonical balances are derived from the GL (JournalEntry/JournalLine).
   * Do not use for authoritative accounting decisions. Removal is deferred
   * to a future versioned/API-removal workstream.
   */
  @ApiProperty({
    example: '0.0000',
    deprecated: true,
    description:
      'Deprecated: never maintained, always the database default. ' +
      'Retained for backward compatibility. Canonical balances come from ' +
      'the GL; do not use for accounting decisions.',
  })
  currentBalance!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt!: Date | null;
}
