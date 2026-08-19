import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Locale codes supported by the app (mirrors the ARB files in lib/l10n).
const List<String> supportedLocaleCodes = ['en', 'ru', 'kk'];

/// Endonym display names shown in the language picker (never translated).
const Map<String, String> localeDisplayNames = {
  'en': 'English',
  'ru': 'Русский',
  'kk': 'Қазақша',
};

/// App locale — Phase 0 wiring of the existing gen-l10n infrastructure.
///
/// Persisted in SharedPreferences under the key `app_locale`. Defaults to
/// English; system `ru`/`kk` is intentionally NOT auto-activated — the app
/// keeps running on `en_US` until the owner explicitly picks a language, so
/// all existing tests and E2E English contracts stay untouched.
///
/// Implementation follows the monthlyGoalProvider pattern: reads/writes go
/// through `SharedPreferences.getInstance()` directly (canonical API, works
/// in tests via `SharedPreferences.setMockInitialValues`).
final localeProvider =
    StateNotifierProvider<LocaleNotifier, Locale>((ref) {
  return LocaleNotifier();
});

class LocaleNotifier extends StateNotifier<Locale> {
  static const String storageKey = 'app_locale';
  Future<void>? _loading;

  LocaleNotifier({Locale initialLocale = const Locale('en')})
      : super(initialLocale) {
    load();
  }

  /// Loads the persisted locale once. Idempotent — repeated calls await the
  /// same in-flight load, so callers (and tests) always observe the result.
  Future<void> load() {
    return _loading ??= _doLoad();
  }

  Future<void> _doLoad() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      state = localeFromCode(prefs.getString(storageKey));
    } catch (_) {
      // Storage unavailable — keep the current locale.
    }
  }

  /// Persists and applies [code] ('en' | 'ru' | 'kk'). Unsupported codes are
  /// ignored and the state stays unchanged.
  Future<void> setLocale(String code) async {
    if (!supportedLocaleCodes.contains(code)) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(storageKey, code);
    } catch (_) {
      // Best-effort: apply the in-memory value even if persistence fails.
    }
    state = localeFromCode(code);
  }

  /// Maps a persisted locale code to a [Locale]. Unknown or null codes fall
  /// back to English (the app default) — mirroring the app's
  /// `localeResolutionCallback`. Used both at startup (to avoid an English
  /// flash) and when reloading the persisted value.
  static Locale localeFromCode(String? code) {
    switch (code) {
      case 'ru':
        return const Locale('ru');
      case 'kk':
        return const Locale('kk');
      default:
        return const Locale('en');
    }
  }
}
