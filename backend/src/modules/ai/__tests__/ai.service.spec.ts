import { Test, TestingModule } from '@nestjs/testing';
import { AIService } from '../ai.service';
import { AIProvider, AIRequest, AIResponse } from '../providers/ai-provider.interface';
import { ToolRegistry } from '../tools/tool.registry';
import { AIAuditLogger } from '../logging/ai-audit.logger';
import { RolesRepository } from '../../rbac/repositories/roles.repository';
import { AITool } from '../tools/tool.interface';
import { SecurityContext } from '../security/security-context';

describe('AIService', () => {
  let service: AIService;
  let mockProvider: jest.Mocked<AIProvider>;
  let toolRegistry: ToolRegistry;
  let mockAuditLogger: jest.Mocked<AIAuditLogger>;
  let mockRolesRepository: jest.Mocked<RolesRepository>;

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

    toolRegistry = new ToolRegistry();
    toolRegistry.register(mockTool);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: 'AIProvider', useValue: mockProvider },
        { provide: ToolRegistry, useValue: toolRegistry },
        { provide: AIAuditLogger, useValue: mockAuditLogger },
        { provide: RolesRepository, useValue: mockRolesRepository },
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

  describe('chat', () => {
    it('should return final response when LLM does not call tools', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Hello! How can I help you?',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      const result = await service.chat('Hello', testSecurityContext);

      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.toolCallsUsed).toEqual([]);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          toolCalls: [],
        }),
      );
    });

    it('should execute tool calls and return final response', async () => {
      // First call: LLM requests tool
      // Second call: LLM returns final answer
      mockProvider.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [{ id: 'call-1', name: 'get_dashboard', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Today you earned 125,000 KZT from 25 sales.',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      const result = await service.chat('Show dashboard', testSecurityContext);

      expect(result.content).toBe('Today you earned 125,000 KZT from 25 sales.');
      expect(result.toolCallsUsed).toEqual(['get_dashboard']);
      expect(mockTool.execute).toHaveBeenCalledWith({}, testSecurityContext);
    });

    it('should reject unknown tool names', async () => {
      mockProvider.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [{ id: 'call-1', name: 'unknown_tool', arguments: {} }],
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'The tool is not available.',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      const result = await service.chat('Do something', testSecurityContext);

      expect(result.toolCallsUsed).toEqual([]);
      // LLM should get an error response for the unknown tool
    });

    it('should enforce max tool iterations', async () => {
      // Keep requesting tools forever
      mockProvider.chat.mockResolvedValue({
        content: null,
        toolCalls: [{ id: 'call-1', name: 'get_dashboard', arguments: {} }],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'tool_calls',
      });

      const result = await service.chat('Infinite loop', testSecurityContext);

      // Should stop after 5 iterations
      expect(mockProvider.chat).toHaveBeenCalledTimes(5);
      expect(result.content).toContain('unable to complete');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'MAX_ITERATIONS',
          success: false,
        }),
      );
    });

    it('should handle provider errors gracefully', async () => {
      mockProvider.chat.mockRejectedValue(
        new (await import('../providers/ai-provider.interface')).AIProviderError(
          'openai',
          'TIMEOUT',
          'Request timed out',
          true,
        ),
      );

      const result = await service.chat('Test', testSecurityContext);

      expect(result.content).toContain('error');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: 'TIMEOUT',
        }),
      );
    });

    it('should use companyId from SecurityContext, not from tool input', async () => {
      mockProvider.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'call-1',
              name: 'get_dashboard',
              arguments: { companyId: 'hacker-company' }, // LLM tries to override
            },
          ],
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'gpt-4o-mini',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Done',
          toolCalls: [],
          usage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
          model: 'gpt-4o-mini',
          finishReason: 'stop',
        });

      await service.chat('Test', testSecurityContext);

      // Tool should receive SecurityContext companyId, not the one from arguments
      expect(mockTool.execute).toHaveBeenCalledWith(
        { companyId: 'hacker-company' }, // arguments are passed as-is
        expect.objectContaining({ companyId: 'company-1' }), // but SecurityContext is separate
      );
    });

    it('should resolve permissions from roles', async () => {
      mockProvider.chat.mockResolvedValue({
        content: 'Done',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      await service.chat('Test', testSecurityContext);

      expect(mockRolesRepository.findPermissionCodesByRoleNames).toHaveBeenCalledWith(
        ['Admin'],
        'company-1',
      );
    });

    it('should not expose tools user lacks permission for', async () => {
      const restrictedTool: AITool = {
        name: 'admin_only',
        description: 'Admin tool',
        inputSchema: { type: 'object', properties: {} },
        requiredPermission: 'admin:billing',
        execute: jest.fn(),
      };
      toolRegistry.register(restrictedTool);

      // User only has reports:read, not admin:billing
      mockRolesRepository.findPermissionCodesByRoleNames.mockResolvedValue(['reports:read']);

      mockProvider.chat.mockResolvedValue({
        content: 'Done',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o-mini',
        finishReason: 'stop',
      });

      await service.chat('Test', testSecurityContext);

      // Provider should only receive get_dashboard in tools, not admin_only
      const callArgs = mockProvider.chat.mock.calls[0]![0]! as AIRequest;
      const toolNames = callArgs.tools.map((t) => t.name);
      expect(toolNames).toContain('get_dashboard');
      expect(toolNames).not.toContain('admin_only');
    });
  });
});
