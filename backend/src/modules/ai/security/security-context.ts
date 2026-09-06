/**
 * SecurityContext — carries authenticated user's identity through the AI layer.
 *
 * CRITICAL: companyId and userId come ONLY from JWT/authenticated context.
 * They are NEVER accepted from LLM input.
 */
export interface SecurityContext {
  /** Authenticated user ID — from JWT only */
  readonly userId: string;

  /** Company/tenant ID — from JWT only */
  readonly companyId: string;

  /** User's role names */
  readonly roles: string[];

  /** Resolved permission codes */
  readonly permissions: string[];

  /** User's locale (e.g. 'en', 'ru', 'kk') */
  readonly locale: string;

  /** Company base currency (e.g. 'KZT') */
  readonly currency: string;
}
