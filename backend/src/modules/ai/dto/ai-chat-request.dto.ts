import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AIChatRequestDto {
  @ApiProperty({
    description: 'User message to the AI assistant',
    example: 'Покажи продажи за сегодня',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
