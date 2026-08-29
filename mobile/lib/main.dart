import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app.dart';
import 'core/config/environment.dart';
import 'core/localization/locale_provider.dart';
import 'core/logger/app_logger.dart';
import 'core/services/connectivity_service.dart';
import 'core/storage/preferences_storage.dart';

/// StockFlow Enterprise Application Entry Point
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables (prod env for release builds)
  await Environment.init(
    fileName: kReleaseMode ? 'env/.env.prod' : 'env/.env.dev',
  );

  // Initialize services
  final logger = AppLogger('StockFlow');
  final preferences = PreferencesStorage();
  await preferences.initialize();

  // Initialize connectivity monitoring
  final connectivity = ConnectivityService();
  await connectivity.initialize();

  // Configure device orientation
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  logger.info('StockFlow initialized in ${Environment.name} mode');

  // Read the persisted locale BEFORE the first frame so a previously selected
  // RU/KK locale is applied immediately — otherwise `localeProvider` would
  // start on English and flip after the async load, flashing English at launch.
  // `setLocale` continues to persist `app_locale`; this only seeds the initial
  // value and does not change supported locales / resolution.
  final prefs = await SharedPreferences.getInstance();
  final initialLocale =
      LocaleNotifier.localeFromCode(prefs.getString(LocaleNotifier.storageKey));

  runApp(
    ProviderScope(
      overrides: [
        localeProvider.overrideWith(
          (ref) => LocaleNotifier(initialLocale: initialLocale),
        ),
        // Inject THE single, eagerly-initialized ConnectivityService so every
        // consumer (status provider, offline banner, lifecycle refresh)
        // observes the same instance. Before this override the provider body
        // silently created a second, never-initialized instance.
        connectivityServiceProvider.overrideWithValue(connectivity),
      ],
      child: const StockFlowApp(),
    ),
  );
}
