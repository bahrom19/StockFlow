import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanySubscriptionEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() planId!: string;
  @ApiProperty({
    enum: [
      'TRIAL',
      'ACTIVE',
      'PAST_DUE',
      'SUSPENDED',
      'CANCELLED',
      'EXPIRED',
      'FREE',
    ],
  })
  status!: string;
  @ApiPropertyOptional() trialStartsAt!: Date | null;
  @ApiPropertyOptional() trialEndsAt!: Date | null;
  @ApiProperty() currentPeriodStart!: Date;
  @ApiPropertyOptional() currentPeriodEnd!: Date | null;
  @ApiPropertyOptional() cancelledAt!: Date | null;
  @ApiPropertyOptional() cancelReason!: string | null;
  @ApiProperty({ example: false }) cancelAtPeriodEnd!: boolean;
  @ApiPropertyOptional() pastDueAt!: Date | null;
  @ApiPropertyOptional() suspendedAt!: Date | null;
  @ApiPropertyOptional() willExpireAt!: Date | null;
  @ApiProperty({ example: 0 }) paymentRetryCount!: number;
  @ApiPropertyOptional() lastPaymentAttempt!: Date | null;
  @ApiPropertyOptional() providerCustomerId!: string | null;
  @ApiPropertyOptional() providerSubscriptionId!: string | null;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() deletedAt!: Date | null;
}
