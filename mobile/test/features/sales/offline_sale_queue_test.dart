import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';
import 'package:stockflow/features/sales/data/offline_sale_queue.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  const testUser = CurrentUser(
    id: 'user-1',
    email: 'cashier@stockflow.test',
    companyId: 'company-1',
  );

  CreateSaleRequest request() {
    return CreateSaleRequest(
      warehouseId: 'warehouse-1',
      items: const [
        CreateSaleItem(productId: 'p1', quantity: 2, unitPrice: 100),
      ],
      payments: const [CreatePayment(method: 'CASH', amount: 200)],
    );
  }

  Future<(ProviderContainer, OutboxController)> harness({
    CurrentUser? user = testUser,
  }) async {
    final prefs = PreferencesStorage();
    await prefs.initialize();
    final controller = OutboxController(OutboxStorage(prefs));
    final container = ProviderContainer(
      overrides: [
        if (user != null) currentUserProvider.overrideWithValue(user),
        outboxControllerProvider.overrideWith((ref) => controller),
      ],
    );
    addTearDown(container.dispose);
    return (container, controller);
  }

  group('OfflineSaleQueue (Offline 1B-min: CREATE_SALE only)', () {
    test('offline CREATE_SALE is saved locally with a client OFF- saleNumber',
        () async {
      final (container, controller) = await harness();
      final queue = container.read(offlineSaleQueueProvider);

      final saleNumber =
          await queue.enqueueCreateSale(request: request());

      expect(saleNumber, startsWith('OFF-'));
      final op = controller.state.operations.single;
      expect(op.kind, OutboxOperationKind.createSale);
      expect(op.status, OutboxStatus.pending);
      // The client saleNumber IS the server-side dedup key — it must be in
      // the payload that goes to POST /sales verbatim.
      expect(op.payload['saleNumber'], saleNumber);
      // Scope is captured from the authenticated user.
      expect(op.companyId, testUser.companyId);
      expect(op.userId, testUser.id);
    });

    test('no HTTP happens during enqueue — the payload is parked locally',
        () async {
      // Structural guarantee: OfflineSaleQueue has no ApiClient dependency —
      // the request body is persisted and sent later by OutboxSyncService.
      final (container, controller) = await harness();
      final queue = container.read(offlineSaleQueueProvider);

      await queue.enqueueCreateSale(request: request());

      // The op is durable in memory right away; restart survival is covered
      // by the storage tests.
      expect(controller.state.operations, hasLength(1));
    });

    test('two offline sales receive two different client saleNumbers',
        () async {
      final (container, controller) = await harness();
      final queue = container.read(offlineSaleQueueProvider);

      final first = await queue.enqueueCreateSale(request: request());
      final second = await queue.enqueueCreateSale(request: request());

      expect(first, isNot(second));
      expect(controller.state.operations, hasLength(2));
    });

    test('re-enqueueing the same clientOperationId does not duplicate the op',
        () async {
      final (container, controller) = await harness();
      final queue = container.read(offlineSaleQueueProvider);

      await queue.enqueueCreateSale(
        request: request(),
        clientOperationId: 'same-operation',
      );
      await queue.enqueueCreateSale(
        request: request(),
        clientOperationId: 'same-operation',
      );

      expect(controller.state.operations, hasLength(1));
    });

    test('throws when there is no authenticated user (must never leak scope)',
        () async {
      final (container, _) = await harness(user: null);
      final queue = container.read(offlineSaleQueueProvider);

      expect(
        () => queue.enqueueCreateSale(request: request()),
        throwsStateError,
      );
    });
  });
}