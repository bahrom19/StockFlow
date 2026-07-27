import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerAddressEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  country?: string;

  @ApiPropertyOptional()
  street?: string;

  @ApiPropertyOptional()
  postalCode?: string;

  @ApiProperty({ default: false })
  isDefault!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;

  constructor(partial: Partial<CustomerAddressEntity>) {
    Object.assign(this, partial);
  }
}
