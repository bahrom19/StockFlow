import 'package:flutter/foundation.dart' show immutable, kDebugMode, kReleaseMode;
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Raised when the runtime configuration cannot yield a safe API target.
///
/// [reason] is always an enumerated description. It never contains the
/// configured URL, its credentials, or any other secret.
@immutable
class EnvironmentConfigError implements Exception {
  const EnvironmentConfigError(this.reason);

  final String reason;

  @override
  String toString() => 'EnvironmentConfigError: $reason';
}

/// StockFlow Environment Configuration
/// Uses flutter_dotenv to load environment-specific variables.
///
/// The environment is selected by `--dart-define=ENV=<name>`; when the define
/// is absent a release build selects [Environment.kProductionEnvironment] and
/// any other build selects [Environment.kDevelopmentEnvironment].
///
/// There is no implicit API target. A production host is reachable only when
/// the selected environment is `prod` AND the loaded configuration is valid.
class Environment {
  Environment._();

  static const String kDevelopmentEnvironment = 'dev';
  static const String kTestEnvironment = 'test';
  static const String kE2eEnvironment = 'e2e';
  static const String kProductionEnvironment = 'prod';

  /// Compile-time selector: `flutter build web --dart-define=ENV=e2e`.
  static const String _environmentDefine = String.fromEnvironment('ENV');

  /// Environment name -> bundled dotenv asset.
  static const Map<String, String> _assetByEnvironment = <String, String>{
    kDevelopmentEnvironment: 'env/.env.dev',
    // Widget/unit tests share the development configuration; they never
    // resolve a distinct asset because they never boot the application.
    kTestEnvironment: 'env/.env.dev',
    kE2eEnvironment: 'env/.env.e2e',
    kProductionEnvironment: 'env/.env.prod',
  };

  /// Every Railway host is production-grade infrastructure. A non-`prod`
  /// environment may not reach any of them, including future staging ones.
  static const String _railwayDomainSuffix = '.up.railway.app';
  static const String _railwayApexHost = 'up.railway.app';
  static const String _productionHost =
      'stockflow-production-04c7.up.railway.app';

  /// Loopback stand used only by debug builds that never load a configuration
  /// (unit and widget tests construct [ApiClient] without booting `main`).
  /// It is unreachable from a release or profile build.
  static const String _debugLoopbackBaseUrl = 'http://localhost:3000/api';

  static String? _debugOverrideEnvironment;
  static String? _debugOverrideApiBaseUrl;

  /// Name of the selected environment, before any debug override.
  static String get _configuredEnvironment => resolveEnvironmentName(
        _environmentDefine,
        isDebugBuild: kDebugMode,
      );

  /// Resolves the environment name from a `--dart-define=ENV=<name>` value.
  ///
  /// The define is required for every profile and release build: those refuse
  /// to start rather than assume an environment, so a production artifact can
  /// never silently fall back to the development (loopback) configuration.
  /// Only a debug build tolerates an absent define and selects
  /// [kDevelopmentEnvironment].
  ///
  /// [isDebugBuild] is a parameter instead of a direct read of [kReleaseMode]
  /// so the profile and release branches can be exercised from the debug test
  /// VM, where [kReleaseMode] is always false.
  static String resolveEnvironmentName(
    String define, {
    required bool isDebugBuild,
  }) {
    final normalized = define.trim().toLowerCase();
    if (normalized.isNotEmpty) return normalized;
    if (isDebugBuild) return kDevelopmentEnvironment;
    throw const EnvironmentConfigError(
      'ENV is not set; build with --dart-define=ENV=<name> '
      '(dev, test, e2e, prod)',
    );
  }

  /// `APP_ENV` is no longer the authority on the selected environment: it is a
  /// value inside a file that itself is chosen by the environment, so reading
  /// it back would let a file promote itself to `prod`.
  static String get name =>
      _debugOverrideEnvironment ?? _configuredEnvironment;

  static bool get isProduction => name == kProductionEnvironment;
  static bool get isDevelopment => name == kDevelopmentEnvironment;
  static bool get isStaging => name == 'staging';

  /// Production configuration is authorised only when the production
  /// environment is selected *and* the build is a release build.
  ///
  /// [kReleaseMode] is a compile-time constant (`dart.vm.product`), so neither a
  /// runtime flag nor a debug override can satisfy it: a debug or profile build
  /// is refused before any production value is read.
  static bool get _isProductionAuthorized =>
      kReleaseMode && name == kProductionEnvironment;

  /// Refuses the production environment in debug and profile builds. This does
  /// not inspect the configured URL — selecting `prod` on a non-release build is
  /// refused on its own.
  static void _assertProductionAuthorized() {
    if (name == kProductionEnvironment && !kReleaseMode) {
      throw const EnvironmentConfigError(
        'the production environment requires a release build; debug and '
        'profile builds are refused',
      );
    }
  }

  /// Bundled asset holding the configuration for the selected environment.
  static String get assetFileName {
    final file = _assetByEnvironment[name];
    if (file == null) {
      throw EnvironmentConfigError(
        'ENV=$name is not a known environment '
        '(allowed: ${_assetByEnvironment.keys.join(', ')})',
      );
    }
    return file;
  }

  /// Loads the configuration and proves that it resolves to a usable API
  /// target. Throws [EnvironmentConfigError] before the first frame when the
  /// configuration is missing, malformed, or disallowed for this environment.
  static Future<void> init({String? fileName}) async {
    _assertProductionAuthorized();
    await dotenv.load(fileName: fileName ?? assetFileName);
    _resolveApiBaseUrl();
  }

  /// Safe accessor for non-target values — returns null when dotenv is not
  /// loaded (e.g. in tests) instead of throwing NotInitializedError.
  static String? _value(String key) =>
      dotenv.isInitialized ? dotenv.env[key] : null;

