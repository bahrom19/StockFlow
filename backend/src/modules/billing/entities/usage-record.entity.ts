import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UsageRecordEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() subscriptionId!: string;
  @ApiProperty({ example: 'api_calls' }) metric!: string;
  @ApiProperty({ example: 0 }) value!: number;
  @ApiProperty() periodStart!: Date;
  @ApiPropertyOptional() periodEnd!: Date | null;
  @ApiProperty() rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
