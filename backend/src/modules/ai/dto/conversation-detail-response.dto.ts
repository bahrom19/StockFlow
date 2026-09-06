import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationMessageDto {
  @ApiProperty({ description: 'Message ID' })
  id!: string;

  @ApiProperty({ description: 'Message role', enum: ['user', 'assistant', 'tool'] })
  role!: string;

  @ApiProperty({ description: 'Message content' })
  content!: string;

  @ApiPropertyOptional({ description: 'Tool calls (assistant messages only)' })
  toolCallsJson?: unknown;

  @ApiPropertyOptional({ description: 'Tool call ID (tool result messages)' })
  toolCallId?: string;

  @ApiPropertyOptional({ description: 'Tool name (tool result messages)' })
  toolName?: string;

  @ApiProperty({ description: 'Message creation timestamp' })
  createdAt!: Date;
}

export class ConversationDetailResponseDto {
  @ApiProperty({ description: 'Conversation ID' })
  id!: string;

  @ApiProperty({ description: 'Conversation title', nullable: true })
  title!: string | null;

  @ApiProperty({ description: 'Conversation messages', type: [ConversationMessageDto] })
  messages!: ConversationMessageDto[];
}
