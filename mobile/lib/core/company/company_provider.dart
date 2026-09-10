import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';

/// Company data fetched from backend — the source of truth for currency.
///
/// After login, Flutter calls GET /companies/me to obtain the company's
/// authoritative currency. This provider overwrites any local
/// SharedPreferences cache.
class CompanyData {
  final String companyId;
  final String currency;
  final String companyName;

  const CompanyData({
    required this.companyId,
    required this.currency,
    required this.companyName,
  });
}

/// Provider that holds the company data. Starts as null (not loaded),
/// then populated from backend after login/app init.
final companyProvider =
    StateNotifierProvider<CompanyNotifier, CompanyData?>((ref) {
  return CompanyNotifier();
});

class CompanyNotifier extends StateNotifier<CompanyData?> {
  CompanyNotifier() : super(null);

  /// Fetches company currency from backend. Called after login and on app init.
  /// Overwrites any local cache with the backend's authoritative value.
  Future<void> load(ApiClient api) async {
    try {
      final response = await api.get('/companies/me');
      applyFromBackend(response.data as Map<String, dynamic>);
    } catch (_) {
      // Backend unavailable — keep null state. CurrencyProvider
      // will fall back to SharedPreferences cache or KZT default.
    }
  }

  /// Applies an already-fetched backend payload (the response body of
  /// GET/PATCH /companies/me) to the state without a second network
  /// round-trip. Used by [load] and by the settings currency update flow.
  void applyFromBackend(Map<String, dynamic> data) {
    final currency = data['currency'] as String? ?? 'KZT';
    final companyName = data['companyName'] as String? ?? '';
    final companyId = data['companyId'] as String? ?? '';

    state = CompanyData(
      companyId: companyId,
      currency: CurrencyCatalog.isSupported(currency) ? currency : 'KZT',
      companyName: companyName,
    );
  }

  /// Clears company data on logout.
  void reset() {
    state = null;
  }
}

/// Convenience provider that derives the current currency from CompanyProvider.
/// Falls back to SharedPreferences cache, then to KZT.
final companyCurrencyProvider = Provider<String>((ref) {
  final company = ref.watch(companyProvider);
  return company?.currency ?? 'KZT';
});
