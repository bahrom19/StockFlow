import { Injectable, Logger } from '@nestjs/common';
import { AITool } from './tool.interface';

/**
 * ToolRegistry — manages registered AI tools.
 *
 * Security guarantees:
 * - Only explicitly registered tools are available
 * - LLM cannot register new tools
 * - LLM cannot modify tool definitions
 * - Unknown tool names are rejected
 */
@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools = new Map<string, AITool>();

  /** Register a tool. Called once during module initialization. */
  register(tool: AITool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool "${tool.name}" already registered — overwriting`);
    }
    this.tools.set(tool.name, tool);
    this.logger.log(`Tool registered: ${tool.name}`);
  }

  /** Get a specific tool by name. Returns undefined if not found. */
  get(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get tools available to a user based on their permissions.
   * Only tools whose requiredPermission is in the user's permission list.
   */
  getAvailable(userPermissions: string[]): AITool[] {
    return Array.from(this.tools.values()).filter((tool) =>
      userPermissions.includes(tool.requiredPermission),
    );
  }

  /** Get all registered tool names (for debugging/logging). */
  getAllNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /** Total registered tools count. */
  get count(): number {
    return this.tools.size;
  }
}
