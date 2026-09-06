import { ApiProperty } from '@nestjs/swagger';

export class AIChatResponseDto {
  @ApiProperty({ description: 'AI assistant response text' })
  content!: string;

  @ApiProperty({
    description: 'Names of tools that were used to generate the response',
    type: [String],
  })
  toolCallsUsed!: string[];
}
