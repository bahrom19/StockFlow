import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AIChatRequestDto {
  @ApiPropertyOptional({
    description: 'Existing conversation ID. Omit to start a new conversation.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiProperty({
    description: 'User message to the AI assistant',
    example: 'Покажи продажи за сегодня',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({
    description: 'Client-provided idempotency key for duplicate request prevention. If omitted, no idempotency tracking is performed.',
    example: 'client-uuid-123',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