  static String get appName => _value('APP_NAME') ?? 'StockFlow';
  static int get apiTimeout =>
      int.tryParse(_value('API_TIMEOUT') ?? '30000') ?? 30000;
  static bool get enableLogging => _value('ENABLE_LOGGING') == 'true';
  static bool get enableCrashReporting =>
      _value('ENABLE_CRASH_REPORTING') == 'true';

  /// The API target the application will actually call.
  ///
  /// Never returns a production host unless the production environment was
  /// selected on a release build. In a debug build with no configuration at all
  /// it degrades to a loopback stand so that unit and widget tests can
  /// construct clients; a release or profile build throws instead.
  static String get apiBaseUrl => _resolveApiBaseUrl(allowDebugStand: true);

  static String _resolveApiBaseUrl({bool allowDebugStand = false}) {
    _assertProductionAuthorized();
    final override = _debugOverrideApiBaseUrl;
    if (override != null) {
      return _validate(override).toString();
    }

    if (dotenv.isInitialized) {
      final configured = dotenv.env['API_BASE_URL'];
      if (configured != null && configured.trim().isNotEmpty) {
        return _validate(configured.trim()).toString();
      }
    }

    if (allowDebugStand && kDebugMode) return _debugLoopbackBaseUrl;

    throw const EnvironmentConfigError(
      'API_BASE_URL is not configured for this environment',
    );
  }

  static Uri _validate(String raw) =>
      validateApiBaseUrl(raw, allowProduction: _isProductionAuthorized);

  /// Parses [raw] with the standard URL parser and returns the normalized URI
  /// that callers must use verbatim.
  ///
  /// Rejects: empty values, whitespace or control characters anywhere, schemes
  /// other than http/https, embedded credentials, a missing host, IPv6
  /// literals, a missing or non-numeric port, ports outside 1-65535, and — when
  /// [allowProduction] is false — any Railway host.
  static Uri validateApiBaseUrl(
    String raw, {
    required bool allowProduction,
  }) {
    if (raw.isEmpty) {
      throw const EnvironmentConfigError('API_BASE_URL is empty');
    }

    for (final unit in raw.codeUnits) {
      if (unit <= 0x20 || unit == 0x7f) {
        throw const EnvironmentConfigError(
          'API_BASE_URL contains whitespace or a control character',
        );
      }
    }

    final schemeEnd = raw.indexOf('://');
    if (schemeEnd <= 0) {
      throw const EnvironmentConfigError(
        'API_BASE_URL is not an absolute http(s) URL',
      );
    }
    final pathStart = raw.indexOf('/', schemeEnd + 3);
    final authority = raw.substring(
      schemeEnd + 3,
      pathStart == -1 ? raw.length : pathStart,
    );
    if (authority.endsWith(':')) {
      throw const EnvironmentConfigError('API_BASE_URL has an empty port');
    }

    final Uri uri;
    try {
      uri = Uri.parse(raw);
    } on FormatException {
      throw const EnvironmentConfigError('API_BASE_URL is not a valid URL');
    }

    final scheme = uri.scheme.toLowerCase();
    if (scheme != 'http' && scheme != 'https') {
      throw const EnvironmentConfigError(
        'API_BASE_URL must use the http or https scheme',
      );
    }
    if (uri.userInfo.isNotEmpty) {
      throw const EnvironmentConfigError(
        'API_BASE_URL must not carry credentials',
      );
    }

    final host = uri.host;
    if (host.isEmpty) {
      throw const EnvironmentConfigError('API_BASE_URL has no host');
    }
    if (host.contains(':')) {
      throw const EnvironmentConfigError(
        'API_BASE_URL must not use an IPv6 literal host',
      );
    }

    final int port;
    try {
      port = uri.port;
    } on Object {
      throw const EnvironmentConfigError('API_BASE_URL has a malformed port');
    }
    if (port <= 0 || port > 65535) {
      throw const EnvironmentConfigError(
        'API_BASE_URL port is outside the range 1-65535',
      );
    }

    if (!allowProduction && _isProductionHost(host)) {
      throw const EnvironmentConfigError(
        'a production API host is only reachable when ENV=prod',
      );
    }

    return uri;
  }

  /// Canonical form of [host] for deny-list comparison.
  ///
  /// DNS treats a trailing dot as the explicit root label, so `host.` resolves
  /// to the same address as `host`. Repeated trailing dots are the empty-label
  /// form of that same ambiguity. Lower-casing matches how resolvers compare
  /// names. Both steps only ever *add* matches to the deny list, so they can
  /// never widen what is reachable.
  static String _normalizeHost(String host) {
    var normalized = host.trim().toLowerCase();
    while (normalized.endsWith('.')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
  }

  static bool _isProductionHost(String host) {
    final normalized = _normalizeHost(host);
    return normalized == _productionHost ||
        normalized == _railwayApexHost ||
        normalized.endsWith(_railwayDomainSuffix);
  }

  /// Debug-only override. Unavailable in profile and release builds, and never
  /// called by production code.
  static void debugOverrideForTesting({
    String? environment,
    String? apiBaseUrl,
  }) {
    if (!kDebugMode) {
      throw StateError(
        'debugOverrideForTesting is unavailable outside debug builds',
      );
    }
    _debugOverrideEnvironment = environment;
    _debugOverrideApiBaseUrl = apiBaseUrl;
  }

  /// Clears any [debugOverrideForTesting] values.
  static void debugResetForTesting() {
    if (!kDebugMode) {
      throw StateError(
        'debugResetForTesting is unavailable outside debug builds',
      );
    }
    _debugOverrideEnvironment = null;
    _debugOverrideApiBaseUrl = null;
  }
}
