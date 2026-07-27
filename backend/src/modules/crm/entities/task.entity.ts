import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiPropertyOptional()
  customerId?: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ default: 'TODO' })
  status!: string;

  @ApiProperty({ default: 'MEDIUM' })
  priority!: string;

  @ApiPropertyOptional()
  dueDate?: Date;

  @ApiPropertyOptional()
  assignedTo?: string;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;

  constructor(partial: Partial<TaskEntity>) {
    Object.assign(this, partial);
  }
}
