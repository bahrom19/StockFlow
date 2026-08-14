import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';

/// Selected currency — Phase 4 wiring.
///
/// Persisted in SharedPreferences under the key `app_currency`. Defaults to
/// `KZT` (the backend company default). Unsupported codes are ignored and the
/// state stays unchanged; unknown stored values fall back to `KZT`.
///
/// Ownership note: the backend models currency at company level
/// (`Company.currency @default(KZT)`) but exposes no API for it. This client
/// provider follows the proven `localeProvider`/`monthlyGoalProvider` pattern
/// (direct `SharedPreferences.getInstance()` — canonical API, works in tests
/// via `SharedPreferences.setMockInitialValues`), giving persistence across
/// reloads with zero backend changes. Sales still record their own per-sale
/// currency (backend `Sale.currency`), which the POS sends from this provider.
final currencyProvider =
    StateNotifierProvider<CurrencyNotifier, String>((ref) {
  return CurrencyNotifier();
});

class CurrencyNotifier extends StateNotifier<String> {
  static const String storageKey = 'app_currency';
  Future<void>? _loading;

  CurrencyNotifier() : super('KZT') {
    load();
  }

  /// Loads the persisted currency once. Idempotent — repeated calls await the
  /// same in-flight load, so callers (and tests) always observe the result.
  Future<void> load() {
    return _loading ??= _doLoad();
  }

  Future<void> _doLoad() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(storageKey);
      state = CurrencyCatalog.isSupported(stored) ? stored! : 'KZT';
    } catch (_) {
      // Storage unavailable — keep the default (KZT).
    }
  }

  /// Persists and applies [code]. Unsupported codes are ignored and the
  /// state stays unchanged.
  Future<void> setCurrency(String code) async {
    if (!CurrencyCatalog.isSupported(code)) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(storageKey, code);
    } catch (_) {
      // Best-effort: apply the in-memory value even if persistence fails.
    }
    state = code;
  }
}
