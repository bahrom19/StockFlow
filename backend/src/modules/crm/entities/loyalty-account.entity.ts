import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoyaltyAccountEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty({ default: 0 })
  points!: number;

  @ApiProperty({ default: 0 })
  lifetimePoints!: number;

  @ApiProperty({ default: 'STANDARD' })
  tier!: string;

  @ApiProperty()
  enrolledAt!: Date;

  @ApiPropertyOptional()
  lastActivity?: Date;

  @ApiProperty()
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  constructor(partial: Partial<LoyaltyAccountEntity>) {
    Object.assign(this, partial);
  }
}
