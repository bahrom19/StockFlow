import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PriceListEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ default: true })
  isActive!: boolean;

  @ApiProperty()
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;

  constructor(partial: Partial<PriceListEntity>) {
    Object.assign(this, partial);
  }
}
