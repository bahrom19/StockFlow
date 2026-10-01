import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/features/sales/data/repositories/sales_repository.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

/// G16-N-2 — refund transport contract (Test A).
///
/// Capturing [ApiClient] stand-in: records every POST verbatim WITHOUT any
/// network I/O, mirroring the `_SpyApi` pattern of
/// `mutation_idempotency_transport_test.dart`. Verifies that the canonical
/// `POST /sales/:id/refund` composes the `Idempotency-Key` header through the
/// shared `idempotencyHeader()` helper exactly like create/complete do.
class _SpyRefundApi extends ApiClient {
  _SpyRefundApi() : super(tokenStorage: TokenStorage());

  final calls = <({String path, Object? data, Options? options})>[];

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    calls.add((path: path, data: data, options: options));
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: <String, dynamic>{} as T,
    );
  }
}

void main() {
  group('G16-N-2 — refund transport contract (POST /sales/:id/refund)', () {
    test('refund carries the supplied Idempotency-Key header', () async {
      final api = _SpyRefundApi();
      final repo = SalesRepository(api);

      final result = await repo.refund('sale-1', idempotencyKey: 'key-abc');

      expect(result, isA<SalesSuccess<void>>());
      expect(api.calls, hasLength(1));
      final call = api.calls.single;
      expect(call.path, '/sales/sale-1/refund');
      expect(call.options?.headers?['Idempotency-Key'], 'key-abc');
    });

    test('header value equals the supplied key exactly', () async {
      final api = _SpyRefundApi();
      final repo = SalesRepository(api);

      await repo.refund('sale-1', idempotencyKey: 'immutable-key-42');

      expect(api.calls.single.options?.headers?['Idempotency-Key'],
          'immutable-key-42');
    });

    test('full refund (no request) sends a null body — backend refunds all remaining',
        () async {
      final api = _SpyRefundApi();
      final repo = SalesRepository(api);

      await repo.refund('sale-1', idempotencyKey: 'key-abc');

      expect(api.calls.single.data, isNull);
    });

    test('partial refund sends explicit items and no money fields', () async {
      final api = _SpyRefundApi();
      final repo = SalesRepository(api);

      await repo.refund(
        'sale-1',
        idempotencyKey: 'key-abc',
        request: const RefundSaleRequest(items: [
          RefundItem(saleItemId: 'item-1', quantity: 2),
        ]),
      );

      final raw = api.calls.single.data! as Map<String, dynamic>;
      // Assert the actual wire payload (freezed nests elements that toJson
      // themselves during JSON encoding, exactly like CreateSaleRequest).
      final wire = jsonDecode(jsonEncode(raw)) as Map<String, dynamic>;
      expect(wire['items'], [
        {'saleItemId': 'item-1', 'quantity': 2},
      ]);
      // Server-derived contract: the client never sends money/cost.
      expect(wire.containsKey('unitPrice'), isFalse);
      expect(wire.containsKey('total'), isFalse);
      expect(wire.containsKey('fifoCost'), isFalse);
    });

    test('no key means no Idempotency-Key header (legacy contract)', () async {
      final api = _SpyRefundApi();
      final repo = SalesRepository(api);

      await repo.refund('sale-1');

      expect(api.calls.single.options, isNull);
    });
  });
}
