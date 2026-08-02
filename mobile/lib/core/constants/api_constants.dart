/// StockFlow API Constants
class ApiConstants {
  ApiConstants._();

  // ──────────────────────────────────
  // Headers
  // ──────────────────────────────────
  static const String headerAuthorization = 'Authorization';
  static const String headerContentType = 'Content-Type';
  static const String headerAccept = 'Accept';
  static const String headerXRequestId = 'X-Request-ID';
  static const String headerXCompanyId = 'X-Company-ID';
  static const String headerXApiVersion = 'X-API-Version';

  static const String contentTypeJson = 'application/json';
  static const String bearerPrefix = 'Bearer ';

  // ──────────────────────────────────
  // HTTP Status Codes
  // ──────────────────────────────────
  static const int statusOk = 200;
  static const int statusCreated = 201;
  static const int statusNoContent = 204;
  static const int statusBadRequest = 400;
  static const int statusUnauthorized = 401;
  static const int statusForbidden = 403;
  static const int statusNotFound = 404;
  static const int statusConflict = 409;
  static const int statusUnprocessableEntity = 422;
  static const int statusTooManyRequests = 429;
  static const int statusInternalServerError = 500;
  static const int statusServiceUnavailable = 503;

  // ──────────────────────────────────
  // API Version
  // ──────────────────────────────────
  // Production backend prefix is /api (no version segment).
  static const String apiPrefix = '/api';
}
