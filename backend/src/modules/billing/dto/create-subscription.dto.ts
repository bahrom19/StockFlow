import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Plan code to subscribe to' })
  @IsString()
  planCode!: string;

  @ApiPropertyOptional({ description: 'Trial days override', default: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Initial notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
