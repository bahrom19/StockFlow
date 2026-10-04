import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_mutation_queue.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

/// Capturing stand-in for the network boundary used by [OutboxSyncService].
class _PostSpy {
  final calls = <(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
  })>[];

  Future<dynamic> call(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
  }) async {
    calls.add((path, data: data, query: query, headers: headers));
    return Response<Map<String, dynamic>>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: const {'id': 'ok'},
    );
  }
}

void main() {
  const testUser = CurrentUser(
    id: 'user-1',
    email: 'cashier@stockflow.test',
    companyId: 'company-1',
  );

  Future<(ProviderContainer, OutboxController, OutboxStorage)> harness({
    CurrentUser? user = testUser,
  }) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = PreferencesStorage();
    await prefs.initialize();
    final storage = OutboxStorage(prefs);
    final controller = OutboxController(storage);
    final container = ProviderContainer(
      overrides: [
        if (user != null) currentUserProvider.overrideWithValue(user),
        outboxControllerProvider.overrideWith((ref) => controller),
      ],
    );
    addTearDown(container.dispose);
    return (container, controller, storage);
  }

  group('OutboxMutationQueue (Phase F4-D)', () {
    test(
        'offline enqueue: idempotencyKey == clientOperationId, scoped, pending',
        () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);

      final outcome = await queue.mutate<int>(
        kind: OutboxOperationKind.adjustStock,
        payload: const {'productId': 'p1', 'quantity': 5},
        online: false,
      );

      expect(outcome, isA<OutboxMutationQueued<int>>());
      final id = (outcome as OutboxMutationQueued<int>).clientOperationId;
      final op = controller.state.operations.single;
      // THE F4 contract: the Idempotency-Key IS the clientOperationId.
      expect(op.clientOperationId, id);
      expect(op.idempotencyKey, id);
      // Scope is captured from the authenticated user.
      expect(op.companyId, testUser.companyId);
      expect(op.userId, testUser.id);
      expect(op.kind, OutboxOperationKind.adjustStock);
      expect(op.status, OutboxStatus.pending);
    });

    test('re-enqueueing the same clientOperationId is deduped (no duplicates)',
        () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);

      final first = await queue.enqueueOffline(
        kind: OutboxOperationKind.cashIn,
        payload: const {'amount': 100.0, 'warehouseId': 'wh-1'},
        clientOperationId: 'fixed-op-id',
      );
      final second = await queue.enqueueOffline(
        kind: OutboxOperationKind.cashIn,
        payload: const {'amount': 100.0, 'warehouseId': 'wh-1'},
        clientOperationId: 'fixed-op-id',
      );

      expect(first, 'fixed-op-id');
      expect(second, 'fixed-op-id');
      expect(controller.state.operations, hasLength(1));
    });

    test('offline without an authenticated user is rejected and stores nothing',
        () async {
      final (container, controller, _) = await harness(user: null);
      final queue = container.read(outboxMutationQueueProvider);

      final outcome = await queue.mutate<int>(
        kind: OutboxOperationKind.cashOut,
        payload: const {'amount': 5.0},
        online: false,
      );

      expect(outcome, isA<OutboxMutationRejected<int>>());
      expect(controller.state.operations, isEmpty);
      await expectLater(
        queue.enqueueOffline(
          kind: OutboxOperationKind.cashOut,
          payload: const {'amount': 5.0},
        ),
        throwsStateError,
      );
    });

    test(
        'cash offline payload carries warehouseId verbatim (spec builds the query from it)',
        () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);

      await queue.enqueueOffline(
        kind: OutboxOperationKind.cashIn,
        payload: const {
          'amount': 100.0,
          'reason': 'float',
          'warehouseId': 'wh-1',
        },
      );

      final op = controller.state.operations.single;
      expect(op.payload, {
        'amount': 100.0,
        'reason': 'float',
        'warehouseId': 'wh-1',
      });
    });

    test('online mutate goes through sendOnline and never touches the outbox',
        () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);

      final outcome = await queue.mutate<String>(
        kind: OutboxOperationKind.adjustStock,
        payload: const {'productId': 'p1'},
        online: true,
        clientOperationId: 'op-fixed',
        sendOnline: (key) async => 'sent:$key',
      );

      expect(outcome, isA<OutboxMutationSent<String>>());
      expect((outcome as OutboxMutationSent<String>).result, 'sent:op-fixed');
      expect(controller.state.operations, isEmpty);
    });

    test('idempotencyHeader: null key → no Options at all; keyed → header',
        () async {
      expect(idempotencyHeader(null), isNull);

      final options = idempotencyHeader('key-abc');
      expect(options, isNotNull);
      expect(options!.headers!['Idempotency-Key'], 'key-abc');
    });

    test(
        'offline → restart → online flush: same key, cash query built, body stripped',
        () async {
      final (container, _, storage) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      final queuedId = await queue.enqueueOffline(
        kind: OutboxOperationKind.cashIn,
        // P2-B-5: enqueueOffline mints the id AFTER the payload is built, so a
        // caller that does not thread it in produces an operation the worker
        // correctly refuses to auto-dispatch. Mirror it explicitly here.
        payload: const {
          'amount': 100.0,
          'warehouseId': 'wh-1',
          'clientOperationId': 'queued-cash-1',
        },
      );

      // Simulate an app restart: a fresh controller hydrated from the SAME
      // persisted storage must restore the operation untouched.
      final restarted = OutboxController(storage);
      await restarted.hydrate();
      expect(restarted.state.operations.single.clientOperationId, queuedId);

      final spy = _PostSpy();
      final sync = OutboxSyncService(
        controller: restarted,
        post: spy.call,
        currentUser: () => testUser,
        isOnline: () => true,
      );
      final result = await sync.syncAll();

      expect(result.sent, 1);
      final call = spy.calls.single;
      expect(call.$1, '/sales/cash-shifts/cash-in');
      // warehouseId rides as the query — built by the spec from the payload.
      expect(call.query, {'warehouseId': 'wh-1'});
      // The SAME key minted at enqueue time is transported as the header.
      expect(call.headers?['Idempotency-Key'], queuedId);
      // The body is the payload minus the query keys (backend whitelist).
      // P2-B-5: `warehouseId` is lifted into the query, but the durable
      // identity is a business field and correctly stays in the body.
      expect(call.data, {
        'amount': 100.0,
        'clientOperationId': 'queued-cash-1',
      });
      expect(restarted.state.operations, isEmpty);
    });

    test(
        'repeated flush after success performs NO second request (no double execution)',
        () async {
      final (container, _, storage) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      await queue.enqueueOffline(
        kind: OutboxOperationKind.cashOut,
        // P2-B-5: durable identity in the payload.
        payload: const {
          'amount': 50.0,
          'warehouseId': 'wh-1',
          'clientOperationId': 'cash-out-1',
        },
      );

      final restarted = OutboxController(storage);
      await restarted.hydrate();
      final spy = _PostSpy();
      final sync = OutboxSyncService(
        controller: restarted,
        post: spy.call,
        currentUser: () => testUser,
        isOnline: () => true,
      );

      final first = await sync.syncAll();
      final second = await sync.syncAll();

      expect(first.sent, 1);
      expect(second.sent, 0);
      expect(second.processed, 0);
      expect(spy.calls, hasLength(1));
    });

    test(
        'goodsReceipt payload is stored verbatim (existing contract preserved)',
        () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      const grPayload = {
        'purchaseOrderId': 'po-1',
        'warehouseId': 'wh-1',
        'items': [
          {'purchaseOrderItemId': 'poi-1', 'productId': 'p1', 'quantity': 3},
        ],
      };

      await queue.enqueueOffline(
        kind: OutboxOperationKind.goodsReceipt,
        payload: grPayload,
      );

      final op = controller.state.operations.single;
      expect(op.kind, OutboxOperationKind.goodsReceipt);
      expect(op.payload, grPayload);
      expect(op.idempotencyKey, op.clientOperationId);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 2 — capacity refusal surfaces as a REJECTION, never
  // as "saved offline". This is the contract the cash/inventory providers
  // already consume via OutboxMutationRejected.
  // ───────────────────────────────────────────────────────────────────────
  group('Phase 2 — capacity refusal propagation', () {
    Future<void> fillToCap(OutboxController controller) async {
      for (var i = 0; i < OutboxController.hardCapacityLimit; i++) {
        await controller.enqueue(OutboxOperation(
          clientOperationId: 'seed-$i',
          kind: OutboxOperationKind.cashIn,
          companyId: testUser.companyId,
          userId: testUser.id,
          payload: const {'amount': 1.0},
          idempotencyKey: 'seed-$i',
          createdAt: DateTime(2026, 1, 1),
        ));
      }
    }

    test('offline mutate at the hard cap => OutboxMutationRejected', () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      await fillToCap(controller);

      final outcome = await queue.mutate<int>(
        kind: OutboxOperationKind.cashIn,
        payload: const {'amount': 100.0, 'warehouseId': 'wh-1'},
        online: false,
      );

      expect(outcome, isA<OutboxMutationRejected<int>>());
      expect((outcome as OutboxMutationRejected<int>).reason,
          contains('OutboxCapacityExceeded'));
      // Nothing was parked and nothing was mutated.
      expect(controller.state.operations, hasLength(200));
    });

    test('enqueueOffline itself throws OutboxCapacityExceeded', () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      await fillToCap(controller);

      await expectLater(
        queue.enqueueOffline(
          kind: OutboxOperationKind.goodsReceipt,
          payload: const {'n': 1},
        ),
        throwsA(isA<OutboxCapacityExceeded>()),
      );
      expect(controller.state.operations, hasLength(200));
    });

    test('an unauthenticated caller still gets StateError, not a refusal',
        () async {
      final (container, _, _) = await harness(user: null);
      final queue = container.read(outboxMutationQueueProvider);

      await expectLater(
        queue.enqueueOffline(
          kind: OutboxOperationKind.cashIn,
          payload: const {'amount': 1.0},
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('a foreign scope at the cap does not block this scope', () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      // Fill a DIFFERENT scope directly on the controller.
      for (var i = 0; i < OutboxController.hardCapacityLimit; i++) {
        await controller.enqueue(OutboxOperation(
          clientOperationId: 'foreign-$i',
          kind: OutboxOperationKind.cashIn,
          companyId: 'other-company',
          userId: 'other-user',
          payload: const {'amount': 1.0},
          idempotencyKey: 'foreign-$i',
          createdAt: DateTime(2026, 1, 1),
        ));
      }

      final outcome = await queue.mutate<int>(
        kind: OutboxOperationKind.cashIn,
        // P2-B-5: mirror the identity so this parked operation is
        // dispatchable on the next burst.
        payload: const {
          'amount': 100.0,
          'clientOperationId': 'second-cash',
        },
        online: false,
      );
      expect(outcome, isA<OutboxMutationQueued<int>>());
    });
  });
}
