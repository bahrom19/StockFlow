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
        payload: const {'warehouseId': 'w-1', 'quantity': 5},
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
        payload: {'warehouseId': 'w-1', 'amount': 50},
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
}