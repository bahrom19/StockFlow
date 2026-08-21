import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';
import 'package:stockflow/features/sales/presentation/screens/sale_history_screen.dart';

/// Minimal fake ApiClient that responds to GET /sales so the
/// [SaleHistoryScreen] can be pumped in a widget test.
class _FakeSaleApi extends ApiClient {
  _FakeSaleApi() : super(tokenStorage: TokenStorage());

  List<Map<String, dynamic>> sales = [];

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    if (path == ApiEndpoints.sales) {
      return _respond<T>(
        {'items': sales, 'total': sales.length, 'page': 1, 'limit': 20},
        path,
      );
    }
    throw StateError('No GET stub for $path');
  }

  Response<T> _respond<T>(dynamic data, String path) => Response<T>(
        data: data,
        statusCode: 200,
        requestOptions: RequestOptions(path: path),
      );
}

/// Regression tests for the SaleHistoryScreen lifecycle bug where
/// `GoRouterState.of(context)` was called inside [initState] before the
/// inherited widget was registered, causing:
///   "dependOnInheritedWidgetOfExactType<_ModalScopeStatus>() ... was
///    called before _SaleHistoryScreenState.initState() completed."
void main() {
  group('SaleHistoryScreen lifecycle', () {
    testWidgets(
        'pumps without lifecycle error when GoRouterState is read in initState',
        (tester) async {
      final fake = _FakeSaleApi()..sales = [];

      final router = GoRouter(
        initialLocation: '/sales',
        routes: [
          GoRoute(
            path: '/sales',
            builder: (context, state) => const SaleHistoryScreen(),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiClientProvider.overrideWith((ref) => fake)],
          child: MaterialApp.router(
            routerConfig: router,
            locale: const Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // The post-frame callback ran → loadSales was called → empty list →
      // SaleListEmpty state.
      final container = ProviderScope.containerOf(
          tester.element(find.byType(SaleHistoryScreen)));
      final state = container.read(saleListProvider);
      expect(state, isA<SaleListEmpty>());
    });

    testWidgets(
        'pumps without lifecycle error when customerId query param is present',
        (tester) async {
      final fake = _FakeSaleApi()..sales = [];

      final router = GoRouter(
        initialLocation: '/sales?customerId=c1',
        routes: [
          GoRoute(
            path: '/sales',
            builder: (context, state) => const SaleHistoryScreen(),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiClientProvider.overrideWith((ref) => fake)],
          child: MaterialApp.router(
            routerConfig: router,
            locale: const Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final container = ProviderScope.containerOf(
          tester.element(find.byType(SaleHistoryScreen)));
      final state = container.read(saleListProvider);
      expect(state, isA<SaleListEmpty>());
    });
  });
}
