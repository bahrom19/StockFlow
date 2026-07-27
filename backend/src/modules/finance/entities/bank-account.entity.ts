import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BankAccountEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiPropertyOptional()
  chartOfAccountId!: string | null;

  @ApiProperty({ example: 'National Bank of Kazakhstan' })
  bankName!: string;

  @ApiProperty({ example: '1234567890' })
  accountNumber!: string;

  @ApiPropertyOptional({ example: 'Main Operating Account' })
  accountName!: string | null;

  @ApiPropertyOptional({ example: 'KZ123456789012345678' })
  iban!: string | null;

  @ApiPropertyOptional({ example: 'NBRKKZKA' })
  bic!: string | null;

  @ApiProperty({ example: 'KZT' })
  currency!: string;

  @ApiProperty({ example: '0.0000' })
  openingBalance!: string;

  @ApiProperty({ example: '0.0000' })
  currentBalance!: string;

  @ApiProperty({ example: false })
  isDefault!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional()
  lastReconciledAt!: Date | null;

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
