import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_mutation_queue.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';
import 'package:stockflow/features/inventory/data/repositories/inventory_repository.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/purchasing/data/repositories/purchasing_repository.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/features/sales/data/cash_shift_repository.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';

/// Capturing [ApiClient] stand-in: records every POST verbatim WITHOUT any
/// network I/O. Verifies the F4-C/F4-D transport contract (path, query,
/// payload, `Idempotency-Key` header) exactly as the repositories compose it.
class _SpyApi extends ApiClient {
  _SpyApi() : super(tokenStorage: TokenStorage());

  final calls = <(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Options? options,
  })>[];

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    calls.add((path, data: data, query: queryParameters, options: options));
    // Return a schema-compatible response for GoodsReceipt so
    // GoodsReceipt.fromJson does not hit a null-String cast.
    if (path == '/purchasing/goods-receipts') {
      return Response<T>(
        requestOptions: RequestOptions(path: path),
        statusCode: 200,
        data: <String, dynamic>{
          'id': 'gr-1',
          'companyId': 'c1',
          'purchaseOrderId': 'po-1',
          'receiptNumber': 'GR-00001',
          'receiptDate': '2026-08-03T12:00:00Z',
          'warehouseId': 'wh-1',
          'status': 'COMPLETED',
          'notes': null,
          'receivedBy': null,
          'createdAt': '2026-08-03T12:00:00Z',
          'updatedAt': '2026-08-03T12:00:00Z',
          'deletedAt': null,
          'items': <dynamic>[],
        } as T?,
      );
    }
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: const {'id': 'stub'} as T?,
    );
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  const testUser = CurrentUser(
    id: 'user-1',
    email: 'cashier@stockflow.test',
    companyId: 'company-1',
  );

  Future<(ProviderContainer, _SpyApi)> containerWithSpy() async {
    final spy = _SpyApi();
    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(spy)],
    );
    addTearDown(container.dispose);
    return (container, spy);
  }

  group('CashShiftRepository transport (Phase F4-C/D)', () {
    test('online cashIn carries the Idempotency-Key header and the cash query',
        () async {
      final (container, spy) = await containerWithSpy();
      final repo = container.read(cashShiftRepositoryProvider);

      await repo.cashIn(
        warehouseId: 'wh-1',
        request: const CashInOutRequest(amount: 100, reason: 'float'),
        idempotencyKey: 'key-1',
      );

      final call = spy.calls.single;
      expect(call.$1, ApiEndpoints.cashShiftCashIn);
      expect(call.query, {'warehouseId': 'wh-1'});
      // The online payload contract is untouched — warehouseId rides as query.
      expect(call.data, {'amount': 100.0, 'reason': 'float'});
      expect(call.options?.headers?['Idempotency-Key'], 'key-1');
    });

    test('keyless online call (legacy contract) sends NO header', () async {
      final (container, spy) = await containerWithSpy();
      final repo = container.read(cashShiftRepositoryProvider);

      await repo.cashIn(
        warehouseId: 'wh-1',
        request: const CashInOutRequest(amount: 10),
      );

      expect(spy.calls.single.options, isNull);
    });
  });

  group('InventoryRepository transport (Phase F4-C/D)', () {
    test('adjustStock sends the DTO verbatim plus the Idempotency-Key header',
        () async {
      final (container, spy) = await containerWithSpy();
      final repo = container.read(inventoryRepositoryProvider);
      const dto = AdjustStockDto(
        productId: 'p1',
        warehouseId: 'wh-1',
        quantity: 5,
        reason: 'count',
      );

      await repo.adjustStock(dto, idempotencyKey: 'key-2');

      final call = spy.calls.single;
      expect(call.$1, '${ApiEndpoints.inventory}/stock/adjust');
      expect(call.data, dto.toJson()); // payload contract preserved verbatim
      expect(call.options?.headers?['Idempotency-Key'], 'key-2');
    });

    test('transferStock sends the DTO verbatim plus the Idempotency-Key header',
        () async {
      final (container, spy) = await containerWithSpy();
      final repo = container.read(inventoryRepositoryProvider);
      const dto = TransferStockDto(
        productId: 'p1',
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-2',
        quantity: 2,
      );

      await repo.transferStock(dto, idempotencyKey: 'key-3');

      final call = spy.calls.single;
      expect(call.$1, '${ApiEndpoints.inventory}/stock/transfer');
      expect(call.data, dto.toJson());
      expect(call.options?.headers?['Idempotency-Key'], 'key-3');
    });
  });

  group('PurchasingRepository — goodsReceipt (Phase F4-D)', () {
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

    Future<OutboxController> outboxHarness() async {
      final prefs = PreferencesStorage();
      await prefs.initialize();
      return OutboxController(OutboxStorage(prefs));
    }

    test('online createGoodsReceipt posts verbatim payload with the header',
        () async {
      final (container, spy) = await containerWithSpy();
      final repo = PurchasingRepository(spy);

      await repo.createGoodsReceipt(request(), idempotencyKey: 'key-4');

      final call = spy.calls.single;
      expect(call.$1, '/purchasing/goods-receipts');
      expect(call.data, request().toJson()); // verbatim contract
      expect(call.options?.headers?['Idempotency-Key'], 'key-4');
    });

    test('offline createGoodsReceipt parks the op in the outbox, NO http',
        () async {
      final (container, spy) = await containerWithSpy();
      final controller = await outboxHarness();
      final queue = OutboxMutationQueue(
        controller: controller,
        currentUser: () => testUser,
      );
      final repo = PurchasingRepository(spy);

      final result = await repo.createGoodsReceipt(
        request(),
        offlineQueue: queue,
        online: false,
      );

      expect(spy.calls, isEmpty); // nothing left the device
      final op = controller.state.operations.single;
      expect(op.kind, OutboxOperationKind.goodsReceipt);
      expect(op.payload, request().toJson()); // verbatim contract
      expect(op.idempotencyKey, op.clientOperationId);
      // D3: existing generic failure channel carries the offline feedback.
      expect(result, isA<PurchasingFailure<GoodsReceipt>>());
      expect(
        (result as PurchasingFailure<GoodsReceipt>).error.message,
        OutboxMutationQueue.offlineQueuedMessage,
      );
    });

    test('offline goodsReceipt without an authenticated user is rejected',
        () async {
      final (container, spy) = await containerWithSpy();
      final controller = await outboxHarness();
      final queue = OutboxMutationQueue(
        controller: controller,
        currentUser: () => null,
      );
      final repo = PurchasingRepository(spy);

      final result = await repo.createGoodsReceipt(
        request(),
        offlineQueue: queue,
        online: false,
      );

      expect(spy.calls, isEmpty);
      expect(controller.state.operations, isEmpty);
      expect(
        (result as PurchasingFailure<GoodsReceipt>).error.message,
        contains('authenticated user'),
      );
    });
  });
}
