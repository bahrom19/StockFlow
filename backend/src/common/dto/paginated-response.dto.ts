import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  items!: T[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 100 })
  total!: number;
}
