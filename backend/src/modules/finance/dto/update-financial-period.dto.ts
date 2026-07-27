import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateFinancialPeriodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
