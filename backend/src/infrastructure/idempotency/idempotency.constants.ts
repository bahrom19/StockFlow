/**
 * Phase F1 — DB-backed idempotency layer constants.
 *
 * Records are scoped to (companyId, idempotencyKey) and valid for 24 hours.
 */

/** Time-to-live for an idempotency reservation: 24 hours. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Sentinel `responseStatus` used while a reservation is in-flight.
 * `0` is not a valid HTTP status, so a committed row with status 0 can
 * only mean the caller committed a reservation without saving a response.
 */
export const IDEMPOTENCY_PENDING_STATUS = 0;

/**
 * Sentinel stored in `responseBody` while the reservation is pending.
 * A committed row with `responseStatus = 0` plus this sentinel is reported
 * back as an in-flight conflict, never as a replay. A real completed
 * response may legitimately have `responseBody = null`.
 */
export const IDEMPOTENCY_PENDING_BODY = '__stockflow_pending__';
