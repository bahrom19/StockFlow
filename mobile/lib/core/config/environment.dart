import 'package:flutter_dotenv/flutter_dotenv.dart';

/// StockFlow Environment Configuration
/// Uses flutter_dotenv to load environment-specific variables.
class Environment {
  Environment._();

  static const String _defaultBaseUrl = 'http://localhost:3000/api/v1';

  static Future<void> init({required String fileName}) async {
    await dotenv.load(fileName: fileName);
  }

  static String get name => dotenv.env['APP_ENV'] ?? 'development';
  static String get appName => dotenv.env['APP_NAME'] ?? 'StockFlow';
  static String get apiBaseUrl => dotenv.env['API_BASE_URL'] ?? _defaultBaseUrl;
  static int get apiTimeout => int.tryParse(dotenv.env['API_TIMEOUT'] ?? '30000') ?? 30000;
  static bool get enableLogging => dotenv.env['ENABLE_LOGGING'] == 'true';
  static bool get enableCrashReporting => dotenv.env['ENABLE_CRASH_REPORTING'] == 'true';

  static bool get isDevelopment => name == 'development';
  static bool get isProduction => name == 'production';
  static bool get isStaging => name == 'staging';
}
