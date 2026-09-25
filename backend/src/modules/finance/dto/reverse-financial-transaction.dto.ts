import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReverseFinancialTransactionDto {
  @ApiPropertyOptional({
    description: 'Human-readable reason recorded on the reversal entries',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
