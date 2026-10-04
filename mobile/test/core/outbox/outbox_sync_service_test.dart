import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_operation_spec.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

/// Records every POST (path, body, query, headers) and answers according to
/// the configured responder.
class _PostSpy {
  final List<(String, Object?, Map<String, dynamic>?, Map<String, String>?)>
      calls = [];

  Future<dynamic> Function(
    String, {
    Object? data,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
  }) always(
    Object? Function(String path, Object? data) responder,
  ) {
    return (
      String path, {
      Object? data,
      Map<String, dynamic>? query,
      Map<String, String>? headers,
    }) async {
      calls.add((path, data, query, headers));
      return responder(path, data);
    };
  }
}

DioException _status(int statusCode, {Object? data}) {
  final options = RequestOptions(path: '/sales');
  return DioException(
    requestOptions: options,
    response: Response<dynamic>(
      requestOptions: options,
      statusCode: statusCode,
      data: data,
    ),
    type: DioExceptionType.badResponse,
  );
}

DioException _connectionError() {
  return DioException(
    requestOptions: RequestOptions(path: '/sales'),
    type: DioExceptionType.connectionError,
  );
}

/// G16-N-3 Phase 3 P2-1 — deterministic driver for the pre-dispatch identity
/// gate. The gate sits between `markSending` (which persists status=sending)
/// and `_post`. This double watches the storage write and flips the live
/// authenticated identity at exactly that moment, so the gate is reached
/// WITHOUT any real network timing dependency.
class _FlipIdentityOnSendingWrite extends PreferencesStorage {
  _FlipIdentityOnSendingWrite(this._onSendingPersisted);

  final void Function() _onSendingPersisted;

  /// Re-armable, so repeated flaps can be driven in one test.
  bool armed = true;
  int flips = 0;

  @override
  Future<bool> setStringList(String key, List<String> value) async {
    final result = await super.setStringList(key, value);
    if (armed && value.any((v) => v.contains('"status":"sending"'))) {
      armed = false;
      flips++;
      _onSendingPersisted();
    }
    return result;
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<OutboxController> controller({
    List<OutboxOperation> seeded = const [],
  }) async {
    final prefs = PreferencesStorage();
    await prefs.initialize();
    final storage = OutboxStorage(prefs);
    if (seeded.isNotEmpty) await storage.save(seeded);
    final c = OutboxController(storage);
    await c.hydrate();
    return c;
  }

  OutboxOperation saleOp(String id) {
    return OutboxOperation(
      clientOperationId: id,
      kind: OutboxOperationKind.createSale,
      companyId: 'company-1',
      userId: 'user-1',
      payload: {'saleNumber': 'OFF-$id', 'items': const <Object>[]},
      createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
    );
  }

  OutboxSyncService service({
    required OutboxController controllerRef,
    required Future<dynamic> Function(
      String, {
      Object? data,
      Map<String, dynamic>? query,
      Map<String, String>? headers,
    }) post,
    CurrentUser? user = const CurrentUser(
      id: 'user-1',
      email: 'u@t',
      companyId: 'company-1',
    ),
    bool online = true,
    Map<OutboxOperationKind, OutboxOperationSpec> specs =
        OutboxOperationRegistry.specs,
  }) {
    return OutboxSyncService(
      controller: controllerRef,
      post: post,
      currentUser: () => user,
      isOnline: () => online,
      specs: specs,
    );
  }

  group('OutboxSyncService (Offline 1B-min)', () {
    test('successful POST → SENT: entry removed after confirmation',
        () async {
      final c = await controller(seeded: [saleOp('s1')]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => {'id': 'sale-1', 'status': 'COMPLETED'}),
      );

      final result = await svc.syncAll();

      expect(result.sent, 1);
      expect(c.state.operations, isEmpty);
      expect(spy.calls.single.$1, '/sales');
      expect((spy.calls.single.$2 as Map)['saleNumber'], 'OFF-s1');
    });

    test('409 P2002 on our client saleNumber → recognized duplicate, '
        'entry confirmed and never re-sent', () async {
      final c = await controller(seeded: [saleOp('dup')]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always(
          (_, __) => throw _status(
            409,
            data: {
              'message':
                  'A record with the same unique value already exists',
            },
          ),
        ),
      );

      final result = await svc.syncAll();

      expect(result.duplicates, 1);
      expect(c.state.operations, isEmpty); // treated as applied
      expect(spy.calls, hasLength(1)); // sent exactly once
    });

    test('network error → stays PENDING with backoff', () async {
      final c = await controller(seeded: [saleOp('net')]);
      final svc = service(
        controllerRef: c,
        post: (path, {data, query, headers}) => throw _connectionError(),
      );

      final result = await svc.syncAll();

      expect(result.retried, 1);
      expect(c.state.pendingCount, 1);
      final stored = c.state.operations.single;
      expect(stored.attempts, 1);
      expect(stored.nextAttemptAt, isNotNull);
      expect(stored.isDue(DateTime.now()), isFalse);
    });

    test('5xx → stays PENDING with backoff', () async {
      final c = await controller(seeded: [saleOp('e503')]);
      final svc = service(
        controllerRef: c,
        post: (path, {data, query, headers}) => throw _status(503, data: {'message': 'down'}),
      );

      final result = await svc.syncAll();

      expect(result.retried, 1);
      expect(c.state.pendingCount, 1);
      expect(c.state.operations.single.lastError, 'down');
    });

    test('permanent 4xx (422) → FAILED_PERMANENT', () async {
      final c = await controller(seeded: [saleOp('e422')]);
      final svc = service(
        controllerRef: c,
        post: (path, {data, query, headers}) =>
            throw _status(422, data: {'message': 'validation failed'}),
      );

      final result = await svc.syncAll();

      expect(result.failedPermanent, 1);
      expect(c.state.failedCount, 1);
      expect(c.state.operations.single.lastError, 'validation failed');
    });

    test('401 → retryable (recoverable after re-login)', () async {
      final c = await controller(seeded: [saleOp('e401')]);
      final svc = service(
        controllerRef: c,
        post: (path, {data, query, headers}) => throw _status(401),
      );

      final result = await svc.syncAll();

      expect(result.retried, 1);
      expect(c.state.pendingCount, 1);
    });

    test('non-duplicate 409 → FAILED_PERMANENT (user decides)', () async {
      final c = await controller(seeded: [saleOp('e409x')]);
      final svc = service(
        controllerRef: c,
        post: (path, {data, query, headers}) =>
            throw _status(409, data: {'message': 'shift is closed'}),
      );

      final result = await svc.syncAll();

      expect(result.failedPermanent, 1);
      expect(c.state.failedCount, 1);
    });

    test('FIFO: ops are sent in queue order', () async {
      final c = await controller(seeded: [
        saleOp('first'),
        saleOp('second'),
        saleOp('third'),
      ]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => {'id': 'x', 'status': 'COMPLETED'}),
      );

      await svc.syncAll();

      expect(
        spy.calls.map((call) => (call.$2 as Map)['saleNumber']),
        ['OFF-first', 'OFF-second', 'OFF-third'],
      );
    });

    test('OFFLINE → nothing is sent, queue untouched', () async {
      final c = await controller(seeded: [saleOp('offline-op')]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => throw StateError('must not be called')),
        online: false,
      );

      await svc.syncAll();

      expect(spy.calls, isEmpty);
      expect(c.state.pendingCount, 1);
    });

