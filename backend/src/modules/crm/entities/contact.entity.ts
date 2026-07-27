import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContactEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  position?: string;

  @ApiProperty({ default: false })
  isPrimary!: boolean;

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

  constructor(partial: Partial<ContactEntity>) {
    Object.assign(this, partial);
  }
}
