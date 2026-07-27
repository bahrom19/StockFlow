import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WarehouseEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiPropertyOptional() address!: string | null;
  @ApiPropertyOptional() phone!: string | null;
  @ApiPropertyOptional() managerName!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() deletedAt!: Date | null;
}
