import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateJournalLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({ example: '1000.0000' })
  @IsString()
  @IsNotEmpty()
  debit!: string;

  @ApiProperty({ example: '0.0000' })
  @IsString()
  @IsNotEmpty()
  credit!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  financialPeriodId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  entryDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({ type: [CreateJournalLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
