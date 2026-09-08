import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  GatewayTimeoutException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AIService, ConversationNotFoundError, PersistenceError, IdempotencyKeyMismatchError, RequestBudgetExceededError } from './ai.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { AIThrottle } from './decorators/ai-throttle.decorator';
import { AIChatRequestDto } from './dto/ai-chat-request.dto';
import { AIChatResponseDto } from './dto/ai-chat-response.dto';
import { ConversationListResponseDto } from './dto/conversation-list-response.dto';
import { ConversationDetailResponseDto } from './dto/conversation-detail-response.dto';
import { SecurityContext } from './security/security-context';

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly conversationRepository: ConversationRepository,
    private readonly prismaService: PrismaService,
  ) {}

  private async buildSecurityContext(user: JwtPayload): Promise<SecurityContext> {
    // Fetch real company data for context (F1 fix — no more hardcoded locale/currency)
    const company = await this.prismaService.company.findUnique({
      where: { id: user.companyId },
      select: { name: true, currency: true, language: true, timezone: true },
    });

    return {
      userId: user.userId,
      companyId: user.companyId,
      roles: user.roles ?? [],
      permissions: [], // Resolved from roles in AIService
      locale: company?.language ?? 'en',
      currency: company?.currency ?? 'KZT',
    };
  }

  @Post('chat')
  @AIThrottle()
  @RequirePermission('ai:chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat with StockFlow AI Assistant',
    description:
      'Send a message to the AI assistant. Pass conversationId to continue an existing conversation, or omit it to start a new one.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI response',
    type: AIChatResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ai:chat permission required' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'Conflict — request already in progress' })
  async chat(
    @Body() dto: AIChatRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AIChatResponseDto> {
    const securityContext = await this.buildSecurityContext(user);

    let result;
    try {
      result = await this.aiService.chat(
        dto.message,
        securityContext,
        dto.conversationId,
        dto.idempotencyKey,
      );
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        throw new NotFoundException('Conversation not found');
      }
      if (error instanceof PersistenceError) {
        throw new Error('Failed to save conversation data');
      }
      if (error instanceof IdempotencyKeyMismatchError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof RequestBudgetExceededError) {
        throw new GatewayTimeoutException('AI request timed out');
      }
      throw error;
    }

    return {
      conversationId: result.conversationId,
      content: result.content,
      toolCallsUsed: result.toolCallsUsed,
      createdAt: result.createdAt,
    };
  }

  @Get('conversations')
  @RequirePermission('ai:chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List AI conversations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated conversation list',
    type: ConversationListResponseDto,
  })
  async listConversations(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ConversationListResponseDto> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    return this.conversationRepository.listConversations(
      user.companyId,
      user.userId,
      pageNum,
      limitNum,
    );
  }

  @Get('conversations/:id')
  @RequirePermission('ai:chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get conversation with messages' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation detail with messages',
    type: ConversationDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConversationDetailResponseDto> {
    const conversation = await this.conversationRepository.findConversationByIdForUser(
      id,
      user.companyId,
      user.userId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const messages = await this.conversationRepository.listMessages(
      id,
      user.companyId,
      user.userId,
      100, // Get all messages for detail view
    );

    return {
      id: conversation.id,
      title: conversation.title,
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCallsJson: m.toolCallsJson ?? undefined,
        toolCallId: m.toolCallId ?? undefined,
        toolName: m.toolName ?? undefined,
        createdAt: m.createdAt,
      })),
    };
  }

  @Delete('conversations/:id')
  @RequirePermission('ai:chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a conversation and all its messages' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ deleted: boolean }> {
    const deleted = await this.conversationRepository.deleteConversation(
      id,
      user.companyId,
      user.userId,
    );

    if (!deleted) {
      throw new NotFoundException('Conversation not found');
    }

    return { deleted: true };
  }
}
