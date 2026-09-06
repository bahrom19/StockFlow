import { ToolRegistry } from '../tools/tool.registry';
import { AITool } from '../tools/tool.interface';
import { SecurityContext } from '../security/security-context';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const mockTool: AITool = {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: { type: 'object', properties: {} },
    requiredPermission: 'reports:read',
    execute: jest.fn().mockResolvedValue({ result: 'ok' }),
  };

  const mockRestrictedTool: AITool = {
    name: 'admin_tool',
    description: 'An admin tool',
    inputSchema: { type: 'object', properties: {} },
    requiredPermission: 'admin:billing',
    execute: jest.fn().mockResolvedValue({ result: 'admin' }),
  };

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register tools', () => {
    registry.register(mockTool);
    expect(registry.count).toBe(1);
    expect(registry.get('test_tool')).toBe(mockTool);
  });

  it('should return undefined for unknown tool', () => {
    expect(registry.get('unknown_tool')).toBeUndefined();
  });

  it('should return all tool names', () => {
    registry.register(mockTool);
    registry.register(mockRestrictedTool);
    expect(registry.getAllNames()).toEqual(['test_tool', 'admin_tool']);
  });

  describe('getAvailable', () => {
    beforeEach(() => {
      registry.register(mockTool);
      registry.register(mockRestrictedTool);
    });

    it('should return tools matching user permissions', () => {
      const available = registry.getAvailable(['reports:read']);
      expect(available).toHaveLength(1);
      expect(available[0]!.name).toBe('test_tool');
    });

    it('should return multiple tools when user has multiple permissions', () => {
      const available = registry.getAvailable(['reports:read', 'admin:billing']);
      expect(available).toHaveLength(2);
    });

    it('should return empty array when user has no matching permissions', () => {
      const available = registry.getAvailable(['products:read']);
      expect(available).toHaveLength(0);
    });

    it('should return empty array for empty permissions', () => {
      const available = registry.getAvailable([]);
      expect(available).toHaveLength(0);
    });
  });

  describe('security', () => {
    it('should not allow LLM to register tools', () => {
      // ToolRegistry.register is only called by AIModule, not by LLM
      registry.register(mockTool);
      expect(registry.get('test_tool')).toBe(mockTool);
      // LLM cannot call register directly
    });

    it('should reject unknown tool names on get', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });
});
