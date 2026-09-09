import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/company/company_provider.dart';

/// Selected currency — source of truth is backend Company.currency.
///
/// On cold start, SharedPreferences provides a warm/offline cache for fast UI.
/// After login/app-init, CompanyProvider fetches from backend and overwrites.
/// On logout, the cache is cleared.
///
/// This provider derives from companyCurrencyProvider (backend-driven).
/// It also supports an offline fallback path when backend is unavailable.
final currencyProvider =
    StateNotifierProvider<CurrencyNotifier, String>((ref) {
  // Derive from CompanyProvider when available
  final companyCurrency = ref.watch(companyCurrencyProvider);
  // If CompanyProvider has data, use it directly
  if (companyCurrency != 'KZT' || ref.read(companyProvider) != null) {
    return CurrencyNotifier._fromBackend(companyCurrency);
  }
  // Otherwise fall back to SharedPreferences cache
  return CurrencyNotifier();
});

class CurrencyNotifier extends StateNotifier<String> {
  static const String storageKey = 'app_currency';
  Future<void>? _loading;

  CurrencyNotifier() : super('KZT') {
    _loadFromCache();
  }

  CurrencyNotifier._fromBackend(String currency) : super(currency);

  /// Loads from SharedPreferences cache for fast cold-start UI.
  Future<void> _loadFromCache() {
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

  /// Updates the currency (e.g., after backend confirms a change).
  /// Writes to SharedPreferences for offline caching.
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

  /// Clears cache on logout.
  Future<void> reset() async {
    state = 'KZT';
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(storageKey);
    } catch (_) {
      // Best-effort cleanup.
    }
  }
}
