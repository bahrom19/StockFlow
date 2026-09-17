import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * A single requested refund line: how many units of one SaleItem to refund.
 *
 * The client supplies ONLY `saleItemId` + `quantity`. Money amounts
 * (`unitPrice`, `total`) and the historical `fifoCost` are always derived
 * server-side from the original SaleItem — client-supplied amounts are never
 * trusted.
 */
export class RefundItemDto {
  @IsUUID()
  saleItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

/**
 * G11-E E2 refund request.
 *
 * `items` omitted or empty means "refund ALL remaining quantities" — this is
 * the semantics of the compatibility endpoint `POST /sales/:id/refund`.
 */
export class CreateRefundDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  items?: RefundItemDto[];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
