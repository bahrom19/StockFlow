import { Injectable, Logger } from '@nestjs/common';
import {
  AIProvider,
  AIRequest,
  AIResponse,
  AIProviderConfig,
  AIProviderError,
} from './ai-provider.interface';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * OpenAI LLM provider implementation.
 *
 * Uses native Node.js fetch — no new dependencies required.
 * Provider-agnostic: implements AIProvider interface only.
 */
@Injectable()
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);

  constructor(private readonly config: AIProviderConfig) {}

  async chat(request: AIRequest): Promise<AIResponse> {
    const model = request.model ?? this.config.model;
    const timeoutMs = this.config.timeoutMs ?? 30000;

    const payload = {
      model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            }
          : {}),
      })),
      tools:
        request.tools.length > 0
          ? request.tools.map((t) => ({
              type: 'function' as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
              },
            }))
          : undefined,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 2048,
    };

    let lastError: Error | null = null;

    // Retry loop (max 2 retries for retryable errors)
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const error = this.normalizeHttpError(response.status, body);

          if (error.retryable && attempt < 2) {
            this.logger.warn(
              `Retry ${attempt + 1}/2: ${error.code} (${error.statusCode})`,
            );
            await this.delay((attempt + 1) * 1000);
            lastError = error;
            continue;
          }
          throw error;
        }

        const data = await response.json();
        return this.parseResponse(data, model);
      } catch (error: any) {
        if (error instanceof AIProviderError) {
          if (error.retryable && attempt < 2) {
            this.logger.warn(`Retry ${attempt + 1}/2: ${error.message}`);
            await this.delay((attempt + 1) * 1000);
            lastError = error;
            continue;
          }
          throw error;
        }

        // AbortError = timeout
        if (error.name === 'AbortError') {
          const timeoutError = new AIProviderError(
            this.name,
            'TIMEOUT',
            'OpenAI request timed out',
            true,
          );
          if (attempt < 2) {
            this.logger.warn(`Retry ${attempt + 1}/2: timeout`);
            await this.delay((attempt + 1) * 1000);
            lastError = timeoutError;
            continue;
          }
          throw timeoutError;
        }

        throw new AIProviderError(
          this.name,
          'SERVER_ERROR',
          `OpenAI request failed: ${error.message}`,
          false,
        );
      }
    }

    // Should never reach here, but just in case
    throw (
      lastError ??
      new AIProviderError(this.name, 'SERVER_ERROR', 'Max retries exceeded')
    );
  }

  // ── Response Parsing ────────────────────────────────────────

  private parseResponse(data: any, model: string): AIResponse {
    const choice = data.choices?.[0];
    if (!choice) {
      return {
        content: null,
        toolCalls: [],
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        model,
        finishReason: 'error',
      };
    }

    const toolCalls = (choice.message?.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    }));

    let finishReason: AIResponse['finishReason'] = 'stop';
    if (choice.finish_reason === 'tool_calls') finishReason = 'tool_calls';
    else if (choice.finish_reason === 'length') finishReason = 'length';

    return {
      content: choice.message?.content ?? null,
      toolCalls,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model,
      finishReason,
    };
  }

  // ── Error Normalization ─────────────────────────────────────

  private normalizeHttpError(
    status: number,
    body: any,
  ): AIProviderError {
    if (status === 401) {
      return new AIProviderError(
        this.name,
        'AUTH_ERROR',
        'Invalid OpenAI API key',
        false,
        401,
      );
    }

    if (status === 429) {
      return new AIProviderError(
        this.name,
        'RATE_LIMITED',
        'OpenAI rate limit exceeded',
        true,
        429,
      );
    }

    if (status >= 500) {
      return new AIProviderError(
        this.name,
        'SERVER_ERROR',
        `OpenAI server error: ${status}`,
        true,
        status,
      );
    }

    const message = body?.error?.message ?? `OpenAI error: ${status}`;
    return new AIProviderError(
      this.name,
      'INVALID_REQUEST',
      message,
      false,
      status,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
