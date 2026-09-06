import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { AIController } from '../ai.controller';
import { AIService } from '../ai.service';
import { ConversationRepository } from '../repositories/conversation.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';

describe('AIController', () => {
  let controller: AIController;
  let aiService: jest.Mocked<AIService>;

  const mockAiService = {
    chat: jest.fn(),
  };

  const mockConversationRepository = {
    findConversationByIdForUser: jest.fn(),
    listConversations: jest.fn(),
    listMessages: jest.fn(),
    deleteConversation: jest.fn(),
  };

  const mockPrismaService = {
    company: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'Test Company',
        currency: 'KZT',
        language: 'en',
        timezone: 'UTC',
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        { provide: AIService, useValue: mockAiService },
        { provide: ConversationRepository, useValue: mockConversationRepository },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AIController>(AIController);
    aiService = module.get(AIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('chat', () => {
    it('should return AI response', async () => {
      aiService.chat.mockResolvedValue({
        conversationId: 'conv-1',
        content: 'Today you earned 125,000 KZT',
        toolCallsUsed: ['get_sales_summary'],
        createdAt: new Date().toISOString(),
      });

      const result = await controller.chat(
        { message: 'Show today sales' },
        { userId: 'user-1', companyId: 'company-1', roles: ['Admin'], email: 'test@test.com' },
      );

      expect(result.content).toBe('Today you earned 125,000 KZT');
      expect(result.toolCallsUsed).toEqual(['get_sales_summary']);
      expect(result.conversationId).toBe('conv-1');
      expect(aiService.chat).toHaveBeenCalledWith(
        'Show today sales',
        expect.objectContaining({
          userId: 'user-1',
          companyId: 'company-1',
        }),
        undefined,
      );
    });

    it('should pass SecurityContext with correct userId and companyId', async () => {
      aiService.chat.mockResolvedValue({
        conversationId: 'conv-2',
        content: 'Response',
        toolCallsUsed: [],
        createdAt: new Date().toISOString(),
      });

      const user = { userId: 'u-123', companyId: 'c-456', roles: ['Admin'], email: 'a@b.com' };
      await controller.chat({ message: 'test' }, user);

      expect(aiService.chat).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          userId: 'u-123',
          companyId: 'c-456',
          roles: ['Admin'],
        }),
        undefined,
      );
    });

    it('should handle empty tool calls', async () => {
      aiService.chat.mockResolvedValue({
        conversationId: 'conv-3',
        content: 'I can help you with that.',
        toolCallsUsed: [],
        createdAt: new Date().toISOString(),
      });

      const result = await controller.chat(
        { message: 'Hello' },
        { userId: 'u-1', companyId: 'c-1', roles: ['Admin'], email: 'a@b.com' },
      );

      expect(result.toolCallsUsed).toEqual([]);
    });

    it('should pass conversationId when provided', async () => {
      aiService.chat.mockResolvedValue({
        conversationId: 'conv-4',
        content: 'Continuing...',
        toolCallsUsed: [],
        createdAt: new Date().toISOString(),
      });

      await controller.chat(
        { message: 'Next question', conversationId: 'conv-4' },
        { userId: 'u-1', companyId: 'c-1', roles: ['Admin'], email: 'a@b.com' },
      );

      expect(aiService.chat).toHaveBeenCalledWith(
        'Next question',
        expect.any(Object),
        'conv-4',
      );
    });
  });
});
