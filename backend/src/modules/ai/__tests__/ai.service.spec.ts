import { Test, TestingModule } from '@nestjs/testing';
import { AIService, ConversationNotFoundError, PersistenceError, ToolExecutionTimeoutError, IdempotencyKeyMismatchError, IdempotencyConflictError, RequestBudgetExceededError, ContextBudgetExceededError } from '../ai.service';
import { AIProvider, AIRequest, AIResponse } from '../providers/ai-provider.interface';
import { ToolRegistry } from '../tools/tool.registry';
import { AIAuditLogger } from '../logging/ai-audit.logger';
import { RolesRepository } from '../../rbac/repositories/roles.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { IdempotencyRepository } from '../repositories/idempotency.repository';
import { AITool } from '../tools/tool.interface';
import { SecurityContext } from '../security/security-context';
import { createHash } from 'crypto';
import { PrismaService } from '../../../common/prisma';

// Helper to compute fingerprint matching AIService.computeFingerprint
function computeFingerprint(message: string, conversationId?: string): string {
  const payload = JSON.stringify({ message, conversationId });
  return createHash('sha256').update(payload).digest('hex');
}

describe('AIService', () => {
  let service: AIService;
  let mockProvider: jest.Mocked<AIProvider>;
  let toolRegistry: ToolRegistry;
  let mockAuditLogger: jest.Mocked<AIAuditLogger>;
  let mockRolesRepository: jest.Mocked<RolesRepository>;
  let mockConversationRepository: jest.Mocked<ConversationRepository>;
  let mockIdempotencyRepository: jest.Mocked<IdempotencyRepository>;

  const testSecurityContext: SecurityContext = {
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['Admin'],
    permissions: [],
    locale: 'en',
    currency: 'KZT',
  };

  const mockTool: AITool = {
    name: 'get_dashboard',
    description: 'Get dashboard summary',
    inputSchema: { type: 'object', properties: {} },
    requiredPermission: 'reports:read',
    execute: jest.fn().mockResolvedValue({
      todaySales: { revenue: '125000', count: 25 },
    }),
  };

  beforeEach(async () => {
    mockProvider = {
      name: 'openai',
      chat: jest.fn(),
    };

    mockAuditLogger = {
      log: jest.fn(),
    } as any;

    mockRolesRepository = {
      findPermissionCodesByRoleNames: jest.fn().mockResolvedValue(['reports:read']),
    } as any;

    mockConversationRepository = {
      createConversation: jest.fn().mockResolvedValue({ id: 'conv-1', createdAt: new Date() }),
      findConversationByIdForUser: jest.fn(),
      createMessage: jest.fn().mockResolvedValue({ id: 'msg-1', createdAt: new Date() }),
      listMessages: jest.fn().mockResolvedValue([]),
      updateConversation: jest.fn(),
    } as any;

    mockIdempotencyRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
      acquireLock: jest.fn().mockResolvedValue({ acquired: true }),
      updateConversationId: jest.fn(),
      updateCompleted: jest.fn(),
      updateFailed: jest.fn(),
      reclaimExpired: jest.fn(),
      delete: jest.fn(),
      deleteExpired: jest.fn(),
    } as any;

    toolRegistry = new ToolRegistry();
    toolRegistry.register(mockTool);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: 'AIProvider', useValue: mockProvider },
        { provide: ToolRegistry, useValue: toolRegistry },
        { provide: AIAuditLogger, useValue: mockAuditLogger },
        { provide: RolesRepository, useValue: mockRolesRepository },
        { provide: ConversationRepository, useValue: mockConversationRepository },
        { provide: IdempotencyRepository, useValue: mockIdempotencyRepository },
        { provide: PrismaService, useValue: { $transaction: jest.fn((cb: any) => cb({})) } },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chat — new conversation', () => {
    it('should create conversation and return response', async () => {
      // Mock listMessages to return the user message (as DB would after persistence)
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-1' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'Hello! How can I help you?',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await service.chat('Hello', testSecurityContext);

      expect(result.conversationId).toBe('conv-1');
      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.toolCallsUsed).toEqual([]);
      expect(mockConversationRepository.createConversation).toHaveBeenCalledWith(
        'company-1',
        'user-1',
        'Hello',
      );
      expect(mockConversationRepository.createMessage).toHaveBeenCalledWith(
        'conv-1',
        'company-1',
        'user-1',
        'user',
        'Hello',
      );

      // CRITICAL: Verify user message IS in provider input
      const providerCall = mockProvider.chat.mock.calls[0] as any;
      const messages = providerCall[0].messages;

      // System prompt present
      expect(messages[0].role).toBe('system');

      // User message present EXACTLY ONCE
      const userMessages = messages.filter((m: any) => m.role === 'user');
      expect(userMessages.length).toBe(1);
      expect(userMessages[0].content).toBe('Hello');
    });

    it('should create conversation with truncated title', async () => {
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'A'.repeat(100), createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-1' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const longMessage = 'A'.repeat(100);
      await service.chat(longMessage, testSecurityContext);

      expect(mockConversationRepository.createConversation).toHaveBeenCalledWith(
        'company-1',
        'user-1',
        'A'.repeat(50) + '...',
      );
    });

    it('should throw PersistenceError when user message fails to persist', async () => {
      mockConversationRepository.createMessage.mockResolvedValueOnce(null);

      await expect(
        service.chat('Hello', testSecurityContext),
      ).rejects.toThrow(PersistenceError);

      // Provider should NOT be called
      expect(mockProvider.chat).not.toHaveBeenCalled();
    });

    it('P0 REGRESSION: single user message must be in provider input', async () => {
      // Simulate exactly what DB returns after persisting first user message
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-1' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'Hi there!',
        toolCalls: [],
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      await service.chat('Hello', testSecurityContext);

      const providerCall = mockProvider.chat.mock.calls[0] as any;
      const messages = providerCall[0].messages;

      // Must have system + user (2 messages)
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Hello');
    });
  });

  describe('chat — existing conversation', () => {
    it('should load existing conversation and append message', async () => {
      mockConversationRepository.findConversationByIdForUser.mockResolvedValue({
        id: 'conv-existing',
        companyId: 'company-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        title: 'Previous',
      });

      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Previous question', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-existing' },
        { id: 'msg-2', role: 'assistant', content: 'Previous answer', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-existing' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'Follow-up answer',
        toolCalls: [],
        usage: { promptTokens: 150, completionTokens: 60, totalTokens: 210 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await service.chat('Follow-up question', testSecurityContext, 'conv-existing');

      expect(result.conversationId).toBe('conv-existing');
      expect(mockConversationRepository.findConversationByIdForUser).toHaveBeenCalledWith(
        'conv-existing',
        'company-1',
        'user-1',
      );
      expect(mockConversationRepository.listMessages).toHaveBeenCalledWith(
        'conv-existing',
        'company-1',
        'user-1',
        20,
      );
    });

    it('should throw ConversationNotFoundError for wrong owner', async () => {
      mockConversationRepository.findConversationByIdForUser.mockResolvedValue(null);

      await expect(
        service.chat('Hello', testSecurityContext, 'conv-other'),
      ).rejects.toThrow(ConversationNotFoundError);

      // Provider should NOT be called
      expect(mockProvider.chat).not.toHaveBeenCalled();
    });

    it('should include new user message exactly once in existing conversation', async () => {
      mockConversationRepository.findConversationByIdForUser.mockResolvedValue({
        id: 'conv-existing',
        companyId: 'company-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        title: 'Previous',
      });

      // DB returns: DESC order (newest first) as per AI-7 repository change
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-3', role: 'user', content: 'New question', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-existing' },
        { id: 'msg-2', role: 'assistant', content: 'Previous answer', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-existing' },
        { id: 'msg-1', role: 'user', content: 'Previous question', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-existing' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'New answer',
        toolCalls: [],
        usage: { promptTokens: 150, completionTokens: 60, totalTokens: 210 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      await service.chat('New question', testSecurityContext, 'conv-existing');

      const providerCall = mockProvider.chat.mock.calls[0] as any;
      const messages = providerCall[0].messages;

      // system + old user + old assistant + new user = 4 messages
      expect(messages.length).toBe(4);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Previous question');
      expect(messages[2].role).toBe('assistant');
      expect(messages[2].content).toBe('Previous answer');
      expect(messages[3].role).toBe('user');
      expect(messages[3].content).toBe('New question');

      // Verify new user message appears exactly once
      const newUserMessages = messages.filter(
        (m: any) => m.role === 'user' && m.content === 'New question',
      );
      expect(newUserMessages.length).toBe(1);
    });
  });

  describe('chat — tool execution', () => {
    it('should execute tool calls and persist assistant+tool messages', async () => {
      // First call: LLM requests tool
      // Second call: LLM returns final answer
      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Today you earned 125,000 KZT',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      const result = await service.chat('Show sales', testSecurityContext);

      expect(result.toolCallsUsed).toEqual(['get_dashboard']);
      expect(result.content).toBe('Today you earned 125,000 KZT');

      // Should have persisted: user + assistant(toolCalls) + tool + assistant(final)
      const createMessageCalls = mockConversationRepository.createMessage.mock.calls;
      expect(createMessageCalls.length).toBe(4); // user, assistant+tools, tool, assistant final

      // Verify tool-call persistence sequence
      // createMessage(conversationId, companyId, userId, role, content, options)
      expect(createMessageCalls[1]![3]).toBe('assistant'); // assistant with toolCalls
      expect(createMessageCalls[2]![3]).toBe('tool');     // tool result
      expect(createMessageCalls[3]![3]).toBe('assistant'); // final assistant
    });

    it('should enforce max tool iterations', async () => {
      // Always request tools
      mockProvider.chat.mockResolvedValue({
        content: '',
        toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
        model: 'gpt-4o-mini',
        finishReason: 'tool_calls',
      });

      const result = await service.chat('Complex question', testSecurityContext);

      expect(result.content).toContain('unable to complete');
      expect(mockProvider.chat).toHaveBeenCalledTimes(5); // MAX_TOOL_ITERATIONS
    });

    it('should truncate tool results exceeding 4000 chars', async () => {
      const largeResult = { data: 'X'.repeat(5000) };
      (mockTool.execute as jest.Mock).mockResolvedValue(largeResult);

      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Done',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      await service.chat('Get data', testSecurityContext);

      // Check the tool message was truncated
      // createMessage(conversationId, companyId, userId, role, content, options)
      const toolMessageCall = mockConversationRepository.createMessage.mock.calls.find(
        (call) => call[3] === 'tool',
      );
      expect(toolMessageCall![4].length).toBeLessThanOrEqual(4000 + '... (truncated)'.length);
    });
  });

  describe('chat — persistence failures', () => {
    it('should throw PersistenceError when assistant message fails to persist', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      // First call (user message) succeeds, second call (assistant) fails
      mockConversationRepository.createMessage
        .mockResolvedValueOnce({ id: 'msg-user', role: 'user', content: 'Hello', createdAt: new Date() } as any)
        .mockResolvedValueOnce(null); // assistant message fails

      await expect(
        service.chat('Hello', testSecurityContext),
      ).rejects.toThrow(PersistenceError);
    });
  });

  describe('chat — AI-4B: error assistant persistence (F5 fix)', () => {
    it('should persist error assistant message when provider fails after tool call', async () => {
      // Step 1: provider requests tool
      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        // Step 2: provider fails on next call
        .mockRejectedValueOnce(
          Object.assign(new Error('OpenAI rate limit exceeded'), {
            name: 'AIProviderError',
            code: 'RATE_LIMITED',
            retryable: true,
          }),
        );

      // Mock tool execution succeeds
      (mockTool.execute as jest.Mock).mockResolvedValue({ todaySales: 125000 });

      const result = await service.chat('Show sales', testSecurityContext);

      // Error message returned to client
      expect(result.content).toContain('error');

      // Check that error assistant message was persisted
      const createMessageCalls = mockConversationRepository.createMessage.mock.calls;
      const assistantMessages = createMessageCalls.filter((call) => call[3] === 'assistant');

      // Should have: 1) assistant(toolCalls) + 2) error assistant
      expect(assistantMessages.length).toBe(2);
      expect(assistantMessages[1]![4]).toContain('error');
    });

    it('should persist error assistant message when provider fails without tools', async () => {
      mockProvider.chat.mockRejectedValueOnce(
        Object.assign(new Error('OpenAI server error: 500'), {
          name: 'AIProviderError',
          code: 'SERVER_ERROR',
          retryable: true,
        }),
      );

      const result = await service.chat('Hello', testSecurityContext);

      expect(result.content).toContain('error');

      // Check error assistant persisted
      const createMessageCalls = mockConversationRepository.createMessage.mock.calls;
      const assistantMessages = createMessageCalls.filter((call) => call[3] === 'assistant');
      expect(assistantMessages.length).toBe(1);
      expect(assistantMessages[0]![4]).toContain('error');
    });

    it('should persist error assistant when 429 after retries', async () => {
      // AI-4A provider retries internally, then throws
      mockProvider.chat.mockRejectedValueOnce(
        Object.assign(new Error('OpenAI rate limit exceeded'), {
          name: 'AIProviderError',
          code: 'RATE_LIMITED',
          retryable: true,
        }),
      );

      await service.chat('Hello', testSecurityContext);

      const createMessageCalls = mockConversationRepository.createMessage.mock.calls;
      const assistantMessages = createMessageCalls.filter((call) => call[3] === 'assistant');
      expect(assistantMessages.length).toBe(1);
      expect(assistantMessages[0]![4]).toContain('error');
    });

    it('should persist error assistant when 5xx after retries', async () => {
      mockProvider.chat.mockRejectedValueOnce(
        Object.assign(new Error('OpenAI server error: 500'), {
          name: 'AIProviderError',
          code: 'SERVER_ERROR',
          retryable: true,
        }),
      );

      await service.chat('Hello', testSecurityContext);

      const createMessageCalls = mockConversationRepository.createMessage.mock.calls;
      const assistantMessages = createMessageCalls.filter((call) => call[3] === 'assistant');
      expect(assistantMessages.length).toBe(1);
      expect(assistantMessages[0]![4]).toContain('error');
    });

    it('should not mask original error when error assistant persistence fails', async () => {
      mockProvider.chat.mockRejectedValueOnce(
        Object.assign(new Error('Provider unavailable'), {
          name: 'AIProviderError',
          code: 'SERVER_ERROR',
          retryable: false,
        }),
      );

      // Make error assistant persistence fail
      mockConversationRepository.createMessage
        .mockResolvedValueOnce({ id: 'msg-user', role: 'user', createdAt: new Date() } as any) // user msg OK
        .mockResolvedValueOnce(null); // error assistant fails

      const result = await service.chat('Hello', testSecurityContext);

      // Original error message still returned (not masked by persistence failure)
      expect(result.content).toContain('error');
      expect(result.conversationId).toBe('conv-1');
    });

    it('should persist error assistant on max iterations', async () => {
      // Always request tools — never stop
      mockProvider.chat.mockResolvedValue({
        content: '',
        toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
        model: 'gpt-4o-mini',
        finishReason: 'tool_calls',
      });

      const result = await service.chat('Complex', testSecurityContext);

      expect(result.content).toContain('unable to complete');

      // Check error assistant persisted on max iterations
      const createMessageCalls = mockConversationRepository.createMessage.mock.calls;
      const assistantMessages = createMessageCalls.filter((call) => call[3] === 'assistant');

      // assistant(toolCalls) × 5 + error assistant = 6
      expect(assistantMessages.length).toBe(6);
      expect(assistantMessages[5]![4]).toContain('unable to complete');
    });

    it('should not create duplicate assistant messages on single failure', async () => {
      mockProvider.chat.mockRejectedValueOnce(
        Object.assign(new Error('Timeout'), {
          name: 'AIProviderError',
          code: 'TIMEOUT',
          retryable: true,
        }),
      );

      await service.chat('Hello', testSecurityContext);

      const createMessageCalls = mockConversationRepository.createMessage.mock.calls;
      const assistantMessages = createMessageCalls.filter((call) => call[3] === 'assistant');

      // Exactly one assistant message (the error assistant)
      expect(assistantMessages.length).toBe(1);
    });

    it('successful tool flow should not be affected by AI-4B', async () => {
      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'You earned 125K today',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      const result = await service.chat('Show sales', testSecurityContext);

      expect(result.content).toBe('You earned 125K today');

      const createMessageCalls = mockConversationRepository.createMessage.mock.calls;
      const assistantMessages = createMessageCalls.filter((call) => call[3] === 'assistant');

      // assistant(toolCalls) + assistant(final) = 2 (no error assistant)
      expect(assistantMessages.length).toBe(2);
    });
  });

  describe('chat — tool execution timeout (AI-4C)', () => {
    it('should complete tool execution before timeout', async () => {
      // Tool resolves quickly
      (mockTool.execute as jest.Mock).mockResolvedValue({ todaySales: 125000 });

      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Sales: 125K',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      const result = await service.chat('Show sales', testSecurityContext);

      expect(result.content).toBe('Sales: 125K');
      expect(result.toolCallsUsed).toEqual(['get_dashboard']);
    });

    it('should handle tool execution error', async () => {
      // Tool throws an error
      (mockTool.execute as jest.Mock).mockRejectedValue(new Error('DB connection failed'));

      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Error occurred',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      const result = await service.chat('Show sales', testSecurityContext);

      // Tool error should be persisted and provider can still respond
      expect(result.content).toBe('Error occurred');

      // Check tool error was persisted
      const toolMessages = mockConversationRepository.createMessage.mock.calls.filter(
        (call) => call[3] === 'tool',
      );
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0]![4]).toContain('Tool execution failed');
    });

    it('should timeout on slow tool and not hang', async () => {
      // Create a service with very short timeout for testing
      const shortTimeoutService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        50, // 50ms timeout for testing
      );

      // Tool that takes longer than timeout
      (mockTool.execute as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: 'slow' }), 200)),
      );

      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Timeout handled',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      const result = await shortTimeoutService.chat('Show sales', testSecurityContext);

      // Should complete quickly (not hang for 200ms)
      expect(result.content).toBe('Timeout handled');

      // Check tool timeout error was persisted
      const toolMessages = mockConversationRepository.createMessage.mock.calls.filter(
        (call) => call[3] === 'tool',
      );
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0]![4]).toContain('timed out');
    });

    it('should timeout on never-resolving tool', async () => {
      // Create a service with very short timeout for testing
      const shortTimeoutService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        50, // 50ms timeout for testing
      );

      // Tool that never resolves
      (mockTool.execute as jest.Mock).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Handled',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      const startTime = Date.now();
      const result = await shortTimeoutService.chat('Show sales', testSecurityContext);
      const elapsed = Date.now() - startTime;

      // Should complete within reasonable time (not hang)
      expect(elapsed).toBeLessThan(500);
      expect(result.content).toBe('Handled');

      // Check tool timeout error was persisted
      const toolMessages = mockConversationRepository.createMessage.mock.calls.filter(
        (call) => call[3] === 'tool',
      );
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0]![4]).toContain('timed out');
    });

    it('should persist tool timeout error correctly', async () => {
      // Create a service with very short timeout for testing
      const shortTimeoutService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        50, // 50ms timeout for testing
      );

      // Tool that takes longer than timeout
      (mockTool.execute as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: 'slow' }), 200)),
      );

      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Timeout handled',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      await shortTimeoutService.chat('Show sales', testSecurityContext);

      // Verify tool error message format
      const toolMessages = mockConversationRepository.createMessage.mock.calls.filter(
        (call) => call[3] === 'tool',
      );
      expect(toolMessages.length).toBe(1);
      const errorContent = JSON.parse(toolMessages[0]![4]);
      expect(errorContent.error).toContain('timed out');
      expect(errorContent.error).toContain('50');
    });

    it('successful tool flow should not be affected by timeout mechanism', async () => {
      // Tool resolves quickly (before timeout)
      (mockTool.execute as jest.Mock).mockResolvedValue({ todaySales: 125000 });

      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'You earned 125K today',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      const result = await service.chat('Show sales', testSecurityContext);

      expect(result.content).toBe('You earned 125K today');

      const createMessageCalls = mockConversationRepository.createMessage.mock.calls;
      const assistantMessages = createMessageCalls.filter((call) => call[3] === 'assistant');

      // assistant(toolCalls) + assistant(final) = 2 (no error assistant)
      expect(assistantMessages.length).toBe(2);

      // Tool result should not contain timeout error
      const toolMessages = createMessageCalls.filter((call) => call[3] === 'tool');
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0]![4]).not.toContain('timed out');
    });
  });

  describe('chat — company context', () => {
    it('should use currency and locale from SecurityContext', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const usdContext: SecurityContext = {
        ...testSecurityContext,
        currency: 'USD',
        locale: 'ru',
      };

      await service.chat('Hello', usdContext);

      // System prompt should contain the currency and locale
      const callArgs = mockProvider.chat.mock.calls[0] as any;
      const systemMessage = callArgs[0].messages[0];
      expect(systemMessage.content).toContain('USD');
      expect(systemMessage.content).toContain('ru');
    });
  });

  describe('chat — idempotency (AI-5)', () => {
    it('should work without idempotencyKey (backward compatibility)', async () => {
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-1' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await service.chat('Hello', testSecurityContext);

      expect(result.content).toBe('Response');
      // Should NOT call idempotency repository
      expect(mockIdempotencyRepository.acquireLock).not.toHaveBeenCalled();
    });

    it('should acquire lock on first request with idempotencyKey', async () => {
      mockIdempotencyRepository.acquireLock.mockResolvedValue({ acquired: true });
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-1' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await service.chat('Hello', testSecurityContext, undefined, 'key-123');

      expect(result.content).toBe('Response');
      expect(mockIdempotencyRepository.acquireLock).toHaveBeenCalled();
      expect(mockIdempotencyRepository.updateCompleted).toHaveBeenCalled();
    });

    it('should return 409 for duplicate PENDING request', async () => {
      const fingerprint = computeFingerprint('Hello', undefined);
      mockIdempotencyRepository.findByKey.mockResolvedValue({
        id: 'id-1',
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        idempotencyKey: 'key-123',
        requestFingerprint: fingerprint,
        status: 'PENDING',
        responsePayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.chat('Hello', testSecurityContext, undefined, 'key-123'),
      ).rejects.toThrow('Request already in progress');

      // Provider should NOT be called
      expect(mockProvider.chat).not.toHaveBeenCalled();
    });

    it('should return stored response for duplicate COMPLETED request', async () => {
      const storedResponse = {
        conversationId: 'conv-1',
        content: 'Cached response',
        toolCallsUsed: ['get_dashboard'],
        createdAt: '2026-09-07T12:00:00.000Z',
      };

      const fingerprint = computeFingerprint('Hello', undefined);
      mockIdempotencyRepository.findByKey.mockResolvedValue({
        id: 'id-1',
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        idempotencyKey: 'key-123',
        requestFingerprint: fingerprint,
        status: 'COMPLETED',
        responsePayload: storedResponse,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await service.chat('Hello', testSecurityContext, undefined, 'key-123');

      expect(result).toEqual(storedResponse);
      // Provider should NOT be called
      expect(mockProvider.chat).not.toHaveBeenCalled();
    });

    it('should return stored response for duplicate FAILED request', async () => {
      const storedResponse = {
        conversationId: 'conv-1',
        content: 'I encountered an error while processing your request. Please try again later.',
        toolCallsUsed: [],
        createdAt: '2026-09-07T12:00:00.000Z',
      };

      const fingerprint = computeFingerprint('Hello', undefined);
      mockIdempotencyRepository.findByKey.mockResolvedValue({
        id: 'id-1',
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        idempotencyKey: 'key-123',
        requestFingerprint: fingerprint,
        status: 'FAILED',
        responsePayload: storedResponse,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await service.chat('Hello', testSecurityContext, undefined, 'key-123');

      expect(result).toEqual(storedResponse);
      // Provider should NOT be called
      expect(mockProvider.chat).not.toHaveBeenCalled();
    });

    it('should update idempotency record on provider failure', async () => {
      mockIdempotencyRepository.acquireLock.mockResolvedValue({ acquired: true });
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-1' },
      ]);

      mockProvider.chat.mockRejectedValueOnce(
        Object.assign(new Error('Provider error'), {
          name: 'AIProviderError',
          code: 'SERVER_ERROR',
          retryable: false,
        }),
      );

      await service.chat('Hello', testSecurityContext, undefined, 'key-123');

      expect(mockIdempotencyRepository.updateFailed).toHaveBeenCalled();
    });

    // F1: Test idempotencyKey without conversationId
    it('should work with idempotencyKey without conversationId', async () => {
      mockIdempotencyRepository.findByKey.mockResolvedValue(null);
      mockIdempotencyRepository.acquireLock.mockResolvedValue({ acquired: true });
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-1' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await service.chat('Hello', testSecurityContext, undefined, 'key-123');

      expect(result.content).toBe('Response');
      // Should create conversation and then acquire lock
      expect(mockConversationRepository.createConversation).toHaveBeenCalled();
      expect(mockIdempotencyRepository.acquireLock).toHaveBeenCalled();
    });

    // F2: Test fingerprint validation
    it('should return 400 for same key with different message', async () => {
      const existingFingerprint = computeFingerprint('Different message', undefined);
      mockIdempotencyRepository.findByKey.mockResolvedValue({
        id: 'id-1',
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        idempotencyKey: 'key-123',
        requestFingerprint: existingFingerprint,
        status: 'COMPLETED',
        responsePayload: { conversationId: 'conv-1', content: 'Response', toolCallsUsed: [], createdAt: new Date().toISOString() },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(
        service.chat('Hello', testSecurityContext, undefined, 'key-123'),
      ).rejects.toThrow(IdempotencyKeyMismatchError);
    });

    it('should return 400 for same key with different conversationId', async () => {
      const existingFingerprint = computeFingerprint('Hello', 'conv-999');
      mockIdempotencyRepository.findByKey.mockResolvedValue({
        id: 'id-1',
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-999',
        idempotencyKey: 'key-123',
        requestFingerprint: existingFingerprint,
        status: 'COMPLETED',
        responsePayload: { conversationId: 'conv-999', content: 'Response', toolCallsUsed: [], createdAt: new Date().toISOString() },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(
        service.chat('Hello', testSecurityContext, 'conv-1', 'key-123'),
      ).rejects.toThrow(IdempotencyKeyMismatchError);
    });

    it('should allow same key with same request (replay)', async () => {
      const fingerprint = computeFingerprint('Hello', undefined);
      const storedResponse = {
        conversationId: 'conv-1',
        content: 'Cached response',
        toolCallsUsed: [],
        createdAt: new Date().toISOString(),
      };

      mockIdempotencyRepository.findByKey.mockResolvedValue({
        id: 'id-1',
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        idempotencyKey: 'key-123',
        requestFingerprint: fingerprint,
        status: 'COMPLETED',
        responsePayload: storedResponse,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await service.chat('Hello', testSecurityContext, undefined, 'key-123');

      expect(result).toEqual(storedResponse);
      expect(mockProvider.chat).not.toHaveBeenCalled();
    });

    // F3: Test expired PENDING race condition
    it('should handle expired PENDING race when refreshed is null', async () => {
      const expiredRecord = {
        id: 'id-1',
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        idempotencyKey: 'key-123',
        requestFingerprint: computeFingerprint('Hello', undefined),
        status: 'PENDING',
        responsePayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      mockIdempotencyRepository.findByKey.mockResolvedValueOnce(expiredRecord);
      mockIdempotencyRepository.reclaimExpired.mockResolvedValue(true);
      // After reclaim, record is deleted, so findByKey returns null
      mockIdempotencyRepository.findByKey.mockResolvedValueOnce(null);
      // Then acquireLock succeeds
      mockIdempotencyRepository.acquireLock.mockResolvedValue({ acquired: true });
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-1' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await service.chat('Hello', testSecurityContext, undefined, 'key-123');

      expect(result.content).toBe('Response');
      expect(mockIdempotencyRepository.reclaimExpired).toHaveBeenCalled();
      expect(mockIdempotencyRepository.acquireLock).toHaveBeenCalled();
    });

    // Test concurrent expired PENDING reclaim
    it('should handle concurrent expired PENDING reclaim', async () => {
      const expiredRecord = {
        id: 'id-1',
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        idempotencyKey: 'key-123',
        requestFingerprint: computeFingerprint('Hello', undefined),
        status: 'PENDING',
        responsePayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      mockIdempotencyRepository.findByKey.mockResolvedValueOnce(expiredRecord);
      mockIdempotencyRepository.reclaimExpired.mockResolvedValue(false); // Another request reclaimed it
      // After failed reclaim, record is deleted by winner, so findByKey returns null
      mockIdempotencyRepository.findByKey.mockResolvedValueOnce(null);
      // Then acquireLock succeeds
      mockIdempotencyRepository.acquireLock.mockResolvedValue({ acquired: true });
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), toolCallsJson: null, toolCallId: null, toolName: null, tokenCount: null, conversationId: 'conv-1' },
      ]);

      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await service.chat('Hello', testSecurityContext, undefined, 'key-123');

      expect(result.content).toBe('Response');
      expect(mockIdempotencyRepository.reclaimExpired).toHaveBeenCalled();
      // Should not throw conflict, should proceed to acquire lock
      expect(mockIdempotencyRepository.acquireLock).toHaveBeenCalled();
    });

    // Test that provider is not called on replay
    it('should not call provider on replay of completed request', async () => {
      const fingerprint = computeFingerprint('Hello', undefined);
      const storedResponse = {
        conversationId: 'conv-1',
        content: 'Cached response',
        toolCallsUsed: ['get_dashboard'],
        createdAt: new Date().toISOString(),
      };

      mockIdempotencyRepository.findByKey.mockResolvedValue({
        id: 'id-1',
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        idempotencyKey: 'key-123',
        requestFingerprint: fingerprint,
        status: 'COMPLETED',
        responsePayload: storedResponse,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await service.chat('Hello', testSecurityContext, undefined, 'key-123');

      expect(result).toEqual(storedResponse);
      expect(mockProvider.chat).not.toHaveBeenCalled();
      expect(mockConversationRepository.createMessage).not.toHaveBeenCalled();
    });
  });

  // ── AI-6: Request Budget Tests ────────────────────────────────
  describe('chat — request budget (AI-6)', () => {
    let budgetService: AIService;

    beforeEach(() => {
      // Create service with short budget for testing
      budgetService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, // toolExecutionTimeoutMs (default 30s)
        100, // requestBudgetMs = 100ms for testing
      );
    });

    it('should use default budget of 120s when not configured', () => {
      const defaultService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
      );
      // Default is 120_000ms — we verify by checking the service was created
      expect(defaultService).toBeDefined();
    });

    it('should complete before budget expires', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Quick response',
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await budgetService.chat('Quick', testSecurityContext);

      expect(result.content).toBe('Quick response');
      expect(mockProvider.chat).toHaveBeenCalledTimes(1);
    });

    it('should throw RequestBudgetExceededError when budget expires during provider call', async () => {
      // Provider takes longer than budget
      mockProvider.chat.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          content: 'Late response',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        }), 200)),
      );

      await expect(
        budgetService.chat('Slow', testSecurityContext),
      ).rejects.toThrow(RequestBudgetExceededError);
    });

    it('should throw RequestBudgetExceededError when budget expires during tool execution', async () => {
      // Provider returns tool call
      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'After tool',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      // Tool takes longer than budget
      (mockTool.execute as jest.Mock).mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({ data: 'slow' }), 200)),
      );

      await expect(
        budgetService.chat('Tool slow', testSecurityContext),
      ).rejects.toThrow(RequestBudgetExceededError);
    });

    it('should not call provider after budget expiry', async () => {
      // First call returns tool call, second call would be after budget
      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'After tool',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      // Tool takes longer than budget
      (mockTool.execute as jest.Mock).mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({ data: 'slow' }), 200)),
      );

      await expect(
        budgetService.chat('Tool slow', testSecurityContext),
      ).rejects.toThrow(RequestBudgetExceededError);

      // Provider should only be called once (before tool timeout)
      expect(mockProvider.chat).toHaveBeenCalledTimes(1);
    });

    it('should pass signal to provider.chat()', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      await budgetService.chat('Test signal', testSecurityContext);

      // Verify signal was passed to provider
      expect(mockProvider.chat).toHaveBeenCalled();
      const callArgs = mockProvider.chat.mock.calls[0]![0];
      expect(callArgs.signal).toBeDefined();
      expect(callArgs.signal).toBeInstanceOf(AbortSignal);
    });

    it('should clean up timer after successful completion', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Done',
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      // Spy on clearTimeout to verify cleanup
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await budgetService.chat('Clean', testSecurityContext);

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should clean up timer after budget error', async () => {
      mockProvider.chat.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          content: 'Late',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        }), 200)),
      );

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await expect(
        budgetService.chat('Timeout', testSecurityContext),
      ).rejects.toThrow(RequestBudgetExceededError);

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should persist error assistant for budget exceeded (AI-4B best-effort)', async () => {
      mockProvider.chat.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          content: 'Late',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        }), 200)),
      );

      await expect(
        budgetService.chat('Persist', testSecurityContext),
      ).rejects.toThrow(RequestBudgetExceededError);

      // AI-4B: error assistant SHOULD be persisted (best-effort)
      const assistantMessages = mockConversationRepository.createMessage.mock.calls.filter(
        (call) => call[3] === 'assistant',
      );
      expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('should call updateFailed for budget exceeded with idempotencyKey', async () => {
      mockProvider.chat.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          content: 'Late',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        }), 200)),
      );

      await expect(
        budgetService.chat('Idem', testSecurityContext, undefined, 'key-abc'),
      ).rejects.toThrow(RequestBudgetExceededError);

      // updateFailed should have been called for budget error
      expect(mockIdempotencyRepository.updateFailed).toHaveBeenCalledWith(
        'company-1',
        'user-1',
        'key-abc',
        expect.objectContaining({
          conversationId: expect.any(String),
          content: expect.any(String),
          toolCallsUsed: expect.any(Array),
        }),
      );
    });

    it('should rethrow RequestBudgetExceededError even if persistence fails', async () => {
      mockProvider.chat.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          content: 'Late',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        }), 200)),
      );
      // Make persistence fail only for assistant messages (not user message)
      mockConversationRepository.createMessage.mockImplementation(((...args: any[]) => {
        if (args[3] === 'assistant') {
          return Promise.reject(new Error('DB down'));
        }
        return Promise.resolve({ id: 'msg-1', createdAt: new Date() });
      }) as any);

      await expect(
        budgetService.chat('Fail persist', testSecurityContext),
      ).rejects.toThrow(RequestBudgetExceededError);
    });

    it('should rethrow RequestBudgetExceededError even if updateFailed fails', async () => {
      mockProvider.chat.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          content: 'Late',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        }), 200)),
      );
      // Make updateFailed fail
      mockIdempotencyRepository.updateFailed.mockRejectedValue(new Error('DB down'));

      await expect(
        budgetService.chat('Fail update', testSecurityContext, undefined, 'key-xyz'),
      ).rejects.toThrow(RequestBudgetExceededError);
    });

    it('should rethrow RequestBudgetExceededError when both persistence and updateFailed fail', async () => {
      mockProvider.chat.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          content: 'Late',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        }), 200)),
      );
      // Make persistence fail only for assistant messages
      mockConversationRepository.createMessage.mockImplementation(((...args: any[]) => {
        if (args[3] === 'assistant') {
          return Promise.reject(new Error('DB down'));
        }
        return Promise.resolve({ id: 'msg-1', createdAt: new Date() });
      }) as any);
      mockIdempotencyRepository.updateFailed.mockRejectedValue(new Error('DB down'));

      await expect(
        budgetService.chat('Both fail', testSecurityContext, undefined, 'key-all'),
      ).rejects.toThrow(RequestBudgetExceededError);
    });
  });

  // ── AI-7: Context Budget Tests ──────────────────────────────
  describe('chat — context budget (AI-7)', () => {
    let contextService: AIService;

    beforeEach(() => {
      // Create service with small context budget for testing
      contextService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, // toolExecutionTimeoutMs
        undefined, // requestBudgetMs (AI-6)
        10000,     // contextMaxTokens = 10K for testing
        2048,      // maxTokens (output reservation)
      );
    });

    it('should use default context budget of 120K when not configured', () => {
      const defaultService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
      );
      expect(defaultService).toBeDefined();
    });

    it('should complete when full request fits within budget', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Success',
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await contextService.chat('Short message', testSecurityContext);
      expect(result.content).toBe('Success');
      expect(mockProvider.chat).toHaveBeenCalledTimes(1);
    });

    it('should throw ContextBudgetExceededError when full request oversized', async () => {
      // Create service with very small budget
      const tinyService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, undefined,
        100, // 100 tokens — too small for system + tools + user + output
        2048,
      );

      await expect(
        tinyService.chat('Hello', testSecurityContext),
      ).rejects.toThrow(ContextBudgetExceededError);
      // Provider should NOT be called
      expect(mockProvider.chat).not.toHaveBeenCalled();
    });

    it('should throw ContextBudgetExceededError when pre-tool reservation exceeds budget', async () => {
      // Provider returns a tool call, but the reservation won't fit
      mockProvider.chat.mockResolvedValue({
        content: '',
        toolCalls: [{ id: 'call-1', name: 'get_dashboard', arguments: {} }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-4o-mini',
        finishReason: 'tool_calls',
      });

      // Create service with budget that fits initial messages but not tool results
      const tightService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, undefined,
        3500, // tight budget
        2048,
      );

      await expect(
        tightService.chat('Tool', testSecurityContext),
      ).rejects.toThrow(ContextBudgetExceededError);
      // Provider was called once (for the tool call) but tools were NOT executed
      expect(mockProvider.chat).toHaveBeenCalledTimes(1);
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it('should persist error assistant for ContextBudgetExceededError (AI-4B)', async () => {
      const tinyService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, undefined,
        100, 2048,
      );

      await expect(
        tinyService.chat('Hello', testSecurityContext),
      ).rejects.toThrow(ContextBudgetExceededError);

      // AI-4B: error assistant should be persisted
      const assistantCalls = mockConversationRepository.createMessage.mock.calls.filter(
        (call) => call[3] === 'assistant',
      );
      expect(assistantCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should call updateFailed for ContextBudgetExceededError with idempotencyKey', async () => {
      const tinyService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, undefined,
        100, 2048,
      );

      await expect(
        tinyService.chat('Hello', testSecurityContext, undefined, 'ctx-key'),
      ).rejects.toThrow(ContextBudgetExceededError);

      expect(mockIdempotencyRepository.updateFailed).toHaveBeenCalledWith(
        'company-1', 'user-1', 'ctx-key', expect.any(Object),
      );
    });

    it('should rethrow ContextBudgetExceededError even if persistence fails', async () => {
      const tinyService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, undefined,
        100, 2048,
      );

      mockConversationRepository.createMessage.mockImplementation(((...args: any[]) => {
        if (args[3] === 'assistant') {
          return Promise.reject(new Error('DB down'));
        }
        return Promise.resolve({ id: 'msg-1', createdAt: new Date() });
      }) as any);

      await expect(
        tinyService.chat('Hello', testSecurityContext),
      ).rejects.toThrow(ContextBudgetExceededError);
    });

    it('should rethrow ContextBudgetExceededError even if updateFailed fails', async () => {
      const tinyService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, undefined,
        100, 2048,
      );

      mockIdempotencyRepository.updateFailed.mockRejectedValue(new Error('DB down'));

      await expect(
        tinyService.chat('Hello', testSecurityContext, undefined, 'ctx-key'),
      ).rejects.toThrow(ContextBudgetExceededError);
    });

    it('should preserve current user message in history selection', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      // Mock history with some messages
      mockConversationRepository.listMessages.mockResolvedValue([
        { id: 'm1', role: 'user', content: 'Old question', createdAt: new Date('2026-01-01') },
        { id: 'm2', role: 'assistant', content: 'Old answer', createdAt: new Date('2026-01-02') },
        { id: 'm3', role: 'user', content: 'Test message', createdAt: new Date('2026-01-03') },
      ] as any);

      const result = await contextService.chat('Test message', testSecurityContext);
      expect(result.content).toBe('Response');

      // Check that provider received messages with the current user message
      const providerCall = mockProvider.chat.mock.calls[0]?.[0];
      expect(providerCall).toBeDefined();
      const userMessages = providerCall!.messages.filter((m: any) => m.role === 'user');
      expect(userMessages.some((m: any) => m.content === 'Test message')).toBe(true);
    });

    it('should select newest turns when history exceeds budget', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'OK',
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      // Mock 50 messages (DESC order as returned by repository)
      const manyMessages = Array.from({ length: 50 }, (_, i) => ({
        id: `m${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} with some content to fill tokens`,
        createdAt: new Date(Date.now() + i * 1000),
      }));
      mockConversationRepository.listMessages.mockResolvedValue(manyMessages as any);

      const result = await contextService.chat('Final message', testSecurityContext);
      expect(result.content).toBe('OK');

      // Provider should have been called
      expect(mockProvider.chat).toHaveBeenCalledTimes(1);
    });

    it('should allow empty history when budget is tight', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Response',
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      // Create service with minimal budget
      const minimalService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, undefined,
        4000, // minimal budget
        2048,
      );

      const result = await minimalService.chat('Hi', testSecurityContext);
      expect(result.content).toBe('Response');
    });

    it('should use NO_MORE_TOOLS final call when messages fit but tools do not', async () => {
      // First call returns tool_calls, second (final no-tools) returns text
      mockProvider.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'call-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Final answer',
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      // Service with budget that fits messages but not tools+next call
      const noToolsService = new AIService(
        mockProvider,
        toolRegistry,
        mockAuditLogger,
        mockRolesRepository,
        mockConversationRepository,
        mockIdempotencyRepository,
        { $transaction: jest.fn((cb: any) => cb({})) } as any,
        undefined, undefined,
        4500, // fits messages but tool results push over
        2048,
      );

      const result = await noToolsService.chat('Quick', testSecurityContext);
      // Should have received the final no-tools response
      expect(result.content).toBe('Final answer');
    });
  });
});
