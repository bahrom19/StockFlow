import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_mutation_queue.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';
import 'package:stockflow/core/services/connectivity_service.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';
import 'package:stockflow/features/purchasing/data/repositories/purchasing_repository.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';

/// Capturing [ApiClient] stand-in. POST fails with a configurable
/// [DioException] (default: success) so the REAL ErrorHandler classification
/// runs on every attempt; GET answers 404 (only used by `loadShift`, which
/// maps it to "no open shift").
class _SpyApi extends ApiClient {
  _SpyApi({Object? successData})
      : _successData = successData,
        super(tokenStorage: TokenStorage());

  final Object? _successData;
  DioException Function(String path)? failWith;

  final calls = <(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    String? key,
  })>[];

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    calls.add((
      path,
      data: data,
      query: queryParameters,
      key: options?.headers?['Idempotency-Key'] as String?,
    ));
    final fail = failWith;
    if (fail != null) throw fail(path);
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: _successData as T?,
    );
  }

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw _httpError(404, path, 'not found');
  }
}

DioException _timeout(String path) => DioException(
      requestOptions: RequestOptions(path: path),
      type: DioExceptionType.connectionTimeout,
      error: 'connection timeout',
    );

DioException _httpError(int statusCode, String path, String message) =>
    DioException(
      requestOptions: RequestOptions(path: path),
      type: DioExceptionType.badResponse,
      response: Response<Map<String, dynamic>>(
        requestOptions: RequestOptions(path: path),
        statusCode: statusCode,
        data: {'message': message},
      ),
    );

/// Offline-capable fake for the connectivity_plus facade — the service was
/// explicitly built to accept it in tests; no platform channels are touched.
class _FakeConnectivity implements Connectivity {
  const _FakeConnectivity();

  @override
  Future<List<ConnectivityResult>> checkConnectivity() async =>
      [ConnectivityResult.wifi];

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged =>
      const Stream.empty();
}

