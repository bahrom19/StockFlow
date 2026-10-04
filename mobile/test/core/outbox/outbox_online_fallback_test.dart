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

/// The same predicate shape the production call sites pass: delegates to the
/// production transport-uncertainty policy
/// ([OutboxMutationQueue.isUncertainOutcome]) so the fallback suite exercises
/// the real rule — timeouts AND transport-uncertain 5xx/408/cancelled park
/// under the transported key, while 429 and definitive 4xx surface inline.
///
/// G16-N-3 P2-A: replaces the earlier NetworkFailure-only mirror, exactly as
/// the cash/inventory call sites did.
bool fakeIsNetworkFailure(FakeResult result) =>
    result is FakeErr && OutboxMutationQueue.isUncertainOutcome(result.error);

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
        // No identity in the payload ON PURPOSE: this test exercises the
        // AUTO-MINT path, where `mutate()` mints the key internally AFTER the
        // payload was built. Such an operation is exactly the legacy shape the
        // P2-B-5 guard refuses to auto-dispatch. It is never flushed here — the
        // assertions are about same-key reuse and a single mint.
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

    test('business errors 400/401/403/404/409/422/429 → NOT enqueued',
        () async {
      final businessFailures = <Failure>[
        const ValidationFailure(message: 'bad request'),
        const AuthFailure(message: 'invalid credentials'),
        const AuthFailure(message: 'permission denied'),
        const NotFoundFailure(message: 'not found'),
        const ConflictFailure(message: 'conflict'),
        const ValidationFailure(message: 'unprocessable'),
        // G16-N-3 P2-A: 429 is a DEFINITIVE rejection (rate limiter answered
        // before the mutation) — it must surface inline, never park, even
        // though it is a ServerFailure like 5xx.
        const ServerFailure(message: 'too many requests', code: '429'),
      ];

      for (final failure in businessFailures) {
        final (container, controller, _) = await harness();
        final queue = container.read(outboxMutationQueueProvider);

        final outcome = await queue.mutate<FakeResult>(
          kind: OutboxOperationKind.cashOut,
          // P2-B-5: durable identity lives in the payload.
          payload: {
            'amount': 10.0,
            'warehouseId': 'wh-1',
            'clientOperationId': 'key-${failure.message}',
          },
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
            // P2-B-5: mirror the minted key into the payload; without it
            // the worker correctly refuses to auto-dispatch.
            payload: const {
              'purchaseOrderId': 'po-1',
              // P2-B-5: GOODS_RECEIPT's durable identity is the mandatory
              // `receiptNumber`, NOT clientOperationId.
              'receiptNumber': 'GR-K-1',
            },
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
          // P2-B-5: a keyed caller threads the SAME identity into the payload,
          // which is what the flushed request body must carry.
          'clientOperationId': 'A',
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
      // P2-B-5: the body carries the durable identity too — that IS the request
      // the backend dedupes on. `warehouseId` stays lifted into the query.
      expect(call.data, {
        'amount': 100.0,
        'reason': 'float',
        'clientOperationId': 'A',
      });
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

  /// G16-N-3 P2-A — transport-uncertain 5xx parks under the transported key.
  ///
  /// Regression target: an online keyed mutation that receives HTTP 5xx AFTER
  /// the backend may have committed must NOT discard its idempotency key.
  /// Discarding it and minting a fresh UUID on retry would create a second
  /// reservation and double-apply the mutation (cash movement, stock
  /// adjustment, transfer, goods receipt).
  group('OutboxMutationQueue.isUncertainOutcome — G16-N-3 P2-A policy', () {
    test('NetworkFailure is uncertain', () {
      expect(
        OutboxMutationQueue.isUncertainOutcome(
          const NetworkFailure(message: 'timeout'),
        ),
        isTrue,
      );
    });

    test('ServerFailure with null code (cancelled/unknown transport) is '
        'uncertain', () {
      expect(
        OutboxMutationQueue.isUncertainOutcome(
          const ServerFailure(message: 'cancelled'),
        ),
        isTrue,
      );
    });

    test('ServerFailure 408 / 500 / 502 / 503 / 504 are uncertain', () {
      for (final code in ['408', '500', '502', '503', '504']) {
        expect(
          OutboxMutationQueue.isUncertainOutcome(
            ServerFailure(message: 'server', code: code),
          ),
          isTrue,
          reason: 'code $code must park',
        );
      }
    });

    test('unparseable ServerFailure code is uncertain (fail safe, park)',
        () {
      for (final code in ['', 'abc', '  ']) {
        expect(
          OutboxMutationQueue.isUncertainOutcome(
            ServerFailure(message: 'server', code: code),
          ),
          isTrue,
          reason: 'code "$code" must park rather than discard the key',
        );
      }
    });

    test('ServerFailure 429 is DEFINITIVE — must not park', () {
      expect(
        OutboxMutationQueue.isUncertainOutcome(
          const ServerFailure(message: 'too many requests', code: '429'),
        ),
        isFalse,
      );
    });

    test('definitive 4xx failures are not uncertain', () {
      const definitive = [
        ValidationFailure(message: 'bad request'),
        ValidationFailure(message: 'unprocessable'),
        NotFoundFailure(message: 'not found'),
        ConflictFailure(message: 'conflict'),
        AuthFailure(message: 'invalid credentials'),
        AuthFailure(message: 'permission denied'),
      ];
      for (final failure in definitive) {
        expect(
          OutboxMutationQueue.isUncertainOutcome(failure),
          isFalse,
          reason: '${failure.runtimeType} must not park',
        );
      }
    });
  });

  group('mutate — G16-N-3 P2-A 5xx parking', () {
    test('ServerFailure 500 → parked; stored idempotencyKey == transported K',
        () async {
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
        kind: OutboxOperationKind.adjustStock,
        payload: const {'productId': 'p1', 'quantity': 5},
        online: true,
        sendOnline: (key) async {
          seen.add(key);
          return const FakeErr(
            ServerFailure(message: 'Server error.', code: '500'),
          );
        },
        isNetworkFailure: fakeIsNetworkFailure,
      );

      expect(outcome, isA<OutboxMutationQueued<FakeResult>>());
      final op = controller.state.operations.single;
      // The parked operation carries the EXACT key the failed attempt sent.
      expect(seen, ['MINTED-1']);
      expect(op.clientOperationId, 'MINTED-1');
      expect(op.idempotencyKey, 'MINTED-1');
      expect(op.idempotencyKey, op.clientOperationId);
      expect(op.status, OutboxStatus.pending);
      // One mint: the initial online key. The fallback minted nothing.
      expect(mints, 1);
    });

    test('ServerFailure 504 → parked under K (gateway timeout after commit)',
        () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      final seen = <String>[];

      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.cashIn,
        // P2-B-5: durable identity lives in the payload.
        payload: const {
          'amount': 100.0,
          'warehouseId': 'wh-1',
          'clientOperationId': 'K-504',
        },
        online: true,
        clientOperationId: 'K-504',
        sendOnline: (key) async {
          seen.add(key);
          return const FakeErr(
            ServerFailure(message: 'Gateway timeout.', code: '504'),
          );
        },
        isNetworkFailure: fakeIsNetworkFailure,
      );

      expect(outcome, isA<OutboxMutationQueued<FakeResult>>());
      expect(seen, ['K-504']);
      final op = controller.state.operations.single;
      expect(op.idempotencyKey, 'K-504');
    });

    test('ServerFailure with null code (cancelled) → parked under K',
        () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);

      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.transferStock,
        payload: const {'productId': 'p1', 'quantity': 2},
        online: true,
        clientOperationId: 'K-cancel',
        sendOnline: (_) async =>
            const FakeErr(ServerFailure(message: 'cancelled')),
        isNetworkFailure: fakeIsNetworkFailure,
      );

      expect(outcome, isA<OutboxMutationQueued<FakeResult>>());
      expect(controller.state.operations.single.idempotencyKey, 'K-cancel');
    });

    test('ServerFailure 429 → NOT parked (definitive rejection)', () async {
      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);

      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.cashOut,
        payload: const {'amount': 10.0, 'warehouseId': 'wh-1'},
        online: true,
        clientOperationId: 'K-429',
        sendOnline: (_) async => const FakeErr(
          ServerFailure(message: 'Too many requests.', code: '429'),
        ),
        isNetworkFailure: fakeIsNetworkFailure,
      );

      expect(outcome, isA<OutboxMutationSent<FakeResult>>());
      expect(controller.state.operations, isEmpty);
    });

    test('5xx → parked → replay sends EXACTLY K; idGenerator never called '
        'again (no-new-key proof)', () async {
      final originalGenerator = OutboxOperation.idGenerator;
      var mints = 0;
      OutboxOperation.idGenerator = () {
        mints++;
        return 'K-$mints';
      };
      addTearDown(() => OutboxOperation.idGenerator = originalGenerator);

      final (container, controller, _) = await harness();
      final queue = container.read(outboxMutationQueueProvider);
      final seen = <String>[];

      // 1) ONLINE attempt transports K, receives 500 → parked under K.
      final outcome = await queue.mutate<FakeResult>(
        kind: OutboxOperationKind.goodsReceipt,
        // P2-B-5: mirror the minted key into the payload; without it
        // the worker correctly refuses to auto-dispatch.
        payload: const {
          'purchaseOrderId': 'po-1',
          // P2-B-5: GOODS_RECEIPT's durable identity is the mandatory
          // `receiptNumber`, NOT clientOperationId.
          'receiptNumber': 'GR-K-1',
        },
        online: true,
        sendOnline: (key) async {
          seen.add(key);
          return const FakeErr(
            ServerFailure(message: 'Server error.', code: '500'),
          );
        },
        isNetworkFailure: fakeIsNetworkFailure,
      );

      expect(outcome, isA<OutboxMutationQueued<FakeResult>>());
      expect(seen, ['K-1']);
      expect(mints, 1);
      final parked = controller.state.operations.single;
      expect(parked.idempotencyKey, 'K-1');

      // 2) Replay — the worker MUST transport K, and MUST NOT mint a key.
      OutboxOperation.idGenerator = () {
        mints++;
        return 'MINTED-DURING-REPLAY-$mints';
      };
      final spy = PostSpy();
      final sync = OutboxSyncService(
        controller: controller,
        post: spy.call,
        currentUser: () => testUser,
        isOnline: () => true,
      );
      final result = await sync.syncAll();

      expect(result.sent, 1);
      expect(spy.calls, hasLength(1));
      // THE invariant: the replay carries the ORIGINAL key.
      expect(spy.calls.single.key, 'K-1');
      // And minting a fresh UUID would have registered here.
      expect(mints, 1,
          reason: 'replay must never generate an idempotency key');
      expect(controller.state.operations, isEmpty);

      // 3) A second flush replays nothing (at-most-once end to end).
      final second = await sync.syncAll();
      expect(spy.calls, hasLength(1));
      expect(second.sent, 0);
    });
  });
}
