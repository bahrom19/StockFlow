import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreditLimitEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty({ default: 'KZT' })
  currency!: string;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  approvedAt?: Date;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  constructor(partial: Partial<CreditLimitEntity>) {
    Object.assign(this, partial);
  }
}
