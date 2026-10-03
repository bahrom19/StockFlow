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

      final saleNumber = await queue.enqueueCreateSale(request: request());

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

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 2 — CREATE_SALE at the hard cap.
  //
  // Data-safety contract: the POS must be able to tell that the sale was NOT
  // persisted, so it can keep the cart. Reporting "saved offline" here would
  // make the caller discard a sale that exists nowhere.
  // ───────────────────────────────────────────────────────────────────────
  group('Phase 2 — CREATE_SALE capacity refusal', () {
    test('throws OutboxCapacityExceeded at the hard cap and persists nothing',
        () async {
      final (container, controller) = await harness();
      final queue = container.read(offlineSaleQueueProvider);

      for (var i = 0; i < OutboxController.hardCapacityLimit; i++) {
        await controller.enqueue(OutboxOperation(
          clientOperationId: 'seed-$i',
          kind: OutboxOperationKind.createSale,
          companyId: 'company-1',
          userId: 'user-1',
          payload: {'saleNumber': 'OFF-seed-$i'},
          createdAt: DateTime(2026, 1, 1),
        ));
      }
      final before = controller.state.operations.length;

      await expectLater(
        queue.enqueueCreateSale(request: request()),
        throwsA(isA<OutboxCapacityExceeded>()),
      );

      // The sale was NOT parked — the cart must survive.
      expect(controller.state.operations, hasLength(before));
      // Every persisted sale is one of the seeded ones — the refused sale
      // left no trace anywhere.
      expect(
        controller.state.operations
            .where((o) =>
                (o.payload['saleNumber'] as String).startsWith('OFF-seed-'))
            .length,
        before,
      );
    });

    test('below the hard cap the sale still enqueues normally', () async {
      final (container, controller) = await harness();
      final queue = container.read(offlineSaleQueueProvider);

      final saleNumber = await queue.enqueueCreateSale(request: request());

      expect(saleNumber, startsWith('OFF-'));
      expect(controller.state.operations, hasLength(1));
    });
  });
}
