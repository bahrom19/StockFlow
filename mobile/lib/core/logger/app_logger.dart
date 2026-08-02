import 'package:logger/logger.dart';
import 'package:stockflow/core/config/environment.dart';

/// StockFlow Enterprise Logger
class AppLogger {
  final Logger _logger;
  final String _tag;

  AppLogger(this._tag)
      : _logger = Logger(
          printer: PrettyPrinter(
            methodCount: 0,
            errorMethodCount: 5,
            lineLength: 100,
            colors: true,
            printEmojis: true,
            printTime: true,
          ),
          level: Environment.enableLogging ? Level.verbose : Level.warning,
        );

  void verbose(String message) => _logger.v('[$_tag] $message');
  void debug(String message) => _logger.d('[$_tag] $message');
  void info(String message) => _logger.i('[$_tag] $message');
  void warning(String message) => _logger.w('[$_tag] $message');
  void error(String message, [dynamic error, StackTrace? stackTrace]) {
    _logger.e('[$_tag] $message', error: error, stackTrace: stackTrace);
  }
}
