/// StockFlow Application Constants
class AppConstants {
  AppConstants._();

  // ──────────────────────────────────
  // App Info
  // ──────────────────────────────────
  static const String appName = 'StockFlow';
  static const String appVersion = '1.0.0';
  static const String companyName = 'StockFlow Inc.';

  // ──────────────────────────────────
  // Pagination
  // ──────────────────────────────────
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;
  static const String defaultSortField = 'createdAt';
  static const String defaultSortOrder = 'desc';

  // ──────────────────────────────────
  // Cache
  // ──────────────────────────────────
  static const Duration cacheDuration = Duration(minutes: 5);
  static const Duration searchDebounce = Duration(milliseconds: 300);

  // ──────────────────────────────────
  // Validation
  // ──────────────────────────────────
  static const int minPasswordLength = 8;
  static const int maxPasswordLength = 128;
  static const int minEmailLength = 5;
  static const int maxEmailLength = 254;
  static const int minNameLength = 2;
  static const int maxNameLength = 100;
  static const int maxPhoneLength = 20;

  // ──────────────────────────────────
  // Business
  // ──────────────────────────────────
  static const int maxDecimalPlaces = 2;
  static const int maxQuantityDecimalPlaces = 4;
  static const String defaultCurrency = 'USD';
}
