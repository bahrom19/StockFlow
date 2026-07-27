import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RFQItemEntity {
  @ApiProperty() id!: string;
  @ApiProperty() rfqId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty({ example: 10 }) quantity!: number;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class RFQEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty({ example: 'RFQ-0001' }) rfqNumber!: string;
  @ApiProperty() rfqDate!: Date;
  @ApiPropertyOptional() expectedDate!: Date | null;
  @ApiProperty({ enum: ['DRAFT', 'SENT', 'RECEIVED', 'CLOSED', 'CANCELLED'] })
  status!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiPropertyOptional() createdBy!: string | null;
  @ApiPropertyOptional() approvedBy!: string | null;
  @ApiPropertyOptional() approvedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() deletedAt!: Date | null;
  @ApiPropertyOptional({ type: [RFQItemEntity] }) items?: RFQItemEntity[];
}