    test('no authenticated user → nothing is sent', () async {
      final c = await controller(seeded: [saleOp('anon-op')]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => throw StateError('must not be called')),
        user: null,
      );

      await svc.syncAll();

      expect(spy.calls, isEmpty);
      expect(c.state.pendingCount, 1);
    });

    test('scope guard: another user/company op is never sent', () async {
      final foreign = OutboxOperation(
        clientOperationId: 'foreign',
        kind: OutboxOperationKind.createSale,
        companyId: 'company-OTHER',
        userId: 'user-OTHER',
        payload: const {'saleNumber': 'OFF-foreign'},
        createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
      );
      final c = await controller(seeded: [foreign]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => throw StateError('must not be called')),
      );

      final result = await svc.syncAll();

      expect(result.skipped, 1);
      expect(spy.calls, isEmpty);
      expect(c.state.pendingCount, 1);
    });

    test('backoff: an op not yet due is skipped', () async {
      final c = await controller(seeded: [
        saleOp('not-due').copyWith(
          nextAttemptAt: DateTime.now().add(const Duration(minutes: 10)),
        ),
      ]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => throw StateError('must not be called')),
      );

      final result = await svc.syncAll();

      expect(result.skipped, 1);
      expect(spy.calls, isEmpty);
    });

    test('chained complete: DRAFT sale is completed in the same burst',
        () async {
      final c = await controller(seeded: [saleOp('drafty')]);
      final paths = <String>[];
      final svc = service(
        controllerRef: c,
        post: (path, {data, query, headers}) async {
          paths.add(path);
          return path == '/sales' ? {'id': 'sale-9', 'status': 'DRAFT'} : {};
        },
      );

      await svc.syncAll();

      expect(paths, ['/sales', '/sales/sale-9/complete']);
      expect(c.state.operations, isEmpty); // create still confirmed
    });

    test('failed chained complete does NOT block confirming the create',
        () async {
      final c = await controller(seeded: [saleOp('drafty-2')]);
      final svc = service(
        controllerRef: c,
        post: (path, {data, query, headers}) async {
          if (path == '/sales') {
            return {'id': 'sale-10', 'status': 'DRAFT'};
          }
          throw _connectionError(); // complete fails
        },
      );

      final result = await svc.syncAll();

      expect(result.sent, 1);
      expect(c.state.operations, isEmpty);
    });
  });

  group('OutboxSyncService (Phase F3: generalized dispatch)', () {
    test('routing is spec-driven: createSale payload goes to POST /sales',
        () async {
      final c = await controller(seeded: [saleOp('route')]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => {'id': 'sale-11', 'status': 'COMPLETED'}),
      );

      final result = await svc.syncAll();

      expect(result.sent, 1);
      expect(spy.calls.single.$1, '/sales');
      expect((spy.calls.single.$2 as Map)['saleNumber'], 'OFF-route');
    });

    test('409 in-flight idempotency conflict on a keyed op → retryable, '
        'op stays PENDING, key untouched', () async {
      final keyed = saleOp('keyed-409').copyWith(
        attempts: 3,
        lastError: 'HTTP 503',
      );
      // The model keeps idempotencyKey immutable — simulate an F4-style keyed
      // op the way persistence would restore it (via fromJson round-trip).
      final json = keyed.toJson()..['idempotencyKey'] = 'idem-key-409';
      final op = OutboxOperation.fromJson(json);
      expect(op.idempotencyKey, 'idem-key-409');

      final c = await controller(seeded: [op]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        // Backend in-flight conflict message carries no unique/p2002 marker.
        post: spy.always(
          (_, __) => throw _status(
            409,
            data: {
              'message':
                  "Request with idempotency key 'idem-key-409' is already "
                      'being processed',
            },
          ),
        ),
      );

      final result = await svc.syncAll();

      expect(result.retried, 1);
      expect(result.sent, 0);
      expect(spy.calls, hasLength(1)); // exactly one attempt per burst
      final kept = c.state.operations.single;
      expect(kept.clientOperationId, 'keyed-409');
      expect(kept.status, OutboxStatus.pending);
      expect(kept.attempts, 4);
      expect(kept.idempotencyKey, 'idem-key-409'); // key preserved
      expect(kept.isDue(DateTime.now()), isFalse); // backoff scheduled
    });

    test('a kind without a registered spec is skipped, never dispatched',
        () async {
      // The worker's dispatch table is injectable; with the production
      // registry covering every enum kind, the spec-less guard is reachable
      // only through a partial table — exactly what a rolling deploy looks
      // like (an older app build syncing a queue that already contains
      // newer kinds). Here adjustStock has NO spec: the op is skipped
      // untouched (stays PENDING, never marked SENDING) and nothing is ever
      // POSTed anywhere.
      final op = OutboxOperation(
        clientOperationId: 'specless',
        kind: OutboxOperationKind.adjustStock,
        companyId: 'company-1',
        userId: 'user-1',
        // P2-B-5: keyed kinds need the durable identity in the payload.
        payload: const {'warehouseId': 'w-1', 'quantity': 5, 'clientOperationId': 'id-adjust'},
        createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
      );
      final c = await controller(seeded: [op]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => {'id': 'sale-12', 'status': 'COMPLETED'}),
        specs: const {
          OutboxOperationKind.createSale: createSaleSpec,
        },
      );

      final result = await svc.syncAll();

      expect(result.skipped, 1);
      expect(result.sent, 0);
      expect(spy.calls, isEmpty); // nothing ever leaves the device
      final kept = c.state.operations.single;
      expect(kept.clientOperationId, 'specless');
      expect(kept.status, OutboxStatus.pending); // not stuck in SENDING
    });

    test('cashIn dispatches with warehouseId as query and a stripped body',
        () async {
      final op = OutboxOperation(
        clientOperationId: 'cash-1',
        kind: OutboxOperationKind.cashIn,
        companyId: 'company-1',
        userId: 'user-1',
        payload: const {
          'warehouseId': 'w-1',
          'amount': 100,
          'reason': 'top-up',
          // P2-B-5: the durable identity the backend dedupes on travels in the
          // BODY, not only on the operation.
          'clientOperationId': 'idem-cash-1',
        },
        idempotencyKey: 'idem-cash-1',
        createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
      );
      final c = await controller(seeded: [op]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => {'id': 'shift-1', 'status': 'OPEN'}),
      );

      final result = await svc.syncAll();

      expect(result.sent, 1);
      expect(spy.calls.single.$1, ApiEndpoints.cashShiftCashIn);
      // warehouseId rides in the query string (the backend reads it from
      // there, exactly like the online repository sends it)…
      expect(spy.calls.single.$3, {'warehouseId': 'w-1'});
      // …and is stripped from the body (the forbidNonWhitelisted
      // ValidationPipe would reject it as a non-whitelisted DTO field).
      final body = spy.calls.single.$2 as Map;
      expect(body['amount'], 100);
      expect(body['reason'], 'top-up');
      expect(body.containsKey('warehouseId'), isFalse);
      // F4-C: the op carries its key, so the backend Idempotency-Key header
      // must ride along on the dispatch.
      expect(spy.calls.single.$4, {'Idempotency-Key': 'idem-cash-1'});
      // Confirmed and removed like any other accepted op.
      expect(c.state.operations, isEmpty);
    });

    test('CREATE_SALE never sends an Idempotency-Key header', () async {
      final c = await controller(seeded: [saleOp('plain-hdr')]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => {'id': 'sale-13', 'status': 'COMPLETED'}),
      );

      await svc.syncAll();

      expect(spy.calls.single.$1, '/sales');
      // No key on CREATE_SALE — its replay safety is the client-generated
      // saleNumber, and the /sales duplicate contract must stay untouched.
      expect(spy.calls.single.$4, isNull);
      expect(c.state.operations, isEmpty);
    });

    test('retry after a restart sends the exact same persisted Idempotency-Key',
        () async {
      final prefs = PreferencesStorage();
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      const op = OutboxOperation(
        clientOperationId: 'keyed-retry',
        kind: OutboxOperationKind.cashIn,
        companyId: 'company-1',
        userId: 'user-1',
        // P2-B-5: durable identity in the payload (see above).
        payload: {
          'warehouseId': 'w-1',
          'amount': 50,
          'clientOperationId': 'idem-retry-1',
        },
        idempotencyKey: 'idem-retry-1',
      );
      await storage.save([op]);
      final c1 = OutboxController(storage);
      await c1.hydrate();

      final seenKeys = <String?>[];
      var attempts = 0;
      Future<dynamic> post(
        String path, {
        Object? data,
        Map<String, dynamic>? query,
        Map<String, String>? headers,
      }) async {
        attempts++;
        seenKeys.add(headers?['Idempotency-Key']);
        if (attempts == 1) {
          throw _status(503, data: {'message': 'down'});
        }
        return {'id': 'shift-2', 'status': 'OPEN'};
      }

      // Attempt 1: 503 → retryable PENDING with backoff, key intact.
      final first = await service(controllerRef: c1, post: post).syncAll();
      expect(first.retried, 1);
      expect(seenKeys.single, 'idem-retry-1');
      final persisted = (await storage.load()).single;
      expect(persisted.idempotencyKey, 'idem-retry-1');
      expect(persisted.status, OutboxStatus.pending);

      // App restart: a fresh controller loads the SAME persisted entry and
      // the backoff deadline is cleared — exactly how a due-again retry
      // happens. The key is not re-minted and the op is not re-enqueued.
      final storage2 = OutboxStorage(prefs);
      await storage2.save([
        persisted.copyWith(
          status: OutboxStatus.pending,
          nextAttemptAt: DateTime.fromMillisecondsSinceEpoch(500),
        ),
      ]);
      final c2 = OutboxController(storage2);
      await c2.hydrate();

      // Attempt 2: succeeds carrying the IDENTICAL key.
      final second = await service(controllerRef: c2, post: post).syncAll();
      expect(second.sent, 1);
      expect(seenKeys, ['idem-retry-1', 'idem-retry-1']);
      expect(c2.state.operations, isEmpty);
    });
  });

  group('OutboxSyncService (Phase F5-B: finite retry budget)', () {
    OutboxOperation keyedAtBudgetEdge(String id, String key) {
      // Simulate an F4-style keyed op the way persistence restores it (the
      // key is immutable and copyWith never exposes it) with the budget
      // almost spent: maxRetryAttempts - 1 prior failures, still PENDING.
      final edge = saleOp(id).copyWith(
        attempts: OutboxController.maxRetryAttempts - 1,
        lastError: 'HTTP 503',
      );
      final json = edge.toJson()..['idempotencyKey'] = key;
      return OutboxOperation.fromJson(json);
    }

    test('keyed in-flight 409 on the last budgeted attempt → exactly one more '
        'attempt, then FAILED_PERMANENT', () async {
      final c = await controller(seeded: [keyedAtBudgetEdge('keyed-cap', 'idem-key-cap')]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        // Backend in-flight conflict message carries no unique/p2002 marker —
        // the same retryable classification as ever (F5-B does not reclassify).
        post: spy.always(
          (_, __) => throw _status(
            409,
            data: {
              'message':
                  "Request with idempotency key 'idem-key-cap' is already "
                      'being processed',
            },
          ),
        ),
      );

      final result = await svc.syncAll();

      // Classification unchanged: the worker still reports this as a
      // retryable outcome — the CAP itself (controller-side) ends the chain.
      expect(result.retried, 1);
      expect(result.failedPermanent, 0);
      expect(spy.calls, hasLength(1)); // exactly one next attempt
      final demoted = c.state.operations.single;
      expect(demoted.status, OutboxStatus.failedPermanent);
      expect(demoted.attempts, OutboxController.maxRetryAttempts);
      expect(demoted.lastError, isNotNull);
      expect(demoted.nextAttemptAt, isNull);
      expect(demoted.idempotencyKey, 'idem-key-cap'); // key preserved
      expect(c.state.failedCount, 1);

      // A follow-up flush sends NOTHING — the op is out of the retry loop.
      final again = await svc.syncAll();
      expect(again.retried, 0);
      expect(again.skipped, 1);
      expect(spy.calls, hasLength(1));
    });

    test('manual Retry after the cap re-sends with the SAME idempotencyKey, '
        'removes the op on 2xx and a repeated flush creates no duplicate',
        () async {
      final c = await controller(
        seeded: [keyedAtBudgetEdge('keyed-manual', 'idem-key-manual')],
      );
      final seenKeys = <String?>[];
      var responses = 0;
      Future<dynamic> post(
        String path, {
        Object? data,
        Map<String, dynamic>? query,
        Map<String, String>? headers,
      }) async {
        seenKeys.add(headers?['Idempotency-Key']);
        responses++;
        if (responses == 1) {
          throw _status(503, data: {'message': 'down'});
        }
        return {'id': 'shift-9', 'status': 'OPEN'};
      }

      final svc = service(controllerRef: c, post: post);

      // Attempt #12 (the last budgeted one) fails retryably → cap demotion.
      final capBurst = await svc.syncAll();
      expect(capBurst.retried, 1);
      final capped = c.state.operations.single;
      expect(capped.status, OutboxStatus.failedPermanent);
      expect(capped.attempts, OutboxController.maxRetryAttempts);
      expect(capped.idempotencyKey, 'idem-key-manual');

      // The user taps Retry in the failed UI — exactly what outbox_indicator
      // does: retryFailed, then a fresh syncAll.
      await c.retryFailed('keyed-manual');
      final reset = c.state.operations.single;
      expect(reset.status, OutboxStatus.pending);
      expect(reset.attempts, 0);
      expect(reset.nextAttemptAt, isNull);

      final manualBurst = await svc.syncAll();
      expect(manualBurst.sent, 1);
      // Exactly two attempts in total, BOTH carrying the identical key
      // minted once at enqueue time.
      expect(seenKeys, ['idem-key-manual', 'idem-key-manual']);
      // Success confirmed → the op is removed from the queue.
      expect(c.state.operations, isEmpty);

      // A repeated flush creates no duplicate: nothing is left to send.
      final again = await svc.syncAll();
      expect(again.processed, 0);
      expect(seenKeys, hasLength(2));
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 3 — F1: a burst must never dispatch an operation
  // under a different authenticated identity than the one it was queued for.
  // ───────────────────────────────────────────────────────────────────────
  group('Phase 3 F1 — identity races', () {
    const userA =
        CurrentUser(id: 'user-1', email: 'a@t', companyId: 'company-1');
    const userB =
        CurrentUser(id: 'user-2', email: 'b@t', companyId: 'company-2');

    OutboxOperation cashOp(String id,
            {String company = 'company-1', String user = 'user-1'}) =>
        OutboxOperation(
          clientOperationId: id,
          kind: OutboxOperationKind.cashIn,
          companyId: company,
          userId: user,
          // P2-B-5: durable identity lives in the payload.
          payload: {'amount': 100.0, 'warehouseId': 'wh-1', 'clientOperationId': id},
          idempotencyKey: id,
          createdAt: DateTime(2026, 1, 1),
        );

    test(
        '6. A→B before dispatch: identity change mid-burst stops the '
        'burst; the next op stays '
        'PENDING and is never dispatched', () async {
      final c = await controller(seeded: [cashOp('r1'), cashOp('r2')]);
      final spy = _PostSpy();
      // Live identity: A when the burst starts, B after the first response.
      var live = userA;

      final svc = OutboxSyncService(
        controller: c,
        post: spy.always((_, __) {
          // The auth state changes WHILE op r1 is in flight.
          live = userB;
          return {'id': 'cash-1', 'status': 'COMPLETED'};
        }),
        currentUser: () => live,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await svc.syncAll();

      // Only the first, in-scope request was made.
      expect(spy.calls, hasLength(1));
      expect(result.sent, 1);
      // r2 remains queued, untouched, and still dispatchable for A later.
      final remaining = c.state.operations.map((o) => o.clientOperationId);
      expect(remaining, ['r2']);
      expect(
        c.state.operations.single.status,
        OutboxStatus.pending,
        reason: 'an identity switch must leave the op PENDING, never SENDING',
      );
    });

    test(
        '9. retry during an identity change: an auth-epoch bump mid-burst '
        'stops the burst even when the user '
        'object is unchanged', () async {
      final c = await controller(seeded: [cashOp('e1'), cashOp('e2')]);
      final spy = _PostSpy();
      final svc = OutboxSyncService(
        controller: c,
        post: spy.always((_, __) {
          // What the auth listener does on ANY scope-relevant transition.
          c.bumpAuthEpoch();
          return {'id': 'cash-1', 'status': 'COMPLETED'};
        }),
        currentUser: () => userA,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await svc.syncAll();

      expect(spy.calls, hasLength(1));
      expect(result.sent, 1);
      final remaining = c.state.operations.map((o) => o.clientOperationId);
      expect(remaining, ['e2']);
      expect(c.state.operations.single.status, OutboxStatus.pending);
    });

    test(
        '7. A→B after dispatch: an already-dispatched request is NOT '
        'cancelled; its result is '
        'applied to its own operation id', () async {
      // Ids sort 'first' < 'second', so the dispatch order is deterministic.
      final c = await controller(seeded: [cashOp('first'), cashOp('second')]);
      final spy = _PostSpy();
      var live = userA;

      final svc = OutboxSyncService(
        controller: c,
        post: spy.always((_, __) {
          // Identity changes after dispatch — the in-flight request keeps the
          // credentials it was issued under and must still settle.
          live = userB;
          return {'id': 'cash-1', 'status': 'COMPLETED'};
        }),
        currentUser: () => live,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await svc.syncAll();

      expect(result.sent, 1);
      // Confirmed by its OWN id, not rebound to the current (B) user.
      expect(c.state.operations.map((o) => o.clientOperationId), ['second']);
      expect(c.state.operations.single.companyId, 'company-1');
      expect(c.state.operations.single.userId, 'user-1');
    });

    test('19. unauthenticated session: a burst never starts', () async {
      final c = await controller(seeded: [cashOp('orphan')]);
      final spy = _PostSpy();
      final svc = OutboxSyncService(
        controller: c,
        post: spy.always((_, __) => {'id': 'x', 'status': 'COMPLETED'}),
        currentUser: () => null,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await svc.syncAll();

      expect(spy.calls, isEmpty);
      expect(result.sent, 0);
      // Not deleted, just not dispatched.
      expect(c.state.operations, hasLength(1));
    });

    test('4. B can neither dispatch nor see A operations', () async {
      final c = await controller(
        seeded: [
          cashOp('mine'),
          cashOp('theirs', company: 'company-2', user: 'user-2'),
        ],
      );
      final spy = _PostSpy();
      final svc = OutboxSyncService(
        controller: c,
        post: spy.always((_, __) => {'id': 'x', 'status': 'COMPLETED'}),
        currentUser: () => userA,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await svc.syncAll();

      expect(spy.calls, hasLength(1));
      expect(result.sent, 1);
      expect(c.state.operations.map((o) => o.clientOperationId), ['theirs']);
      // Untouched: still PENDING and still owned by B.
      final theirs = c.state.operations.single;
      expect(theirs.status, OutboxStatus.pending);
      expect(theirs.companyId, 'company-2');
      expect(theirs.userId, 'user-2');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 3 remediation (P2-1) — the pre-dispatch identity
  // gate must NOT consume the F5-B retry budget, because no HTTP request was
  // ever issued. Matrix scenario 6 ("A→B before dispatch").
  // ───────────────────────────────────────────────────────────────────────
  group('Phase 3 P2-1 — pre-dispatch gate does not charge retry budget', () {
    const userA = CurrentUser(id: 'user-1', email: 'a@t', companyId: 'company-1');
    const userB = CurrentUser(id: 'user-2', email: 'b@t', companyId: 'company-2');

    OutboxOperation cashOp(String id, {OutboxStatus status = OutboxStatus.pending}) =>
        OutboxOperation(
          clientOperationId: id,
          kind: OutboxOperationKind.cashIn,
          companyId: 'company-1',
          userId: 'user-1',
          // P2-B-5: durable identity lives in the payload.
          payload: {'amount': 100.0, 'warehouseId': 'wh-1', 'clientOperationId': id},
          idempotencyKey: id,
          createdAt: DateTime(2026, 1, 1),
          status: status,
        );

    test('6 (P2-1 remediation). A→B before dispatch: op stays PENDING with '
        'attempts/backoff/lastError '
        'untouched, no HTTP request, burst stops', () async {
      SharedPreferences.setMockInitialValues({});
      var live = userA;
      final prefs = _FlipIdentityOnSendingWrite(() => live = userB);
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      await storage.save([cashOp('g1'), cashOp('g2')]);
      final c = OutboxController(storage);
      await c.hydrate();

      final spy = _PostSpy();
      final svc = OutboxSyncService(
        controller: c,
        post: spy.always((_, __) => {'id': 'x', 'status': 'COMPLETED'}),
        currentUser: () => live,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await svc.syncAll();

      // The gate fired: the identity flipped during the markSending write.
      expect(prefs.flips, 1, reason: 'gate must be the path exercised');
      // No request was issued for ANY operation.
      expect(spy.calls, isEmpty, reason: 'gate must prevent the HTTP call');
      expect(result.sent, 0);

      // g1 was marked SENDING, then released: PENDING again, no penalty.
      final g1 = c.state.operations.firstWhere((o) => o.clientOperationId == 'g1');
      expect(g1.status, OutboxStatus.pending);
      expect(g1.attempts, 0, reason: 'no request was made — no retry consumed');
      expect(g1.nextAttemptAt, isNull, reason: 'no backoff may be applied');
      expect(g1.lastError, isNull, reason: 'no misleading error may be written');

      // Identity + durable identity untouched.
      expect(g1.companyId, 'company-1');
      expect(g1.userId, 'user-1');
      expect(g1.idempotencyKey, 'g1');
      expect(g1.createdAt, DateTime(2026, 1, 1));

      // Burst stopped: g2 was never even considered, still pristine PENDING.
      final g2 = c.state.operations.firstWhere((o) => o.clientOperationId == 'g2');
      expect(g2.status, OutboxStatus.pending);
      expect(g2.attempts, 0);

      // ...and the released state is PERSISTED, not just in memory.
      final reloaded = OutboxController(OutboxStorage(prefs));
      await reloaded.hydrate();
      expect(
        reloaded.state.operations.every((o) => o.status == OutboxStatus.pending),
        isTrue,
      );
    });

    test('6b (P2-1 remediation). repeated identity flaps never accumulate '
        'attempts and can never '
        'reach FAILED_PERMANENT', () async {
      SharedPreferences.setMockInitialValues({});
      var live = userA;
      final prefs = _FlipIdentityOnSendingWrite(() => live = userB);
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      await storage.save([cashOp('flap')]);
      final c = OutboxController(storage);
      await c.hydrate();

      final spy = _PostSpy();
      final svc = OutboxSyncService(
        controller: c,
        post: spy.always((_, __) => {'id': 'x', 'status': 'COMPLETED'}),
        currentUser: () => live,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      // Far more flaps than the F5-B budget (12).
      for (var i = 0; i < OutboxController.maxRetryAttempts + 5; i++) {
        prefs.armed = true; // re-arm the flipper for this burst
        live = userA; // A signs back in, so the next burst can start
        c.bumpAuthEpoch(); // and the burst captures a fresh epoch
        await svc.syncAll();
      }

      final op = c.state.operations.single;
      expect(spy.calls, isEmpty, reason: 'no flap may ever reach the network');
      expect(op.status, OutboxStatus.pending);
      expect(op.attempts, 0, reason: 'identity stops are not delivery failures');
      expect(op.nextAttemptAt, isNull);
      expect(op.lastError, isNull);
      expect(
        op.status,
        isNot(OutboxStatus.failedPermanent),
        reason: 'P2-1: must be impossible to fail an undispatched op',
      );
      expect(prefs.flips, OutboxController.maxRetryAttempts + 5);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 3 — matrix scenarios 8 (rapid A→B→A) and
  // 10-13 (failure classes arriving AFTER an identity change).
  // ───────────────────────────────────────────────────────────────────────
  group('Phase 3 — rapid scope churn and post-dispatch failures', () {
    const userA = CurrentUser(id: 'user-1', email: 'a@t', companyId: 'company-1');
    const userB = CurrentUser(id: 'user-2', email: 'b@t', companyId: 'company-2');

    OutboxOperation cashOp(String id) => OutboxOperation(
          clientOperationId: id,
          kind: OutboxOperationKind.cashIn,
          companyId: 'company-1',
          userId: 'user-1',
          // P2-B-5: durable identity lives in the payload.
          payload: {'amount': 100.0, 'warehouseId': 'wh-1', 'clientOperationId': id},
          idempotencyKey: id,
          createdAt: DateTime(2026, 1, 1),
        );

    DioException networkFailure() => DioException(
          requestOptions: RequestOptions(path: '/cash-in'),
          type: DioExceptionType.connectionError,
        );

    test('8. rapid A→B→A: nothing of A dispatches under B, A resumes its own '
        'backlog, durable identity unchanged', () async {
      final c = await controller(seeded: [cashOp('r1'), cashOp('r2')]);
      var live = userA;

      OutboxSyncService make() => OutboxSyncService(
            controller: c,
            post: _PostSpy().always((_, __) {
              live = userB; // scope changes WHILE r1 is in flight
              return {'id': 'cash-1', 'status': 'COMPLETED'};
            }),
            currentUser: () => live,
            isOnline: () => true,
            specs: OutboxOperationRegistry.specs,
          );

      // --- A: r1 goes out, then the scope flips to B mid-burst.
      final first = await make().syncAll();
      expect(first.sent, 1);
      final pendingId =
          c.state.operations.single.clientOperationId;
      expect(pendingId, 'r2');

      // --- B is now authenticated: a burst must dispatch NOTHING of A's.
      final underB = await OutboxSyncService(
        controller: c,
        post: _PostSpy().always((_, __) => {'id': 'never', 'status': 'COMPLETED'}),
        currentUser: () => userB,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      ).syncAll();
      expect(underB.sent, 0);
      expect(c.state.operations, hasLength(1));
      // B cannot see, count or own A's operation.
      expect(c.state.unresolvedFor('company-2', 'user-2'), isEmpty);
      expect(c.state.pendingCountFor('company-2', 'user-2'), 0);

      // --- A returns and resumes exactly where it left off.
      final resumed = await OutboxSyncService(
        controller: c,
        post: _PostSpy().always((_, __) => {'id': 'cash-2', 'status': 'COMPLETED'}),
        currentUser: () => userA,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      ).syncAll();
      expect(resumed.sent, 1);
      expect(c.state.operations, isEmpty);
    });

    test('18. A operation retains its own identity (idempotency key) across '
        'the churn '
        '(idempotency key unchanged, never rebound to B)', () async {
      final c = await controller(seeded: [cashOp('keeper')]);
      var live = userA;
      final spy = _PostSpy();
      final svc = OutboxSyncService(
        controller: c,
        // Fail fast so the op stays queued, then flip the scope.
        post: spy.always((_, __) {
          live = userB;
          throw _status(503);
        }),
        currentUser: () => live,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      await svc.syncAll();

      final op = c.state.operations.single;
      expect(op.clientOperationId, 'keeper');
      expect(op.idempotencyKey, 'keeper');
      expect(op.createdAt, DateTime(2026, 1, 1));
      expect(op.companyId, 'company-1');
      expect(op.userId, 'user-1');
      // B sees nothing.
      expect(c.state.unresolvedFor('company-2', 'user-2'), isEmpty);
      // ...and the key that would be sent is still A's.
      expect(spy.calls.single.$4?['Idempotency-Key'], 'keeper');
    });

    // Matrix 10-13: the response arrives after the identity already changed.
    // Classification semantics must be EXACTLY the pre-Phase-3 ones — these
    // are genuine transport/server failures, so they DO consume retry budget
    // (unlike the P2-1 pre-dispatch gate).
    final postChangeCases = <String, Object>{
      '10. 401 after change → retryable': _status(401),
      '11. 409 (non-duplicate) after change → retryable': _status(409),
      '12. 5xx after change → retryable': _status(503),
      '13. network failure after change → retryable': networkFailure(),
    };

    postChangeCases.forEach((title, failure) {
      test('$title — applied by clientOperationId, never rebound to B',
          () async {
        final c = await controller(seeded: [cashOp('pc-1')]);
        var live = userA;
        final svc = OutboxSyncService(
          controller: c,
          post: _PostSpy().always((_, __) {
            live = userB; // identity changes before the failure surfaces
            throw failure;
          }),
          currentUser: () => live,
          isOnline: () => true,
          specs: OutboxOperationRegistry.specs,
        );

        final result = await svc.syncAll();

        expect(result.sent, 0);
        expect(result.retried, 1, reason: 'classification unchanged by Phase 3');
        final op = c.state.operations.single;
        expect(op.clientOperationId, 'pc-1');
        // Still A's operation — result applied by id, not to B.
        expect(op.companyId, 'company-1');
        expect(op.userId, 'user-1');
        expect(op.idempotencyKey, 'pc-1');
        // Genuine failure → retry budget IS consumed (unchanged semantics).
        expect(op.status, OutboxStatus.pending);
        expect(op.attempts, 1);
        // B sees nothing of it.
        expect(c.state.unresolvedFor('company-2', 'user-2'), isEmpty);
      });
    });

    test('409 duplicate after change → still confirmed by its own id (never '
        'rebased onto B)', () async {
      final c = await controller(seeded: [cashOp('dup-after')]);
      var live = userA;
      final svc = OutboxSyncService(
        controller: c,
        post: _PostSpy().always((_, __) {
          live = userB;
          throw _status(409, data: {
            'message': 'A record with the same unique value already exists',
          });
        }),
        currentUser: () => live,
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await svc.syncAll();

      expect(result.duplicates, 1);
      expect(result.sent, 0);
      // Recognized duplicate → removed, by its own clientOperationId.
      expect(c.state.operations, isEmpty);
      expect(c.state.unresolvedFor('company-2', 'user-2'), isEmpty);
    });
  });
}
