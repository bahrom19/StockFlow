import { Injectable, Logger } from '@nestjs/common';
import {
  AIProvider,
  AIRequest,
  AIResponse,
  AIProviderConfig,
  AIProviderError,
} from './ai-provider.interface';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/** Maximum delay allowed when parsing Retry-After header (ms) */
const MAX_RETRY_AFTER_MS = 10_000;

/** Default total budget for the entire provider operation including retries (ms) */
const DEFAULT_TOTAL_BUDGET_MS = 60_000;

/** Maximum number of retries (unchanged from AI-0) */
const MAX_RETRIES = 2;

/**
 * OpenAI LLM provider implementation.
 *
 * Uses native Node.js fetch — no new dependencies required.
 * Provider-agnostic: implements AIProvider interface only.
 *
 * AI-4A: Adds Retry-After parsing, exponential backoff, and total timeout budget.
 */
@Injectable()
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);

  /**
   * @param config Provider configuration
   * @param delayFn Injectable delay function for testability
   */
  constructor(
    private readonly config: AIProviderConfig,
    private readonly delayFn: (ms: number) => Promise<void> = defaultDelay,
  ) {}

  async chat(request: AIRequest): Promise<AIResponse> {
    const model = request.model ?? this.config.model;
    const perRequestTimeoutMs = this.config.timeoutMs ?? 30000;
    const totalBudgetMs = DEFAULT_TOTAL_BUDGET_MS;

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

    // ── F2: Total timeout budget ──────────────────────────────
    const budgetDeadline = Date.now() + totalBudgetMs;
    const budgetController = new AbortController();
    const budgetTimer = setTimeout(() => budgetController.abort(), totalBudgetMs);

    let lastError: Error | null = null;

    try {
      // Retry loop (max 2 retries for retryable errors)
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        // ── AI-6: Check external request signal before each attempt ─────
        if (request.signal?.aborted) {
          throw new AIProviderError(
            this.name,
            'TIMEOUT',
            'Request budget exceeded',
            false,
          );
        }

        // ── F2: Check budget before each attempt ─────────────
        if (Date.now() >= budgetDeadline) {
          this.logger.warn('Provider total timeout budget exceeded — aborting retries');
          throw new AIProviderError(
            this.name,
            'TIMEOUT',
            'Provider operation timed out',
            false, // not retryable — budget exhausted
          );
        }

        try {
          const controller = new AbortController();

          // Link budget controller to per-request controller
          const budgetAbort = () => controller.abort();
          budgetController.signal.addEventListener('abort', budgetAbort, {
            once: true,
          });

          // AI-6: Link external request-level abort signal to per-request controller
          // This allows AI-6 request budget to abort in-flight fetch() calls
          let requestAbort: (() => void) | null = null;
          if (request.signal) {
            if (request.signal.aborted) {
              controller.abort();
            } else {
              requestAbort = () => controller.abort();
              request.signal.addEventListener('abort', requestAbort, { once: true });
            }
          }

          const timeoutId = setTimeout(() => controller.abort(), perRequestTimeoutMs);

          let response: Response;
          try {
            response = await fetch(OPENAI_API_URL, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
            budgetController.signal.removeEventListener('abort', budgetAbort);
            if (requestAbort && request.signal) {
              request.signal.removeEventListener('abort', requestAbort);
            }
          }

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));

            // ── F1: Parse Retry-After from response ──────────
            const retryAfterMs = this.parseRetryAfter(
              response.headers.get('Retry-After'),
            );

            const error = this.normalizeHttpError(response.status, body);

            if (error.retryable && attempt < MAX_RETRIES) {
              const delayMs = this.computeRetryDelay(attempt, retryAfterMs);
              this.logger.warn(
                `Retry ${attempt + 1}/${MAX_RETRIES}: ${error.code} (${error.statusCode}) — waiting ${delayMs}ms`,
              );
              await this.delayFn(delayMs);
              lastError = error;
              continue;
            }
            throw error;
          }

          const data = await response.json();
          return this.parseResponse(data, model);
        } catch (error: any) {
          if (error instanceof AIProviderError) {
            if (error.retryable && attempt < MAX_RETRIES) {
              const delayMs = this.computeRetryDelay(attempt, null);
              this.logger.warn(
                `Retry ${attempt + 1}/${MAX_RETRIES}: ${error.message} — waiting ${delayMs}ms`,
              );
              await this.delayFn(delayMs);
              lastError = error;
              continue;
            }
            throw error;
          }

          // AbortError = timeout (per-request or budget)
          if (error.name === 'AbortError') {
            const isBudgetExhausted = Date.now() >= budgetDeadline;
            const timeoutError = new AIProviderError(
              this.name,
              'TIMEOUT',
              isBudgetExhausted
                ? 'Provider operation timed out'
                : 'OpenAI request timed out',
              !isBudgetExhausted, // only retryable if budget remains
            );

            if (!isBudgetExhausted && attempt < MAX_RETRIES) {
              const delayMs = this.computeRetryDelay(attempt, null);
              this.logger.warn(
                `Retry ${attempt + 1}/${MAX_RETRIES}: timeout — waiting ${delayMs}ms`,
              );
              await this.delayFn(delayMs);
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
    } finally {
      clearTimeout(budgetTimer);
    }
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

  private normalizeHttpError(status: number, body: any): AIProviderError {
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

  // ── F1: Retry-After Parsing ─────────────────────────────────

  /**
   * Parse Retry-After header value.
   *
   * Supports:
   * - Integer seconds (e.g., "2", "30")
   * - HTTP-date (best-effort: treated as 0 delay since we can't compute delta reliably)
   *
   * Returns null if header is missing or unparseable.
   * Clamps to [0, MAX_RETRY_AFTER_MS].
   */
  private parseRetryAfter(headerValue: string | null): number | null {
    if (!headerValue) {
      return null;
    }

    const trimmed = headerValue.trim();

    // Try integer seconds first
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds) && seconds >= 0) {
      const ms = Math.round(seconds * 1000);
      return Math.min(ms, MAX_RETRY_AFTER_MS);
    }

    // HTTP-date format — attempt to parse (must be reasonably recent)
    try {
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        const deltaMs = date.getTime() - Date.now();
        // Only accept if date is in the near future (0–60s from now)
        // This filters out garbage strings that parse as valid dates
        if (deltaMs >= 0 && deltaMs <= 60_000) {
          return Math.min(deltaMs, MAX_RETRY_AFTER_MS);
        }
      }
    } catch {
      // Not a valid date
    }

    return null;
  }

  // ── F4: Retry Delay Computation ─────────────────────────────

  /**
   * Compute retry delay using exponential backoff.
   *
   * If Retry-After is provided and valid, it takes precedence.
   * Otherwise: exponential backoff = 1000ms × 2^attempt
   *   - attempt 0 → 1000ms
   *   - attempt 1 → 2000ms
   *
   * Always clamped to [0, MAX_RETRY_AFTER_MS].
   */
  private computeRetryDelay(attempt: number, retryAfterMs: number | null): number {
    if (retryAfterMs !== null && retryAfterMs >= 0) {
      return Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
    }

    // Exponential backoff: 1000ms × 2^attempt
    const exponentialMs = 1000 * Math.pow(2, attempt);
    return Math.min(exponentialMs, MAX_RETRY_AFTER_MS);
  }
}

// ── Default delay ───────────────────────────────────────────

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
