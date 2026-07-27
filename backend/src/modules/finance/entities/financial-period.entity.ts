import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FinancialPeriodEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({ example: 'July 2026' })
  name!: string;

  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiProperty({ example: 7 })
  month!: number;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty({ enum: ['OPEN', 'CLOSING', 'CLOSED'] })
  status!: string;

  @ApiPropertyOptional()
  openedBy!: string | null;

  @ApiProperty()
  openedAt!: Date;

  @ApiPropertyOptional()
  closedBy!: string | null;

  @ApiPropertyOptional()
  closedAt!: Date | null;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
