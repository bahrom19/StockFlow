import { ApiProperty } from '@nestjs/swagger';

export class ConversationSummaryDto {
  @ApiProperty({ description: 'Conversation ID' })
  id!: string;

  @ApiProperty({ description: 'Conversation title (from first message)', nullable: true })
  title!: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Number of messages in conversation' })
  messageCount!: number;
}

export class ConversationListResponseDto {
  @ApiProperty({ description: 'List of conversations', type: [ConversationSummaryDto] })
  items!: ConversationSummaryDto[];

  @ApiProperty({ description: 'Total number of conversations' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Items per page' })
  limit!: number;
}
