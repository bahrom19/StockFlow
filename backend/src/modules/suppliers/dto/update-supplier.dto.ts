import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto';

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  /**
   * G1 (P3-03): REQUIRED optimistic-locking token. Must be the rowVersion
   * the client last read; a stale value is rejected with 409 so concurrent
   * edits surface as an explicit conflict instead of silent last-write-wins.
   */
  @ApiProperty({ example: 0 })
  @IsInt()
  rowVersion!: number;
}
