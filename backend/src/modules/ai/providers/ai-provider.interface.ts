/**
 * AI Provider Interface — provider-agnostic contract for LLM integration.
 *
 * All AI providers (OpenAI, Anthropic, etc.) implement this interface.
 * The AI Orchestrator uses only this interface — never concrete providers.
 */

// ── Messages ──────────────────────────────────────────────────

export type AIRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  role: AIRole;
  content: string;
  toolCallId?: string;
  toolCalls?: AIToolCall[];
}

// ── Tool Definitions (sent to LLM) ───────────────────────────

export interface AIToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ── Tool Calls (returned by LLM) ─────────────────────────────

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ── Request / Response ────────────────────────────────────────

export interface AIRequest {
  messages: AIMessage[];
  tools: AIToolDefinition[];
  model?: string;
}

export interface AIResponse {
  content: string | null;
  toolCalls: AIToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

// ── Provider Config ───────────────────────────────────────────

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

// ── Provider Errors ───────────────────────────────────────────

export type AIProviderErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'AUTH_ERROR'
  | 'SERVER_ERROR'
  | 'INVALID_REQUEST';

export class AIProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: AIProviderErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

// ── Provider Interface ────────────────────────────────────────

export interface AIProvider {
  readonly name: string;
  chat(request: AIRequest): Promise<AIResponse>;
}
