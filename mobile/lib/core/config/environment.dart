import 'package:flutter_dotenv/flutter_dotenv.dart';

/// StockFlow Environment Configuration
/// Uses flutter_dotenv to load environment-specific variables.
class Environment {
  Environment._();

  static const String _defaultBaseUrl =
      'https://stockflow-production-04c7.up.railway.app/api';

  static Future<void> init({required String fileName}) async {
    await dotenv.load(fileName: fileName);
  }

  /// Safe accessor — returns null when dotenv is not loaded (e.g. in tests),
  /// instead of throwing NotInitializedError.
  static String? _value(String key) =>
      dotenv.isInitialized ? dotenv.env[key] : null;

  static String get name => _value('APP_ENV') ?? 'development';
  static String get appName => _value('APP_NAME') ?? 'StockFlow';
  static String get apiBaseUrl => _value('API_BASE_URL') ?? _defaultBaseUrl;
  static int get apiTimeout =>
      int.tryParse(_value('API_TIMEOUT') ?? '30000') ?? 30000;
  static bool get enableLogging => _value('ENABLE_LOGGING') == 'true';
  static bool get enableCrashReporting =>
      _value('ENABLE_CRASH_REPORTING') == 'true';

  static bool get isDevelopment => name == 'development';
  static bool get isProduction => name == 'production';
  static bool get isStaging => name == 'staging';
}
