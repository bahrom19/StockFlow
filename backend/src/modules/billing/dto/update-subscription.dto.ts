import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ description: 'Plan code to switch to' })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional({ description: 'Cancel reason' })
  @IsOptional()
  @IsString()
  cancelReason?: string;

  @ApiPropertyOptional({ description: 'Whether to cancel at period end' })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional({ description: 'Admin notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
