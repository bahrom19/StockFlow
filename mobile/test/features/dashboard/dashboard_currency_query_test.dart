import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/features/dashboard/data/repositories/dashboard_repository.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';

/// CURRENCY-4 — Reports/Dashboard single-currency queries.
///
/// Every monetary request (dashboard summary, recent sales, profit report)
/// must carry a `currency` query parameter so the backend aggregates ONE
/// currency only and never mixes currencies into one total.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('DashboardRepository currency query parameter', () {
    test('dashboard summary carries currency=USD', () async {
      final api = _RecordingApiClient();
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(api),
      ]);
      addTearDown(container.dispose);

      await container
          .read(dashboardRepositoryProvider)
          .getDashboardSummary(currency: 'USD');

      expect(api.getCalls.single['path'], '/reports/dashboard');
      expect(api.getCalls.single['queryParameters']['currency'], 'USD');
    });

    test('recent sales report carries currency=USD', () async {
      final api = _RecordingApiClient();
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(api),
      ]);
      addTearDown(container.dispose);

      await container
          .read(dashboardRepositoryProvider)
          .getRecentSales(currency: 'USD');

      expect(api.getCalls.single['path'], '/reports/sales');
      expect(api.getCalls.single['queryParameters']['currency'], 'USD');
    });

    test('profit report carries currency=USD', () async {
      final api = _RecordingApiClient();
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(api),
      ]);
      addTearDown(container.dispose);

      await container
          .read(dashboardRepositoryProvider)
          .getProfitReport(currency: 'USD');

      expect(api.getCalls.single['path'], '/reports/profit');
      expect(api.getCalls.single['queryParameters']['currency'], 'USD');
    });

    test('omitted currency sends no currency query parameter', () async {
      final api = _RecordingApiClient();
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(api),
      ]);
      addTearDown(container.dispose);

      await container.read(dashboardRepositoryProvider).getDashboardSummary();

      expect(
        api.getCalls.single['queryParameters'].containsKey('currency'),
        isFalse,
      );
    });
  });

  group('DashboardNotifier scopes requests to currencyProvider', () {
    test('loadDashboard sends the active currency on all monetary requests',
        () async {
      final api = _RecordingApiClient();
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(api),
      ]);
      addTearDown(container.dispose);

      await container.read(currencyProvider.notifier).setCurrency('EUR');
      await container.read(dashboardProvider.notifier).loadDashboard();

      final monetaryCalls = api.getCalls
          .where((c) =>
              c['path'] == '/reports/dashboard' ||
              c['path'] == '/reports/sales' ||
              c['path'] == '/reports/profit')
          .toList();
      expect(monetaryCalls.length, 3);
      for (final call in monetaryCalls) {
        expect(call['queryParameters']['currency'], 'EUR',
            reason: 'path ${call['path']} must be scoped to a single currency');
      }
    });
  });
}

/// Minimal ApiClient double recording GET invocations. Response bodies are
/// empty maps — parse failures are expected and treated as repository
/// failures; these tests only assert the outgoing query contract.
class _RecordingApiClient extends ApiClient {
  _RecordingApiClient() : super(tokenStorage: TokenStorage());

  final List<Map<String, dynamic>> getCalls = [];

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    getCalls.add({
      'path': path,
      'queryParameters': queryParameters ?? const {},
    });
    return Response<T>(
      data: <String, dynamic>{} as T,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    );
  }
}
