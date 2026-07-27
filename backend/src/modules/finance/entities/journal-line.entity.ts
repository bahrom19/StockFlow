import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JournalLineEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty()
  journalEntryId!: string;

  @ApiProperty()
  accountId!: string;

  @ApiProperty({ example: '1000.0000' })
  debit!: string;

  @ApiProperty({ example: '0.0000' })
  credit!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
