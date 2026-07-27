import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerNoteEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  content?: string;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiProperty()
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;

  constructor(partial: Partial<CustomerNoteEntity>) {
    Object.assign(this, partial);
  }
}
