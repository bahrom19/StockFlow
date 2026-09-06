import { SecurityContext } from '../security/security-context';

/**
 * AI Tool — a registered read-only operation the AI can invoke.
 *
 * Every tool:
 * - Has a unique name (used by LLM for tool_calls)
 * - Describes itself to the LLM
 * - Requires a specific permission
 * - Executes against existing domain services (never raw Prisma)
 * - Receives SecurityContext for tenant isolation
 * - Returns structured JSON (never raw DB entities)
 */
export interface AITool {
  /** Unique tool name — used by LLM for function calling */
  readonly name: string;

  /** Human-readable description sent to LLM */
  readonly description: string;

  /** JSON Schema for tool input parameters */
  readonly inputSchema: Record<string, unknown>;

  /** Required permission code (e.g. 'reports:read') */
  readonly requiredPermission: string;

  /**
   * Execute the tool with given input and security context.
   * companyId comes from ctx, NOT from input.
   */
  execute(
    input: Record<string, unknown>,
    ctx: SecurityContext,
  ): Promise<Record<string, unknown>>;
}
