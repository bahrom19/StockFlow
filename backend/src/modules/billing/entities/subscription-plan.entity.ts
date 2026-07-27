import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscriptionPlanEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'starter' }) code!: string;
  @ApiProperty({ example: 'Starter' }) name!: string;
  @ApiPropertyOptional({ example: 'For small businesses' }) description!: string | null;
  @ApiProperty({ example: '29.0000' }) priceMonthly!: string;
  @ApiProperty({ example: '290.0000' }) priceYearly!: string;
  @ApiProperty({ example: 'USD' }) currency!: string;
  @ApiProperty({ example: 14 }) trialDays!: number;
  @ApiProperty({ example: 3 }) maxUsers!: number;
  @ApiProperty({ example: 1 }) maxWarehouses!: number;
  @ApiProperty({ example: 500 }) maxProducts!: number;
  @ApiProperty({ example: {} }) featureFlags!: Record<string, unknown>;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ example: 0 }) sortOrder!: number;
  @ApiProperty() rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() deletedAt!: Date | null;
}
