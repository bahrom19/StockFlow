import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AIService } from './ai.service';
import { AIChatRequestDto } from './dto/ai-chat-request.dto';
import { AIChatResponseDto } from './dto/ai-chat-response.dto';
import { SecurityContext } from './security/security-context';

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('chat')
  @RequirePermission('ai:chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat with StockFlow AI Assistant',
    description:
      'Send a message to the AI assistant. The AI uses read-only tools to answer business questions about sales, inventory, profit, and stock.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI response',
    type: AIChatResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ai:chat permission required' })
  async chat(
    @Body() dto: AIChatRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AIChatResponseDto> {
    const securityContext: SecurityContext = {
      userId: user.userId,
      companyId: user.companyId,
      roles: user.roles ?? [],
      permissions: [], // Resolved from roles in AIService
      locale: 'en',
      currency: 'KZT',
    };

    const result = await this.aiService.chat(dto.message, securityContext);

    return {
      content: result.content,
      toolCallsUsed: result.toolCallsUsed,
    };
  }
}
