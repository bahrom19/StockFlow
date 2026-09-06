import { Injectable, Logger } from '@nestjs/common';

export interface AIAuditEntry {
  requestId: string;
  userId: string;
  companyId: string;
  provider: string;
  model: string;
  toolCalls: string[];
  finishReason: string;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * AIAuditLogger — structured logging for AI requests.
 *
 * AI-0: uses application Logger (no persistent table).
 * Future: will write to AiAuditLog Prisma table.
 *
 * Never logs: API keys, Authorization headers, full user messages,
 * full LLM responses, or sensitive domain payloads.
 */
@Injectable()
export class AIAuditLogger {
  private readonly logger = new Logger(AIAuditLogger.name);

  log(entry: AIAuditEntry): void {
    const level = entry.success ? 'log' : 'warn';
    this.logger[level](
      JSON.stringify({
        ...entry,
        // Never log sensitive fields
        apiKey: undefined,
        authorization: undefined,
      }),
    );
  }
}
