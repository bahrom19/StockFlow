import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CashShiftEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() warehouseId!: string;
  @ApiProperty() cashierId!: string;
  @ApiProperty({ enum: ['OPEN', 'CLOSED'] }) status!: string;
  @ApiProperty() openedAt!: Date;
  @ApiPropertyOptional() closedAt!: Date | null;
  @ApiProperty({ example: '0.0000' }) openingBalance!: string;
  @ApiProperty({ example: '0.0000' }) closingBalance!: string;
  @ApiProperty({ example: '0.0000' }) cashSales!: string;
  @ApiProperty({ example: '0.0000' }) cardSales!: string;
  @ApiProperty({ example: '0.0000' }) qrSales!: string;
  @ApiProperty({ example: '0.0000' }) bankTransferSales!: string;
  @ApiProperty({ example: '0.0000' }) mobileWalletSales!: string;
  @ApiProperty({ example: '0.0000' }) totalSales!: string;
  @ApiProperty({ example: '0.0000' }) cashIn!: string;
  @ApiProperty({ example: '0.0000' }) cashOut!: string;
  @ApiProperty({ example: '0.0000' }) expectedClosing!: string;
  @ApiProperty({ example: '0.0000' }) difference!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ example: 0 }) rowVersion!: number;
}
