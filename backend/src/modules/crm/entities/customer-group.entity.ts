import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerGroupEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  discountPercent?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;

  constructor(partial: Partial<CustomerGroupEntity>) {
    Object.assign(this, partial);
  }
}
