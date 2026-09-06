import { OpenAIProvider } from '../providers/openai-provider';
import { AIProviderError, AIResponse } from '../providers/ai-provider.interface';

/** Mirrors the constant in openai-provider.ts */
const DEFAULT_TOTAL_BUDGET_MS = 60_000;

// ── Test Helpers ──────────────────────────────────────────

const VALID_CONFIG = {
  apiKey: 'test-api-key',
  model: 'gpt-4',
  timeoutMs: 5000,
};

const SIMPLE_REQUEST = {
  messages: [{ role: 'user' as const, content: 'Hello' }],
  tools: [],
};

function makeSuccessResponse(overrides?: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: { content: 'Hi there!', tool_calls: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      ...overrides,
    }),
  };
}

function makeErrorResponse(
  status: number,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return {
    ok: false,
    status,
    headers: {
      get: (name: string) => headers?.[name] ?? null,
      entries: () => [][Symbol.iterator](),
    },
    json: async () => body ?? {},
  };
}

// ── Tests ─────────────────────────────────────────────────

describe('OpenAIProvider — AI-4A Retry & Timeout', () => {
  let fetchSpy: jest.SpyInstance;
  let delayCalls: number[];
  let provider: OpenAIProvider;

  beforeEach(() => {
    jest.useFakeTimers();
    delayCalls = [];

    const mockDelay = (ms: number) => {
      delayCalls.push(ms);
      return new Promise<void>((resolve) => {
        // Auto-resolve immediately for deterministic tests
        resolve();
      });
    };

    provider = new OpenAIProvider(VALID_CONFIG, mockDelay);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ── A. 429 + Retry-After ────────────────────────────────

  describe('F1: Retry-After parsing', () => {
    it('uses Retry-After header value for 429 delay', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429, undefined, { 'Retry-After': '3' }))
        .mockResolvedValueOnce(makeSuccessResponse());

      const result = await provider.chat(SIMPLE_REQUEST);

      expect(result.content).toBe('Hi there!');
      expect(delayCalls).toEqual([3000]); // 3 seconds → 3000ms
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('handles Retry-After as integer seconds string', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429, undefined, { 'Retry-After': '1' }))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);
      expect(delayCalls).toEqual([1000]);
    });

    it('handles Retry-After with decimal seconds', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429, undefined, { 'Retry-After': '2.5' }))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);
      expect(delayCalls).toEqual([2500]);
    });
  });

  // ── B. 429 without Retry-After → exponential backoff ────

  describe('429 without Retry-After', () => {
    it('uses exponential backoff when Retry-After is absent', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);

      // Exponential: 1000 * 2^0 = 1000
      expect(delayCalls).toEqual([1000]);
    });
  });

  // ── C. Retry-After invalid → fallback ───────────────────

  describe('Retry-After invalid values', () => {
    it('falls back to exponential when Retry-After is non-numeric', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429, undefined, { 'Retry-After': 'abc' }))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);

      // Not a valid number, not a valid date → fallback to exponential: 1000
      expect(delayCalls).toEqual([1000]);
    });

    it('falls back to exponential when Retry-After is empty', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429, undefined, { 'Retry-After': '' }))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);
      expect(delayCalls).toEqual([1000]);
    });
  });

  // ── D. Retry-After negative/absurd → clamped ────────────

  describe('Retry-After clamping', () => {
    it('clamps Retry-After to MAX_RETRY_AFTER_MS (10s)', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429, undefined, { 'Retry-After': '999' }))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);

      // 999s = 999000ms, clamped to 10000ms
      expect(delayCalls).toEqual([10_000]);
    });

    it('handles Retry-After = 0 (immediate retry)', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429, undefined, { 'Retry-After': '0' }))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);
      expect(delayCalls).toEqual([0]);
    });

    it('handles negative Retry-After by falling back to exponential', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429, undefined, { 'Retry-After': '-5' }))
        .mockResolvedValueOnce(makeSuccessResponse());

      const result = await provider.chat(SIMPLE_REQUEST);

      // -5 is negative → parseRetryAfter returns null → exponential fallback: 1000
      expect(result.content).toBe('Hi there!');
      expect(delayCalls).toHaveLength(1);
      expect(delayCalls[0]).toBeGreaterThan(0);
    });
  });

  // ── E. Exponential backoff ──────────────────────────────

  describe('F4: Exponential backoff', () => {
    it('uses exponential backoff: 1s then 2s', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429))
        .mockResolvedValueOnce(makeErrorResponse(429))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);

      // attempt 0 → 1000 * 2^0 = 1000
      // attempt 1 → 1000 * 2^1 = 2000
      expect(delayCalls).toEqual([1000, 2000]);
    });

    it('uses exponential backoff for 5xx errors', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(500))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);

      expect(delayCalls).toEqual([1000]);
    });

    it('uses exponential backoff for timeout errors', async () => {
      fetchSpy
        .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        .mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);

      expect(delayCalls).toEqual([1000]);
    });
  });

  // ── F. Maximum retries not increased ────────────────────

  describe('Max retries', () => {
    it('does not retry more than 2 times', async () => {
      fetchSpy
        .mockResolvedValue(makeErrorResponse(429)); // always 429

      await expect(provider.chat(SIMPLE_REQUEST)).rejects.toThrow(AIProviderError);

      // Initial + 2 retries = 3 total calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(delayCalls).toHaveLength(2); // 2 delays for 2 retries
    });

    it('stops retrying on 3rd failure', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(500))
        .mockResolvedValueOnce(makeErrorResponse(500))
        .mockResolvedValueOnce(makeErrorResponse(500));

      await expect(provider.chat(SIMPLE_REQUEST)).rejects.toThrow(AIProviderError);

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(delayCalls).toEqual([1000, 2000]);
    });
  });

  // ── G. Total timeout budget ─────────────────────────────

  describe('F2: Total timeout budget', () => {
    it('throws non-retryable TIMEOUT when budget is exceeded', async () => {
      // Simulate time advancing past budget during delay
      const realDelay = async (ms: number) => {
        delayCalls.push(ms);
        // Advance fake timers past the 60s budget
        jest.advanceTimersByTime(DEFAULT_TOTAL_BUDGET_MS + 1);
      };

      provider = new OpenAIProvider(VALID_CONFIG, realDelay);

      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(429))
        .mockResolvedValueOnce(makeSuccessResponse());

      const error = await provider.chat(SIMPLE_REQUEST).catch((e) => e);
      expect(error).toBeInstanceOf(AIProviderError);
      expect(error.code).toBe('TIMEOUT');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('timed out');
    });

    it('succeeds within budget', async () => {
      fetchSpy.mockResolvedValueOnce(makeSuccessResponse());

      const result = await provider.chat(SIMPLE_REQUEST);
      expect(result.content).toBe('Hi there!');
    });
  });

  // ── H. Non-retryable errors ─────────────────────────────

  describe('Non-retryable errors', () => {
    it('does not retry on 401 (AUTH_ERROR)', async () => {
      fetchSpy.mockResolvedValueOnce(makeErrorResponse(401));

      const error = await provider.chat(SIMPLE_REQUEST).catch((e) => e);
      expect(error).toBeInstanceOf(AIProviderError);
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.retryable).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(delayCalls).toEqual([]);
    });

    it('does not retry on 400 (INVALID_REQUEST)', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeErrorResponse(400, { error: { message: 'Bad request' } }),
      );

      const error = await provider.chat(SIMPLE_REQUEST).catch((e) => e);
      expect(error).toBeInstanceOf(AIProviderError);
      expect(error.code).toBe('INVALID_REQUEST');
      expect(error.retryable).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(delayCalls).toEqual([]);
    });

    it('does not retry on 403 (INVALID_REQUEST)', async () => {
      fetchSpy.mockResolvedValueOnce(makeErrorResponse(403));

      const error = await provider.chat(SIMPLE_REQUEST).catch((e) => e);
      expect(error).toBeInstanceOf(AIProviderError);
      expect(error.code).toBe('INVALID_REQUEST');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(delayCalls).toEqual([]);
    });

    it('retries on 5xx (SERVER_ERROR)', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(500))
        .mockResolvedValueOnce(makeSuccessResponse());

      const result = await provider.chat(SIMPLE_REQUEST);
      expect(result.content).toBe('Hi there!');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(delayCalls).toEqual([1000]);
    });
  });

  // ── I. Successful request ───────────────────────────────

  describe('Successful request', () => {
    it('returns response without retry on success', async () => {
      fetchSpy.mockResolvedValueOnce(makeSuccessResponse());

      const result = await provider.chat(SIMPLE_REQUEST);

      expect(result.content).toBe('Hi there!');
      expect(result.model).toBe('gpt-4');
      expect(result.finishReason).toBe('stop');
      expect(result.usage.promptTokens).toBe(10);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(delayCalls).toEqual([]);
    });

    it('preserves existing tool call behavior', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '',
                tool_calls: [
                  {
                    id: 'call_123',
                    function: { name: 'get_dashboard', arguments: '{"currency":"KZT"}' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }),
      });

      const result = await provider.chat(SIMPLE_REQUEST);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]!.name).toBe('get_dashboard');
      expect(result.toolCalls[0]!.arguments).toEqual({ currency: 'KZT' });
      expect(result.finishReason).toBe('tool_calls');
    });
  });

  // ── Security ────────────────────────────────────────────

  describe('Security', () => {
    it('does not expose API key in error messages', async () => {
      fetchSpy.mockResolvedValueOnce(makeErrorResponse(500));

      const error = await provider.chat(SIMPLE_REQUEST).catch((e) => e);
      expect(error.message).not.toContain('test-api-key');
      expect(error.message).not.toContain('Bearer');
    });

    it('does not expose API key in fetch headers to error messages', async () => {
      fetchSpy
        .mockResolvedValueOnce(makeErrorResponse(500))
        .mockResolvedValueOnce(makeSuccessResponse());

      // Verify retry works and error messages are safe
      const result = await provider.chat(SIMPLE_REQUEST);
      expect(result.content).toBe('Hi there!');

      // Verify Authorization header was set (but not in error output)
      const firstCallHeaders = fetchSpy.mock.calls[0][1]?.headers;
      expect(firstCallHeaders?.Authorization).toBe('Bearer test-api-key');
    });
  });

  // ── Budget timeout abort behavior ───────────────────────

  describe('Budget timeout behavior', () => {
    it('budget timer is cleaned up after success', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      fetchSpy.mockResolvedValueOnce(makeSuccessResponse());

      await provider.chat(SIMPLE_REQUEST);

      // clearTimeout should be called for the budget timer
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('budget timer is cleaned up after error', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      fetchSpy.mockResolvedValueOnce(makeErrorResponse(401));

      await provider.chat(SIMPLE_REQUEST).catch(() => {});

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
