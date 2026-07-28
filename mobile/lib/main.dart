import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/config/environment.dart';
import 'core/logger/app_logger.dart';
import 'core/services/connectivity_service.dart';
import 'core/storage/preferences_storage.dart';

/// StockFlow Enterprise Application Entry Point
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables
  await Environment.init(
    fileName: 'env/.env.dev', // Change to .env.prod for production
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

  runApp(
    const ProviderScope(
      child: StockFlowApp(),
    ),
  );
}