void main() {
  const testUser = CurrentUser(
    id: 'user-1',
    email: 'cashier@stockflow.test',
    companyId: 'company-1',
  );

  const movementJson = <String, dynamic>{
    'id': 'm1',
    'companyId': 'company-1',
    'productId': 'p1',
    'warehouseId': 'wh-1',
    'type': 'ADJUSTMENT',
    'quantity': 5,
    'beforeQuantity': 10,
    'afterQuantity': 15,
    'createdAt': '2026-08-31T00:00:00Z',
  };

  Future<(ProviderContainer, _SpyApi, OutboxController, OutboxStorage)>
      harness({
    Object? successData,
    DioException Function(String path)? failWith,
  }) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = PreferencesStorage();
    await prefs.initialize();
    final storage = OutboxStorage(prefs);
    final controller = OutboxController(storage);
    final spy = _SpyApi(successData: successData)..failWith = failWith;
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(spy),
        connectivityServiceProvider.overrideWith(
          (ref) => ConnectivityService(connectivity: const _FakeConnectivity()),
        ),
        currentUserProvider.overrideWithValue(testUser),
        outboxControllerProvider.overrideWith((ref) => controller),
      ],
    );
    addTearDown(container.dispose);
    return (container, spy, controller, storage);
  }

  group('CashShiftNotifier — F5-A online failure fallback', () {
    test('timeout → parked under the SAME key the failed POST carried',
        () async {
      final (container, spy, controller, _) = await harness(failWith: _timeout);
      final notifier = container.read(cashShiftProvider.notifier);
      await notifier.loadShift('wh-1');

      final result = await notifier.cashIn(100, reason: 'float');

      expect(result, isNull);
      // The ONLINE attempt happened exactly once and failed.
      expect(spy.calls, hasLength(1));
      final attemptedKey = spy.calls.single.key;
      expect(attemptedKey, isNotNull);

      // Fallback parked the operation in the outbox…
      final op = controller.state.operations.single;
      expect(op.kind, OutboxOperationKind.cashIn);
      expect(op.status, OutboxStatus.pending);
      // …under EXACTLY the failed attempt's key — no new UUID minted.
      expect(op.idempotencyKey, attemptedKey);
      expect(op.clientOperationId, attemptedKey);
      expect(op.idempotencyKey, op.clientOperationId);
      // Cash contract: warehouseId travels in the payload (the outbox spec
      // builds the query from it).
      expect(op.payload['warehouseId'], 'wh-1');
      // D3 feedback channel unchanged.
      final state = container.read(cashShiftProvider);
      expect(state, isA<ShiftError>());
      expect(
        (state as ShiftError).message,
        OutboxMutationQueue.offlineQueuedMessage,
      );
    });

    test('online 409 → business error surfaces inline, NOT enqueued',
        () async {
      final (container, spy, controller, _) = await harness(
        failWith: (path) => _httpError(409, path, 'shift closed'),
      );
      final notifier = container.read(cashShiftProvider.notifier);
      await notifier.loadShift('wh-1');

      final result = await notifier.cashOut(50);

      expect(result, isNull);
      expect(spy.calls, hasLength(1));
      expect(controller.state.operations, isEmpty); // NEVER parked
      final state = container.read(cashShiftProvider);
      expect(state, isA<ShiftError>());
      expect((state as ShiftError).message, contains('shift closed'));
    });

    test('online success → no enqueue, nothing parked', () async {
      final (container, spy, controller, _) = await harness();
      final notifier = container.read(cashShiftProvider.notifier);
      await notifier.loadShift('wh-1');

      await notifier.cashIn(100, reason: 'float');

      expect(spy.calls, hasLength(1));
      expect(controller.state.operations, isEmpty);
    });
  });

  group('Inventory notifiers — F5-A online failure fallback', () {
    test('adjust timeout → parked under the SAME key with the DTO payload',
        () async {
      final (container, spy, controller, _) = await harness(failWith: _timeout);
      const dto = AdjustStockDto(
        productId: 'p1',
        warehouseId: 'wh-1',
        quantity: 5,
        reason: 'recount',
      );

      final result =
          await container.read(adjustmentProvider.notifier).adjust(dto);

      expect(result, isNull);
      expect(spy.calls, hasLength(1));
      final attemptedKey = spy.calls.single.key;
      expect(attemptedKey, isNotNull);

      final op = controller.state.operations.single;
      expect(op.kind, OutboxOperationKind.adjustStock);
      // SAME key — no new UUID on the fallback.
      expect(op.idempotencyKey, attemptedKey);
      expect(op.clientOperationId, attemptedKey);
      expect(op.idempotencyKey, op.clientOperationId);
      expect(op.payload, dto.toJson());
    });

    test('adjust 422 → business error, NOT enqueued', () async {
      final (container, spy, controller, _) = await harness(
        failWith: (path) => _httpError(422, path, 'unprocessable'),
      );
      const dto = AdjustStockDto(
        productId: 'p1',
        warehouseId: 'wh-1',
        quantity: -999,
      );

      final result =
          await container.read(adjustmentProvider.notifier).adjust(dto);

      expect(result, isNull);
      expect(spy.calls, hasLength(1));
      expect(controller.state.operations, isEmpty);
    });

    test('adjust success → no enqueue', () async {
      final (container, spy, controller, _) =
          await harness(successData: movementJson);
      const dto = AdjustStockDto(
        productId: 'p1',
        warehouseId: 'wh-1',
        quantity: 5,
      );

      final result =
          await container.read(adjustmentProvider.notifier).adjust(dto);

      expect(result, isNotNull); // parsed movement came back
      expect(spy.calls, hasLength(1));
      expect(controller.state.operations, isEmpty);
    });

    test('transfer timeout → parked under the SAME key', () async {
      final (container, spy, controller, _) = await harness(failWith: _timeout);
      const dto = TransferStockDto(
        productId: 'p1',
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-2',
        quantity: 2,
      );

      final result =
          await container.read(transferProvider.notifier).transfer(dto);

      expect(result, isNull);
      expect(spy.calls, hasLength(1));
      final attemptedKey = spy.calls.single.key;
      expect(attemptedKey, isNotNull);

      final op = controller.state.operations.single;
      expect(op.kind, OutboxOperationKind.transferStock);
      expect(op.idempotencyKey, attemptedKey);
      expect(op.clientOperationId, attemptedKey);
      expect(op.idempotencyKey, op.clientOperationId);
      expect(op.payload, dto.toJson());
    });
  });

  group('PurchasingRepository.createGoodsReceipt — F5-A fallback', () {
    CreateGoodsReceiptRequest request() => const CreateGoodsReceiptRequest(
          purchaseOrderId: 'po-1',
          warehouseId: 'wh-1',
          items: [
            CreateGoodsReceiptItem(
              purchaseOrderItemId: 'poi-1',
              productId: 'p1',
              quantity: 3,
              unitCost: 12.5,
            ),
          ],
        );

    test('timeout with key=B → parked under B, verbatim payload, D3 message',
        () async {
      final (container, spy, controller, _) = await harness(failWith: _timeout);
      final queue = OutboxMutationQueue(
        controller: controller,
        currentUser: () => testUser,
      );
      final repo = PurchasingRepository(spy);

      final result = await repo.createGoodsReceipt(
        request(),
        offlineQueue: queue,
        idempotencyKey: 'B',
      );

      // The failed attempt carried key B…
      expect(spy.calls, hasLength(1));
      expect(spy.calls.single.key, 'B');
      // …and the fallback answers through the existing failure channel.
      expect(result, isA<PurchasingFailure<GoodsReceipt>>());
      final failure = (result as PurchasingFailure<GoodsReceipt>).error;
      expect(failure, isA<NetworkFailure>());
      expect(failure.message, OutboxMutationQueue.offlineQueuedMessage);

      final op = controller.state.operations.single;
      expect(op.kind, OutboxOperationKind.goodsReceipt);
      // SAME key — the invariant.
      expect(op.idempotencyKey, 'B');
      expect(op.clientOperationId, 'B');
      expect(op.idempotencyKey, op.clientOperationId);
      // Verbatim payload contract.
      expect(op.payload, request().toJson());
    });

    test('400 → business error inline, NOT enqueued', () async {
      final (container, spy, controller, _) = await harness(
        failWith: (path) => _httpError(400, path, 'bad request'),
      );
      final queue = OutboxMutationQueue(
        controller: controller,
        currentUser: () => testUser,
      );
      final repo = PurchasingRepository(spy);

      final result = await repo.createGoodsReceipt(
        request(),
        offlineQueue: queue,
        idempotencyKey: 'B',
      );

      expect(result, isA<PurchasingFailure<GoodsReceipt>>());
      expect((result as PurchasingFailure<GoodsReceipt>).error,
          isA<ValidationFailure>());
      expect(controller.state.operations, isEmpty);
    });

    test('keyless online timeout → key minted ONCE, '
        'idempotencyKey == clientOperationId', () async {
      final (container, spy, controller, _) = await harness(failWith: _timeout);
      final queue = OutboxMutationQueue(
        controller: controller,
        currentUser: () => testUser,
      );
      final repo = PurchasingRepository(spy);

      await repo.createGoodsReceipt(request(), offlineQueue: queue);

      expect(controller.state.operations, hasLength(1));
      final op = controller.state.operations.single;
      expect(op.idempotencyKey, op.clientOperationId);
      expect(spy.calls, hasLength(1)); // no request retries, one attempt only
    });

    test('E2E: POST(key=B) timeout → enqueue(B) → restart → flush replays '
        'the SAME key verbatim exactly once', () async {
      final (container, spy, _, storage) = await harness(failWith: _timeout);
      final controller = OutboxController(storage);
      final queue = OutboxMutationQueue(
        controller: controller,
        currentUser: () => testUser,
      );
      final repo = PurchasingRepository(spy);

      // 1) ONLINE POST(key=B) → timeout → fallback.
      await repo.createGoodsReceipt(
        request(),
        offlineQueue: queue,
        idempotencyKey: 'B',
      );
      expect(spy.calls.single.key, 'B');

      // 2) Fresh controller over the SAME persisted storage == app restart.
      final restarted = OutboxController(storage);
      await restarted.hydrate();
      expect(restarted.state.operations.single.idempotencyKey, 'B');
      expect(restarted.state.operations.single.clientOperationId, 'B');

      // 3) Flush replays POST(key=B) with the VERBATIM payload, once.
      final flushCalls = <({String path, Object? data, String? key})>[];
      final sync = OutboxSyncService(
        controller: restarted,
        post: (path, {data, query, headers}) async {
          flushCalls
              .add((path: path, data: data, key: headers?['Idempotency-Key']));
          return const <String, dynamic>{'ok': true};
        },
        currentUser: () => testUser,
        isOnline: () => true,
      );
      final first = await sync.syncAll();
      expect(first.sent, 1);
      final call = flushCalls.single;
      expect(call.path, '/purchasing/goods-receipts');
      expect(call.key, 'B'); // ORIGINAL key — never regenerated
      // Verbatim payload (JSON round-tripped through storage → plain maps).
      expect(call.data, <String, dynamic>{
        'purchaseOrderId': 'po-1',
        'warehouseId': 'wh-1',
        'notes': null,
        'items': [
          <String, dynamic>{
            'purchaseOrderItemId': 'poi-1',
            'productId': 'p1',
            'quantity': 3,
            'unitCost': 12.5,
            'notes': null,
          },
        ],
      });
      expect(restarted.state.operations, isEmpty);

      // 4) Repeated flush → zero duplicate requests.
      final second = await sync.syncAll();
      expect(second.sent, 0);
      expect(second.duplicates, 0);
      expect(flushCalls, hasLength(1));
    });
  });
}
