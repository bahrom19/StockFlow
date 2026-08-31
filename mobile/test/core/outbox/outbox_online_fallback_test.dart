import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_mutation_queue.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

/// Domain-free stand-in for a repository result, so the F5-A queue contract
/// is verified without coupling to any feature's sealed result types. The
/// call-site wiring is covered by the feature-level suite.
sealed class FakeResult {
  const FakeResult();
}

class FakeOk extends FakeResult {
  const FakeOk();
}

class FakeErr extends FakeResult {
  const FakeErr(this.error);

  final Failure error;
}

/// The same predicate shape the production call sites pass: a result is a
/// transport-level failure exactly when the existing ErrorHandler mapped it
/// to [NetworkFailure] (timeout / network / connection error).
bool fakeIsNetworkFailure(FakeResult result) =>
    result is FakeErr && result.error is NetworkFailure;

/// Capturing stand-in for the network boundary used by [OutboxSyncService]:
/// records the path, body, query and Idempotency-Key of every POST and
/// answers 200 OK — enough to verify the replay contract end-to-end.
class PostSpy {
  final calls = <({
    String path,
    Object? data,
    Map<String, dynamic>? query,
    String? key,
  })>[];

  Future<dynamic> call(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
  }) async {
    calls.add((
      path: path,
      data: data,
      query: query,
      key: headers?['Idempotency-Key'],
    ));
    return const <String, dynamic>{'ok': true};
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

  group('OutboxMutationQueue.mutate — Phase F5-A online fallback', () {
    test('online success → OutboxMutationSent, outbox untouched (no enqueue)',
        () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      final seen = <String>[];

      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.adjustStock,
        payload: const {'productId': 'p1', 'quantity': 5},
        online: true,
        clientOperationId: 'key-ok',
        sendOnline: (key) async {
          seen.add(key);
          return const FakeOk();
        },
        isNetworkFailure: fakeIsNetworkFailure,
      );

      expect(outcome, isA<OutboxMutationSent<FakeResult>>());
      expect(seen, ['key-ok']);
      expect(controller.state.operations, isEmpty);
    });

    test('timeout → enqueue under the SAME key; idempotencyKey == '
        'clientOperationId; NO new UUID minted on the fallback', () async {
      final originalGenerator = OutboxOperation.idGenerator;
      var mints = 0;
      OutboxOperation.idGenerator = () {
        mints++;
        return 'MINTED-$mints';
      };
      addTearDown(() => OutboxOperation.idGenerator = originalGenerator);

      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      final seen = <String>[];

      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.cashIn,
        payload: const {'amount': 100.0, 'warehouseId': 'wh-1'},
        online: true,
        sendOnline: (key) async {
          seen.add(key);
          return const FakeErr(
            NetworkFailure(message: 'Connection timeout.'),
          );
        },
        isNetworkFailure: fakeIsNetworkFailure,
      );

      expect(outcome, isA<OutboxMutationQueued<FakeResult>>());
      final op = controller.state.operations.single;
      expect(op.kind, OutboxOperationKind.cashIn);
      expect(op.status, OutboxStatus.pending);
      // EXACTLY the key the failed online attempt transported — no fresh UUID.
      expect(seen, hasLength(1));
      expect(op.clientOperationId, seen.single);
      expect(op.idempotencyKey, seen.single);
      // THE invariant.
      expect(op.idempotencyKey, op.clientOperationId);
      // One mint total: the initial online key. The fallback minted nothing.
      expect(mints, 1);
    });

    test('connection error → enqueue under the SAME key', () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      final seen = <String>[];

      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.transferStock,
        payload: const {'productId': 'p1', 'quantity': 2},
        online: true,
        sendOnline: (key) async {
          seen.add(key);
          return const FakeErr(NetworkFailure(message: 'No internet.'));
        },
        isNetworkFailure: fakeIsNetworkFailure,
      );

      expect(outcome, isA<OutboxMutationQueued<FakeResult>>());
      final op = controller.state.operations.single;
      expect(op.kind, OutboxOperationKind.transferStock);
      expect(op.clientOperationId, seen.single);
      expect(op.idempotencyKey, op.clientOperationId);
    });

    test('business errors 400/404/409/422 → NOT enqueued', () async {
      final businessFailures = <Failure>[
        const ValidationFailure(message: 'bad request'),
        const NotFoundFailure(message: 'not found'),
        const ConflictFailure(message: 'conflict'),
        const ValidationFailure(message: 'unprocessable'),
      ];

      for (final failure in businessFailures) {
        final (container, controller, _) = await harness();
        final queue = container.read(outboxMutationQueueProvider);

        final outcome = await queue.mutate<FakeResult>(
          kind: OutboxOperationKind.cashOut,
          payload: const {'amount': 10.0, 'warehouseId': 'wh-1'},
          online: true,
          clientOperationId: 'key-${failure.message}',
          sendOnline: (_) async => FakeErr(failure),
          isNetworkFailure: fakeIsNetworkFailure,
        );

        expect(outcome, isA<OutboxMutationSent<FakeResult>>(),
            reason: '${failure.runtimeType} must NOT fall back to the outbox');
        expect(controller.state.operations, isEmpty,
            reason: '${failure.runtimeType} must not be parked');
      }
    });

    test('no classifier → online failure keeps the F4-D inline contract',
        () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);

      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.adjustStock,
        payload: const {'productId': 'p1'},
        online: true,
        sendOnline: (_) async =>
            const FakeErr(NetworkFailure(message: 'Connection timeout.')),
      );

      expect(outcome, isA<OutboxMutationSent<FakeResult>>());
      expect(controller.state.operations, isEmpty);
    });

    test('repeated fallback for the SAME key is deduped (existing dedupe '
        'preserved)', () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);

      Future<OutboxMutationOutcome<FakeResult>> attempt() =>
          queue.mutate<FakeResult>(
            kind: OutboxOperationKind.goodsReceipt,
            payload: const {'purchaseOrderId': 'po-1'},
            online: true,
            clientOperationId: 'dup-1',
            sendOnline: (_) async =>
                const FakeErr(NetworkFailure(message: 'No internet.')),
            isNetworkFailure: fakeIsNetworkFailure,
          );

      await attempt();
      final second = await attempt();

      expect(controller.state.operations, hasLength(1));
      expect(
        (second as OutboxMutationQueued<FakeResult>).clientOperationId,
        'dup-1',
      );
    });

    test('fallback without an authenticated user → rejected, nothing parked',
        () async {
      final (container, controller, _) = await harness(user: null);
      final queue = container.read(outboxMutationQueueProvider);

      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.adjustStock,
        payload: const {'productId': 'p1'},
        online: true,
        sendOnline: (_) async =>
            const FakeErr(NetworkFailure(message: 'Connection timeout.')),
        isNetworkFailure: fakeIsNetworkFailure,
      );

      expect(outcome, isA<OutboxMutationRejected<FakeResult>>());
      expect(controller.state.operations, isEmpty);
    });

    test('every keyed kind falls back with its own kind and key', () async {
      for (final kind in OutboxOperationKind.values) {
        // CREATE_SALE is deliberately excluded: it never goes through the
        // mutation queue (guarded separately below).
        if (kind == OutboxOperationKind.createSale) continue;
        final (container, controller, _) = await harness();
        final queue = container.read(outboxMutationQueueProvider);

        final outcome = await queue.mutate<FakeResult>(
          kind: kind,
          payload: const {'x': 1},
          online: true,
          clientOperationId: 'key-${kind.name}',
          sendOnline: (_) async =>
              const FakeErr(NetworkFailure(message: 'Connection timeout.')),
          isNetworkFailure: fakeIsNetworkFailure,
        );

        expect(outcome, isA<OutboxMutationQueued<FakeResult>>());
        final op = controller.state.operations.single;
        expect(op.kind, kind);
        expect(op.clientOperationId, 'key-${kind.name}');
        expect(op.idempotencyKey, op.clientOperationId);
      }
    });

  });

  group('F5-A E2E: POST(key=A) timeout → enqueue(A) → restart → flush', () {
    test('cash fallback survives a restart, replays the SAME key exactly '
        'once, and keeps the cash query/body contract', () async {
      final (container, _, storage) = await harness();
      final queue = container.read(outboxMutationQueueProvider);

      // 1) ONLINE attempt POST(key=A) → timeout → fallback.
      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.cashIn,
        payload: const {
          'amount': 100.0,
          'reason': 'float',
          'warehouseId': 'wh-1',
        },
        online: true,
        clientOperationId: 'A',
        sendOnline: (_) async =>
            const FakeErr(NetworkFailure(message: 'Connection timeout.')),
        isNetworkFailure: fakeIsNetworkFailure,
      );
      expect(outcome, isA<OutboxMutationQueued<FakeResult>>());
      expect(container.read(outboxControllerProvider).operations.single
          .idempotencyKey, 'A');

      // 2) Fresh controller over the SAME persisted storage == app restart.
      final restarted = OutboxController(storage);
      await restarted.hydrate();
      final op = restarted.state.operations.single;
      expect(op.clientOperationId, 'A');
      expect(op.idempotencyKey, 'A');
      expect(op.kind, OutboxOperationKind.cashIn);

      // 3) Flush replays POST(key=A) exactly once.
      final spy = PostSpy();
      final sync = OutboxSyncService(
        controller: restarted,
        post: spy.call,
        currentUser: () => testUser,
        isOnline: () => true,
      );
      final first = await sync.syncAll();
      expect(first.sent, 1);
      final call = spy.calls.single;
      expect(call.path, '/sales/cash-shifts/cash-in');
      // warehouseId rides as the query — built by the spec from the payload.
      expect(call.query, {'warehouseId': 'wh-1'});
      // …and NEVER leaks into the body (backend whitelist).
      expect(call.data, {'amount': 100.0, 'reason': 'float'});
      expect((call.data as Map).containsKey('warehouseId'), isFalse);
      // The Outbox retry transports the ORIGINAL key — never a new UUID.
      expect(call.key, 'A');
      expect(restarted.state.operations, isEmpty);

      // 4) Repeated flush performs NO second request (no duplicate replay).
      final second = await sync.syncAll();
      expect(second.sent, 0);
      expect(second.duplicates, 0);
      expect(spy.calls, hasLength(1));
    });

    test('CREATE_SALE contract unchanged: verbatim body, NO Idempotency-Key',
        () async {
      final (container, controller, _) = await harness();
      // Raw enqueue — the CREATE_SALE path is untouched by F5-A: no mutation
      // queue, no Idempotency-Key header, verbatim payload.
      await controller.enqueue(const OutboxOperation(
        clientOperationId: 'sale-1',
        kind: OutboxOperationKind.createSale,
        companyId: 'company-1',
        userId: 'user-1',
        payload: {'saleNumber': 'OFF-1', 'items': <Object>[]},
      ));

      final spy = PostSpy();
      final sync = OutboxSyncService(
        controller: controller,
        post: spy.call,
        currentUser: () => testUser,
        isOnline: () => true,
      );
      final result = await sync.syncAll();

      expect(result.sent, 1);
      expect(spy.calls.single.path, '/sales');
      // No key on CREATE_SALE — replay safety stays the client-generated
      // saleNumber; the /sales duplicate contract is untouched by F5-A.
      expect(spy.calls.single.key, isNull);
      expect((spy.calls.single.data as Map)['saleNumber'], 'OFF-1');
      expect(controller.state.operations, isEmpty);
    });
  });
}
