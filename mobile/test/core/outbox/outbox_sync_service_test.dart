import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

/// Records every POST and answers according to the configured responder.
class _PostSpy {
  final List<(String, Object?)> calls = [];

  Future<dynamic> Function(String, {Object? data}) always(
    Object? Function(String path, Object? data) responder,
  ) {
    return (String path, {Object? data}) async {
      calls.add((path, data));
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
    required Future<dynamic> Function(String, {Object? data}) post,
    CurrentUser? user = const CurrentUser(
      id: 'user-1',
      email: 'u@t',
      companyId: 'company-1',
    ),
    bool online = true,
  }) {
    return OutboxSyncService(
      controller: controllerRef,
      post: post,
      currentUser: () => user,
      isOnline: () => online,
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
        post: (path, {data}) => throw _connectionError(),
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
        post: (path, {data}) => throw _status(503, data: {'message': 'down'}),
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
        post: (path, {data}) =>
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
        post: (path, {data}) => throw _status(401),
      );

      final result = await svc.syncAll();

      expect(result.retried, 1);
      expect(c.state.pendingCount, 1);
    });

    test('non-duplicate 409 → FAILED_PERMANENT (user decides)', () async {
      final c = await controller(seeded: [saleOp('e409x')]);
      final svc = service(
        controllerRef: c,
        post: (path, {data}) =>
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
        post: (path, {data}) async {
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
        post: (path, {data}) async {
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
      // Model-level guarantee: an unknown persisted kind can never enter the
      // in-memory queue as createSale — it is dropped at load time. The
      // worker-side guard (spec == null → skip) is the second line of
      // defense and is exercised by the registry invariant test in
      // outbox_operation_spec_test.dart (every kind must have a spec).
      final op = OutboxOperation(
        clientOperationId: 'specless',
        kind: OutboxOperationKind.createSale,
        companyId: 'company-1',
        userId: 'user-1',
        payload: const {'saleNumber': 'OFF-specless'},
        createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
      );
      expect(op.kind, OutboxOperationKind.createSale); // no silent coercion
      final c = await controller(seeded: [op]);
      final spy = _PostSpy();
      final svc = service(
        controllerRef: c,
        post: spy.always((_, __) => {'id': 'sale-12', 'status': 'COMPLETED'}),
      );

      final result = await svc.syncAll();

      expect(result.sent, 1);
      expect(spy.calls.single.$1, '/sales');
    });
  });
}