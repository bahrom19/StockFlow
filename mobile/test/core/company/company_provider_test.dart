import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/company/company_provider.dart';

/// In-memory TokenStorage — never touches platform channels (same pattern as
/// test/core/api/retry_policy_test.dart).
class _FakeTokenStorage extends TokenStorage {
  String? accessToken = 'test-access';
  String? refreshToken = 'test-refresh';

  @override
  Future<String?> getAccessToken() async => accessToken;

  @override
  Future<String?> getRefreshToken() async => refreshToken;

  @override
  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {}

  @override
  Future<void> clearTokens() async {}
}

/// Scriptable adapter: every call invokes the script function with the
/// zero-based call index and records the request for assertions.
class _ScriptedAdapter implements HttpClientAdapter {
  _ScriptedAdapter(this._script);

  final Object Function(RequestOptions options, int call) _script;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final result = _script(options, requests.length - 1);
    if (result is ResponseBody) return result;
    throw result;
  }

  @override
  void close({bool force = false}) {}
}

ApiClient _clientWith(_ScriptedAdapter adapter) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.test'));
  dio.httpClientAdapter = adapter;
  return ApiClient(
    tokenStorage: _FakeTokenStorage(),
    dio: dio,
    refreshDio: Dio(),
    retryDelay: Duration.zero, // keep tests fast; prod keeps 1s/2s/3s
  );
}

void main() {
  test('load success: GET /companies/me populates CompanyData', () async {
    final adapter = _ScriptedAdapter((o, i) => ResponseBody.fromString(
          jsonEncode({
            'companyId': 'c1',
            'currency': 'RUB',
            'companyName': 'Acme Ltd',
          }),
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        ));
    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(_clientWith(adapter))],
    );
    addTearDown(container.dispose);

    await container
        .read(companyProvider.notifier)
        .load(container.read(apiClientProvider));

    expect(adapter.requests, hasLength(1));
    expect(adapter.requests.single.method, 'GET');
    expect(adapter.requests.single.path, '/companies/me');
    final company = container.read(companyProvider);
    expect(company, isNotNull);
    expect(company!.companyId, 'c1');
    expect(company.currency, 'RUB');
    expect(company.companyName, 'Acme Ltd');
    // The derived currency provider sees the backend value too.
    expect(container.read(companyCurrencyProvider), 'RUB');
  });

  test('load failure keeps the null state (offline fallback path)', () async {
    final adapter = _ScriptedAdapter((o, i) => ResponseBody.fromString(
          '{"message":"server error"}',
          500,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        ));
    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(_clientWith(adapter))],
    );
    addTearDown(container.dispose);

    await container
        .read(companyProvider.notifier)
        .load(container.read(apiClientProvider));

    expect(container.read(companyProvider), isNull);
    expect(container.read(companyCurrencyProvider), 'KZT');
  });

  test('applyFromBackend updates state; unsupported codes fall back to KZT',
      () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.read(companyProvider.notifier).applyFromBackend({
      'companyId': 'c1',
      'currency': 'RUB',
      'companyName': 'Acme Ltd',
    });
    expect(container.read(companyProvider)!.currency, 'RUB');
    expect(container.read(companyCurrencyProvider), 'RUB');

    container.read(companyProvider.notifier).applyFromBackend({
      'companyId': 'c1',
      'currency': 'BTC', // not in CurrencyCatalog
      'companyName': 'Acme Ltd',
    });
    expect(container.read(companyProvider)!.currency, 'KZT');
  });
}
