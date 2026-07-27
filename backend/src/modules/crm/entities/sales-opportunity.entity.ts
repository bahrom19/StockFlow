import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesOpportunityEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ default: 'NEW' })
  status!: string;

  @ApiProperty({ default: 'MEDIUM' })
  priority!: string;

  @ApiProperty()
  value!: string;

  @ApiProperty({ default: 0 })
  probability!: number;

  @ApiPropertyOptional()
  expectedCloseDate?: Date;

  @ApiPropertyOptional()
  assignedTo?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;

  constructor(partial: Partial<SalesOpportunityEntity>) {
    Object.assign(this, partial);
  }
}
