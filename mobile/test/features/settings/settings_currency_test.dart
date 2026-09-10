import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/company/company_provider.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/features/settings/presentation/screens/settings_screen.dart';

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

ResponseBody _json(int status, Map<String, dynamic> body) =>
    ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

Future<ProviderContainer> _pumpCurrencySettings(
  WidgetTester tester,
  _ScriptedAdapter adapter,
) async {
  SharedPreferences.setMockInitialValues({});
  final dio = Dio(BaseOptions(baseUrl: 'https://api.test'));
  dio.httpClientAdapter = adapter;
  final api = ApiClient(
    tokenStorage: _FakeTokenStorage(),
    dio: dio,
    refreshDio: Dio(),
    retryDelay: Duration.zero, // keep tests fast; prod keeps 1s/2s/3s
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(
          const CurrentUser(
            id: 'u1',
            email: 'alice@stockflow.test',
            firstName: 'Alice',
            lastName: 'Smith',
            companyId: 'c1',
          ),
        ),
        apiClientProvider.overrideWithValue(api),
        companyProvider.overrideWith((ref) {
          final notifier = CompanyNotifier();
          notifier.applyFromBackend(
            {'companyId': 'c1', 'currency': 'KZT', 'companyName': 'Test Co'},
          );
          return notifier;
        }),
      ],
      child: const MaterialApp(
        locale: Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: SettingsScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(tester.element(find.byType(SettingsScreen)));
}

void main() {
  testWidgets(
      'Currency picker PATCHes /companies/me and applies the backend response',
      (tester) async {
    final adapter = _ScriptedAdapter((o, i) => _json(200, {
          'companyId': 'c1',
          'currency': 'RUB',
          'companyName': 'Test Co',
        }));
    final container = await _pumpCurrencySettings(tester, adapter);

    // Tile defaults to KZT (company-backed).
    expect(find.text('Currency'), findsOneWidget);
    expect(find.text('KZT ₸'), findsOneWidget);

    // Open the currency picker — all 8 backend codes listed.
    // (KZT ₸ appears twice while the dialog is open: tile subtitle + list item.)
    await tester.tap(find.text('Currency'));
    await tester.pumpAndSettle();
    expect(find.text('KZT ₸'), findsWidgets);
    expect(find.text('RUB ₽'), findsWidgets);
    expect(find.text(r'USD $'), findsWidgets);
    expect(find.text('EUR €'), findsWidgets);
    expect(find.text('CNY ¥'), findsWidgets);
    expect(find.text('AED د.إ'), findsWidgets);
    expect(find.text(r'AUD A$'), findsWidgets);
    expect(find.text('VND ₫'), findsWidgets);
    expect(
      find.text(
          'Currency can only be changed before any financial data is created.'),
      findsOneWidget,
    );

    // Select RUB.
    await tester.tap(find.text('RUB ₽'));
    await tester.pumpAndSettle();

    // PATCH went to the backend with the selected code.
    expect(adapter.requests, hasLength(1));
    expect(adapter.requests.single.method, 'PATCH');
    expect(adapter.requests.single.path, '/companies/me');
    final body = adapter.requests.single.data.toString();
    expect(body, contains('currency'));
    expect(body, contains('RUB'));

    // Backend response applied: CompanyProvider updated, CurrencyProvider
    // re-derived, and the app_currency cache written through.
    expect(container.read(companyProvider)!.currency, 'RUB');
    expect(container.read(currencyProvider), 'RUB');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('app_currency'), 'RUB');
  });

  testWidgets('Locked company (HTTP 400) — state and cache stay untouched',
      (tester) async {
    final adapter = _ScriptedAdapter((o, i) => _json(400, {
          'message':
              'Cannot change currency: company has existing financial data',
        }));
    final container = await _pumpCurrencySettings(tester, adapter);

    await tester.tap(find.text('Currency'));
    await tester.pumpAndSettle();
    await tester.tap(find.text(r'USD $'));
    await tester.pumpAndSettle();

    // The change was attempted against the backend…
    expect(adapter.requests, hasLength(1));
    // …and rejected: the existing currencyLocked message is presented.
    expect(
      find.text(
          'Currency can only be changed before any financial data is created.'),
      findsWidgets,
    );

    // CompanyProvider, CurrencyProvider and the cache stay on KZT.
    expect(container.read(companyProvider)!.currency, 'KZT');
    expect(container.read(currencyProvider), 'KZT');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('app_currency'), isNull);
  });
}
