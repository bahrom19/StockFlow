import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';

export class CustomerEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  groupId!: string | null;

  @ApiProperty({ enum: CustomerType, example: CustomerType.PERSON })
  type!: CustomerType;

  @ApiPropertyOptional({ example: 'John' })
  firstName!: string | null;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName!: string | null;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  companyName!: string | null;

  @ApiPropertyOptional({ example: '010203040506' })
  iin!: string | null;

  @ApiPropertyOptional({ example: '123456789012' })
  bin!: string | null;

  @ApiPropertyOptional({ example: 'john@example.com' })
  email!: string | null;

  @ApiPropertyOptional({ example: '+77001234567' })
  phone!: string | null;

  @ApiPropertyOptional({ example: '+77009876543' })
  mobile!: string | null;

  @ApiPropertyOptional({ example: '10.0000' })
  discount!: string | null;

  @ApiPropertyOptional({ example: '10000.0000' })
  creditLimit!: string | null;

  @ApiPropertyOptional({ example: '500.0000' })
  currentDebt!: string | null;

  @ApiPropertyOptional({ example: 125 })
  bonusPoints!: number;

  @ApiPropertyOptional({ example: 'Preferred client' })
  notes!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-08T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;
}
