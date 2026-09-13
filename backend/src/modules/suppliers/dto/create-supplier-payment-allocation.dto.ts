import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateSupplierPaymentAllocationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsUUID()
  paymentId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  purchaseInvoiceId?: string;

  @ApiProperty({ example: '50000.0000' })
  @IsNotEmpty()
  @Min(0.0001)
  amount!: number;
}
