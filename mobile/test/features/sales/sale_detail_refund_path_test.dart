import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/features/sales/presentation/screens/sale_detail_screen.dart';

/// G16-N-2 — user-facing refund path (Test C).
///
/// The REAL sale-detail screen is pumped against a capturing [ApiClient]:
/// - the full-refund and partial-return actions must invoke the canonical
///   `POST /sales/:id/refund` (with an Idempotency-Key);
/// - they must NEVER call `PATCH /sales/:id/status` with REFUNDED /
///   PARTIALLY_REFUNDED (the backend rejects refund statuses there);
/// - a user retry after a lost response reuses the SAME key.
class _RefundSpyApi extends ApiClient {
  _RefundSpyApi() : super(tokenStorage: TokenStorage());

  final postCalls = <({String path, Object? data, Options? options})>[];
  final patchCalls = <String>[];
  int failuresRemaining = 0;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: _saleJson() as T,
    );
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    postCalls.add((path: path, data: data, options: options));
    if (failuresRemaining > 0) {
      failuresRemaining--;
      throw DioException(
        requestOptions: RequestOptions(path: path),
        type: DioExceptionType.badResponse,
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: path),
          statusCode: 500,
          data: {'message': 'Server error'},
        ),
      );
    }
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: <String, dynamic>{} as T,
    );
  }

  @override
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    patchCalls.add(path);
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: _saleJson() as T,
    );
  }
}

Map<String, dynamic> _saleJson() => {
      'id': 's1',
      'companyId': 'c1',
      'warehouseId': 'w1',
      'cashierId': 'u1',
      'saleNumber': 'S-1001',
      'status': 'COMPLETED',
      'subtotal': '150.00',
      'discount': '0',
      'tax': '0',
      'total': '150.00',
      'paidAmount': '150.00',
      'changeAmount': '0',
      'currency': 'KZT',
      'rowVersion': 0,
      'createdAt': '2026-08-16T12:00:00Z',
      'updatedAt': '2026-08-16T12:00:00Z',
      'items': [
        {
          'id': 'i1',
          'saleId': 's1',
          'productId': 'a1b2c3d4e5f6a7b8c9d0e1f2',
          'quantity': 3,
          'unitPrice': '50.00',
          'costPrice': '20.00',
          'discount': '0',
          'subtotal': '150.00',
          'total': '150.00',
          'margin': '90.00',
          'createdAt': '2026-08-16T12:00:00Z',
          'updatedAt': '2026-08-16T12:00:00Z',
        },
      ],
    };

Future<void> _pump(WidgetTester tester, _RefundSpyApi api) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWith((ref) => api)],
      child: const MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: SaleDetailScreen(saleId: 's1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Lets a shown SnackBar's auto-dismiss timer fire so no timer is left
/// pending at the end of the test.
Future<void> _drainSnackbars(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 5));
  await tester.pumpAndSettle();
}

String? _keyOf(_RefundSpyApi api, int index) {
  final options = api.postCalls[index].options;
  return options?.headers?['Idempotency-Key'] as String?;
}

void main() {
  testWidgets(
      'full-refund action invokes the canonical keyed refund endpoint and never PATCHes refund status',
      (tester) async {
    final api = _RefundSpyApi();
    await _pump(tester, api);

    await tester.tap(find.byTooltip('Full refund'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Refund'));
    await tester.pumpAndSettle();

    expect(api.postCalls, hasLength(1));
    expect(api.postCalls.single.path, '/sales/s1/refund');
    expect(_keyOf(api, 0), isNotNull);
    expect(_keyOf(api, 0), isNotEmpty);
    // THE G16-N-2 assertion: refund status is never fabricated via PATCH.
    expect(api.patchCalls, isEmpty);
    expect(find.text('Sale refunded'), findsOneWidget);

    await _drainSnackbars(tester);
  });

  testWidgets(
      'partial-return action posts explicit quantities to the canonical refund endpoint',
      (tester) async {
    final api = _RefundSpyApi();
    await _pump(tester, api);

    await tester.tap(find.byTooltip('Partial return'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '1');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm return'));
    await tester.pumpAndSettle();

    expect(api.postCalls, hasLength(1));
    expect(api.postCalls.single.path, '/sales/s1/refund');
    final wire = jsonDecode(
            jsonEncode(api.postCalls.single.data! as Map<String, dynamic>))
        as Map<String, dynamic>;
    expect(wire['items'], [
      {'saleItemId': 'i1', 'quantity': 1},
    ]);
    expect(_keyOf(api, 0), isNotNull);
    expect(api.patchCalls, isEmpty);
    expect(find.text('Partial return recorded'), findsOneWidget);

    await _drainSnackbars(tester);
  });

  testWidgets(
      'a user retry after a lost response reuses the SAME idempotency key',
      (tester) async {
    final api = _RefundSpyApi()..failuresRemaining = 1;
    await _pump(tester, api);

    // Attempt 1 — transport-level failure (500): unknown outcome.
    await tester.tap(find.byTooltip('Full refund'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Refund'));
    await tester.pumpAndSettle();

    // Attempt 2 — the user retries the same logical submission.
    await tester.tap(find.byTooltip('Full refund'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Refund'));
    await tester.pumpAndSettle();

    expect(api.postCalls, hasLength(2));
    expect(_keyOf(api, 0), isNotNull);
    expect(_keyOf(api, 1), _keyOf(api, 0)); // immutable per logical submit
    expect(api.patchCalls, isEmpty);

    // The success SnackBar is queued behind attempt 1's error SnackBar —
    // drain the queue first, then assert the committed/replayed outcome.
    await _drainSnackbars(tester);
    expect(find.text('Sale refunded'), findsOneWidget);
  });
}
