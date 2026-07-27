import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JournalLineEntity } from './journal-line.entity';

export class JournalEntryEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty()
  financialPeriodId!: string;

  @ApiProperty({ example: 1 })
  entryNumber!: number;

  @ApiProperty()
  entryDate!: Date;

  @ApiPropertyOptional({ example: 'Sale #1234' })
  description!: string | null;

  @ApiProperty({ enum: ['DRAFT', 'POSTED', 'REVERSED'] })
  status!: string;

  @ApiProperty({ example: '1000.0000' })
  totalDebit!: string;

  @ApiProperty({ example: '1000.0000' })
  totalCredit!: string;

  @ApiPropertyOptional()
  referenceType!: string | null;

  @ApiPropertyOptional()
  referenceId!: string | null;

  @ApiPropertyOptional()
  postedBy!: string | null;

  @ApiPropertyOptional()
  postedAt!: Date | null;

  @ApiPropertyOptional()
  createdBy!: string | null;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: [JournalLineEntity] })
  lines?: JournalLineEntity[];
}
