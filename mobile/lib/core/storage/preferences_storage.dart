import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Preferences Storage Provider
///
/// Initializes the storage through the provider lifecycle so every consumer
/// receives a ready-to-use instance on every platform (web/mobile/desktop).
///
/// Previously this provider returned a fresh, never-initialized
/// `PreferencesStorage()` while `main.dart` initialized a separate instance
/// that was never wired into it — reads/writes through the provider threw a
/// `StateError` that callers silently swallowed (e.g. held-sale persistence on
/// web never survived a reload).
final preferencesStorageProvider =
    FutureProvider<PreferencesStorage>((ref) async {
  final storage = PreferencesStorage();
  await storage.initialize();
  return storage;
});

/// Typed wrapper around SharedPreferences.
class PreferencesStorage {
  SharedPreferences? _prefs;

  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
  }

  SharedPreferences get _instance {
    if (_prefs == null) {
      throw StateError('PreferencesStorage not initialized. Call initialize() first.');
    }
    return _prefs!;
  }

  // ──────────────────────────────────
  // String
  // ──────────────────────────────────
  String? getString(String key) => _instance.getString(key);
  Future<bool> setString(String key, String value) => _instance.setString(key, value);

  // ──────────────────────────────────
  // Bool
  // ──────────────────────────────────
  bool? getBool(String key) => _instance.getBool(key);
  Future<bool> setBool(String key, bool value) => _instance.setBool(key, value);

  // ──────────────────────────────────
  // Int
  // ──────────────────────────────────
  int? getInt(String key) => _instance.getInt(key);
  Future<bool> setInt(String key, int value) => _instance.setInt(key, value);

  // ──────────────────────────────────
  // Double
  // ──────────────────────────────────
  double? getDouble(String key) => _instance.getDouble(key);
  Future<bool> setDouble(String key, double value) => _instance.setDouble(key, value);

  // ──────────────────────────────────
  // String List
  // ──────────────────────────────────
  List<String>? getStringList(String key) => _instance.getStringList(key);
  Future<bool> setStringList(String key, List<String> value) => _instance.setStringList(key, value);

  // ──────────────────────────────────
  // Remove & Clear
  // ──────────────────────────────────
  Future<bool> remove(String key) => _instance.remove(key);
  Future<bool> clear() => _instance.clear();

  // ──────────────────────────────────
  // Theme preference
  // ──────────────────────────────────
  static const String _themeKey = 'theme_mode';
  String? getThemeMode() => getString(_themeKey);
  Future<bool> setThemeMode(String mode) => setString(_themeKey, mode);

  // ──────────────────────────────────
  // Language preference
  // ──────────────────────────────────
  static const String _languageKey = 'language';
  String? getLanguage() => getString(_languageKey);
  Future<bool> setLanguage(String language) => setString(_languageKey, language);
}
