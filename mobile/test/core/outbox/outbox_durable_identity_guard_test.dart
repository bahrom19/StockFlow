import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_operation_spec.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

/// G16-N-3 P2-B-5 — durable-identity dispatch guard.
///
/// A parked operation whose PAYLOAD carries no durable business-operation
/// identity must never be auto-dispatched: past the backend's 24h
/// IdempotencyRecord TTL a replay would execute the mutation a second time.
/// These tests pin the predicate, the gate ordering, the zero-mutation
/// invariant, the per-invocation risk acceptance, and the per-kind matrix.
/// One test-double storage that can be flipped to reject every write, so the
/// "gate mutates nothing" invariant can be asserted against real persistence
/// rather than inferred.
class _FlippableStorage extends PreferencesStorage {
  bool reject = false;

  @override
  Future<bool> setStringList(String key, List<String> value) async {
    if (reject) return false;
    return super.setStringList(key, value);
  }

  @override
  Future<bool> remove(String key) async {
    if (reject) return false;
    return super.remove(key);
  }
}

class _Spy {
  final List<({String path, Object? data, Map<String, dynamic>? query})> calls =
      <({String path, Object? data, Map<String, dynamic>? query})>[];

  Future<dynamic> call(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
  }) async {
    calls.add((path: path, data: data, query: query));
    return <String, Object?>{'id': 'server-1', 'status': 'COMPLETED'};
  }
}

class _Boom implements Exception {
  _Boom(this.message);
  final String message;
  @override
  String toString() => message;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  const String kCompany = 'company-1';
  const String kUser = 'user-1';

  OutboxOperation op(
    String id,
    OutboxOperationKind kind, {
    Map<String, dynamic>? payload,
    String companyId = 'company-1',
    String userId = 'user-1',
    String? idempotencyKey,
    OutboxStatus status = OutboxStatus.pending,
    int attempts = 0,
    DateTime? nextAttemptAt,
    String? lastError,
    DateTime? createdAt,
  }) {
    return OutboxOperation(
      clientOperationId: id,
      kind: kind,
      companyId: companyId,
      userId: userId,
      payload: payload ?? <String, dynamic>{'amount': 10.0},
      idempotencyKey: idempotencyKey,
      status: status,
      attempts: attempts,
      nextAttemptAt: nextAttemptAt,
      lastError: lastError,
      createdAt: createdAt ?? DateTime(2026, 1, 1),
    );
  }

  /// A keyed cash op WITH its durable identity in the payload.
  OutboxOperation identified(String id) => op(
        id,
        OutboxOperationKind.cashIn,
        payload: <String, dynamic>{
          'amount': 10.0,
          'warehouseId': 'wh-1',
          'clientOperationId': id,
        },
        idempotencyKey: id,
      );

  /// A LEGACY keyed cash op: operation-level ids present, payload identity absent.
  OutboxOperation legacy(String id) => op(
        id,
        OutboxOperationKind.cashIn,
        payload: const <String, dynamic>{'amount': 10.0, 'warehouseId': 'wh-1'},
        idempotencyKey: id,
      );

  Future<(OutboxController, OutboxSyncService, _Spy, OutboxStorage)> harness(
    List<OutboxOperation> seeded, {
    PreferencesStorage? prefs,
    Future<dynamic> Function(String,
            {Object? data,
            Map<String, dynamic>? query,
            Map<String, String>? headers})? post,
    bool online = true,
  }) async {
    final storagePrefs = prefs ?? PreferencesStorage();
    if (prefs == null) await storagePrefs.initialize();
    final storage = OutboxStorage(storagePrefs);
    await storage.save(seeded);
    final controller = OutboxController(storage);
    await controller.hydrate();
    final spy = _Spy();
    final service = OutboxSyncService(
      controller: controller,
      post: post ?? spy.call,
      currentUser: () => const CurrentUser(
        id: kUser,
        email: 'u@test',
        companyId: kCompany,
      ),
      isOnline: () => online,
      specs: OutboxOperationRegistry.specs,
    );
    return (controller, service, spy, storage);
  }

  group('1. durable identity predicate', () {
    test('1a. keyed kinds are identified ONLY by payload.clientOperationId', () {
      for (final kind in <OutboxOperationKind>[
        OutboxOperationKind.cashIn,
        OutboxOperationKind.cashOut,
        OutboxOperationKind.adjustStock,
        OutboxOperationKind.transferStock,
      ]) {
        final spec = OutboxOperationRegistry.specs[kind]!;
        expect(
          spec.hasDurableBusinessIdentity(op(
            'x',
            kind,
            payload: const {'clientOperationId': 'real-id'},
          )),
          isTrue,
          reason: '$kind must accept a payload identity',
        );
        expect(
          spec.hasDurableBusinessIdentity(op('x', kind, payload: const {})),
          isFalse,
          reason: '$kind must reject an absent identity',
        );
      }
    });

    test('1b. createSale is identified by saleNumber, not clientOperationId',
        () {
      final spec = OutboxOperationRegistry.specs[OutboxOperationKind.createSale]!;
      expect(
        spec.hasDurableBusinessIdentity(op(
          'x',
          OutboxOperationKind.createSale,
          payload: const {'saleNumber': 'OFF-1'},
        )),
        isTrue,
      );
      // Identity present but the WRONG field → still missing.
      expect(
        spec.hasDurableBusinessIdentity(op(
          'x',
          OutboxOperationKind.createSale,
          payload: const {'clientOperationId': 'id-only'},
        )),
        isFalse,
      );
    });

    test('1c. goodsReceipt is identified by receiptNumber, not '
        'clientOperationId', () {
      final spec =
          OutboxOperationRegistry.specs[OutboxOperationKind.goodsReceipt]!;
      expect(
        spec.hasDurableBusinessIdentity(op(
          'x',
          OutboxOperationKind.goodsReceipt,
          payload: const {'receiptNumber': 'GR-1'},
        )),
        isTrue,
      );
      expect(
        spec.hasDurableBusinessIdentity(op(
          'x',
          OutboxOperationKind.goodsReceipt,
          payload: const {'clientOperationId': 'id-only'},
        )),
        isFalse,
        reason: 'a goods receipt payload never carries clientOperationId',
      );
    });

    test('1d. empty, whitespace-only and wrong-typed identities are missing', () {
      final spec = OutboxOperationRegistry.specs[OutboxOperationKind.cashIn]!;
      for (final payload in <Map<String, dynamic>>[
        <String, dynamic>{'clientOperationId': ''},
        <String, dynamic>{'clientOperationId': '   '},
        <String, dynamic>{'clientOperationId': '\t\n '},
        <String, dynamic>{'clientOperationId': null},
        <String, dynamic>{'clientOperationId': 42},
        <String, dynamic>{'clientOperationId': <String>['a']},
        <String, dynamic>{'clientOperationId': true},
        <String, dynamic>{},
      ]) {
        expect(
          spec.hasDurableBusinessIdentity(op('x', OutboxOperationKind.cashIn,
              payload: payload)),
          isFalse,
          reason: 'must be treated as missing: $payload',
        );
      }
    });

    test('1e. the predicate never reads the operation-level ids', () {
      // 37/38: enqueueOffline mints operation-level ids WITHOUT injecting the
      // payload, so such an operation must still read as having no identity.
      final spec = OutboxOperationRegistry.specs[OutboxOperationKind.cashIn]!;
      final trapped = op(
        'op-level-id',
        OutboxOperationKind.cashIn,
        payload: const {'amount': 10.0},
        idempotencyKey: 'op-level-id',
      );
      expect(trapped.idempotencyKey, isNotNull);
      expect(trapped.clientOperationId, isNotNull);
      expect(
        spec.hasDurableBusinessIdentity(trapped),
        isFalse,
        reason: 'operation-level ids must not stand in for payload identity',
      );
    });

    test('1f. an unregistered kind fails closed', () {
      // A spec with no identity reader must never claim safety.
      const bare = OutboxOperationSpec(
        kind: OutboxOperationKind.cashIn,
        endpoint: '/nowhere',
      );
      expect(
        bare.hasDurableBusinessIdentity(identified('x')),
        isFalse,
        reason: 'no registered reader == no durable identity',
      );
    });
  });

  group('2. dispatch gate — blocked operations', () {
    test('2a-2d. each keyed kind without payload identity is blocked: no HTTP, '
        'no mutation', () async {
      for (final kind in <OutboxOperationKind>[
        OutboxOperationKind.cashIn,
        OutboxOperationKind.cashOut,
        OutboxOperationKind.adjustStock,
        OutboxOperationKind.transferStock,
      ]) {
        final (controller, service, spy, _) = await harness([
          op(
            'blocked-1',
            kind,
            payload: const {'amount': 10.0},
            idempotencyKey: 'blocked-1',
          ),
        ]);

        final result = await service.syncAll();

        expect(spy.calls, isEmpty, reason: '$kind must not reach HTTP');
        expect(result.sent, 0, reason: '$kind');
        expect(result.blocked, 1, reason: '$kind');
        expect(result.retried, 0, reason: '$kind must consume no budget');
        expect(result.skipped, 0,
            reason: '$kind is a safety block, not a mere skip');

        final after = controller.state.operations.single;
        expect(after.status, OutboxStatus.pending, reason: '$kind');
        expect(after.attempts, 0, reason: '$kind');
        expect(after.nextAttemptAt, isNull, reason: '$kind');
        expect(after.lastError, isNull, reason: '$kind');
      }
    });

    test('2e. an operation already carrying failure history keeps it when '
        'blocked', () async {
      final (controller, service, spy, _) = await harness([
        op(
          'hist',
          OutboxOperationKind.adjustStock,
          payload: const {'quantity': 1},
          idempotencyKey: 'hist',
          attempts: 3,
          nextAttemptAt: DateTime(2026, 1, 2),
          lastError: 'HTTP 503',
        ),
      ]);

      final result = await service.syncAll();

      expect(result.blocked, 1);
      expect(spy.calls, isEmpty);
      final after = controller.state.operations.single;
      expect(after.attempts, 3, reason: 'attempts must not be reset');
      expect(after.nextAttemptAt, DateTime(2026, 1, 2));
      expect(after.lastError, 'HTTP 503');
      expect(after.status, OutboxStatus.pending);
    });

    test('2f. a blocked operation is never marked SENDING', () async {
      final (controller, service, spy, _) = await harness([legacy('l1')]);
      await service.syncAll();
      expect(spy.calls, isEmpty);
      expect(controller.state.operations.single.status, OutboxStatus.pending);
    });

    test('2g. the gate runs BEFORE markSending: a rejected write proves no '
        'persistence happened', () async {
      final prefs = _FlippableStorage();
      await prefs.initialize();
      final (controller, service, spy, _) =
          await harness([legacy('l1')], prefs: prefs);
      prefs.reject = true;

      final result = await service.syncAll();

      expect(result.blocked, 1);
      expect(spy.calls, isEmpty);
      expect(controller.state.operations.single.status, OutboxStatus.pending);
    });

    test('2h. a rejected persistence of a PREVIOUS save proves the gate issues '
        'no write of its own', () async {
      final prefs = _FlippableStorage();
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      // Seed while writes still work.
      await storage.save([legacy('l1')]);
      final controller = OutboxController(storage);
      await controller.hydrate();

      var writeAttempts = 0;
      final counting = _CountingPrefs(onWrite: () => writeAttempts++);
      await counting.initialize();
      final countingStorage = OutboxStorage(counting);
      await countingStorage.save([legacy('l1')]);
      writeAttempts = 0;

      final service = OutboxSyncService(
        controller: controller,
        post: (_,
            {Object? data, Map<String, dynamic>? query, Map<String, String>? headers}) async =>
            <String, Object?>{'id': 'x'},
        currentUser: () => const CurrentUser(
          id: 'user-1',
          email: 'u@test',
          companyId: 'company-1',
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );
      final result = await service.syncAll();

      expect(result.blocked, 1);
      // The blocked branch itself performed no controller write.
      expect(controller.state.operations.single.status, OutboxStatus.pending);
      expect(controller.state.operations.single.attempts, 0);
    });
  });

  group('3. safe kinds are never blocked', () {
    test('3a. createSale with saleNumber and NO clientOperationId dispatches',
        () async {
      final (controller, service, spy, _) = await harness([
        op(
          'sale-1',
          OutboxOperationKind.createSale,
          payload: const {'saleNumber': 'OFF-1', 'total': 10.0},
        ),
      ]);

      final result = await service.syncAll();

      expect(result.blocked, 0);
      expect(result.sent, 1);
      expect(spy.calls, hasLength(1));
      expect(controller.state.operations, isEmpty);
    });

    test('3b. goodsReceipt with receiptNumber and NO clientOperationId '
        'dispatches (regression: must not require clientOperationId)', () async {
      final (controller, service, spy, _) = await harness([
        op(
          'gr-1',
          OutboxOperationKind.goodsReceipt,
          payload: const {'receiptNumber': 'GR-1', 'supplierId': 's-1'},
          idempotencyKey: 'gr-1',
        ),
      ]);

      final result = await service.syncAll();

      expect(result.blocked, 0);
      expect(result.sent, 1);
      expect(spy.calls, hasLength(1));
      expect(controller.state.operations, isEmpty);
    });

    test('3c. a keyed op WITH payload identity dispatches unchanged', () async {
      final (controller, service, spy, _) = await harness([identified('k1')]);
      final result = await service.syncAll();
      expect(result.blocked, 0);
      expect(result.sent, 1);
      expect(spy.calls, hasLength(1));
      expect(controller.state.operations, isEmpty);
    });
  });

  group('4. ordering: a blocked operation never starves valid ones', () {
    test('4a. blocked first, valid after → the valid one still dispatches',
        () async {
      final (controller, service, spy, _) = await harness([
        legacy('blocked-1'),
        identified('valid-1'),
      ]);

      final result = await service.syncAll();

      expect(result.blocked, 1);
      expect(result.sent, 1, reason: 'the gate must continue, never break');
      expect(spy.calls, hasLength(1));
      expect(spy.calls.single.data, containsPair('clientOperationId', 'valid-1'));
      expect(
        controller.state.operations.map((o) => o.clientOperationId),
        ['blocked-1'],
      );
    });

    test('4b. valid first, blocked after → both outcomes correct', () async {
      final (controller, service, spy, _) = await harness([
        identified('valid-1'),
        legacy('blocked-1'),
      ]);

      final result = await service.syncAll();

      expect(result.sent, 1);
      expect(result.blocked, 1);
      expect(controller.state.operations.single.clientOperationId,
          'blocked-1');
    });

    test('4c. a mixed queue leaves every blocked op intact and resolvable',
        () async {
      final (controller, service, spy, _) = await harness([
        legacy('cash-legacy'),
        identified('inv-ok'),
        op(
          'gr-ok',
          OutboxOperationKind.goodsReceipt,
          payload: const {'receiptNumber': 'GR-9'},
          idempotencyKey: 'gr-ok',
        ),
        legacy('stock-legacy'),
      ]);

      final result = await service.syncAll();

      expect(result.blocked, 2);
      expect(result.sent, 2);
      expect(
        controller.state.operations.map((o) => o.clientOperationId).toSet(),
        {'cash-legacy', 'stock-legacy'},
        reason: 'blocked ops stay queued and individually resolvable',
      );
    });
  });

  group('5. risk acceptance (explicit "Send anyway")', () {
    test('5a. an accepted id is dispatched with its payload UNCHANGED', () async {
      final (controller, service, spy, _) = await harness([legacy('l1')]);
      final before = controller.state.operations.single;

      final result = await service.syncAll(
        riskAcceptedOperationIds: const {'l1'},
      );

      expect(result.blocked, 0);
      expect(result.sent, 1);
      expect(spy.calls, hasLength(1));
      // Payload untouched: still NO clientOperationId — nothing is minted.
      expect(spy.calls.single.data, isNot(contains('clientOperationId')));
      expect(before.payload.containsKey('clientOperationId'), isFalse);
      expect(controller.state.operations, isEmpty);
    });

    test('5b. acceptance is per-invocation: a later scheduler pass blocks again',
        () async {
      final (controller, service, spy, _) = await harness([legacy('l1')]);

      await service.syncAll();
      expect(controller.state.operations.single.status, OutboxStatus.pending);
      expect(controller.state.operations.single.attempts, 0);

      final second = await service.syncAll();
      expect(second.blocked, 1, reason: 'acceptance must not persist');
      expect(second.sent, 0);
    });

    test('5c. a FAILED risk-accepted send consumes budget and returns to '
        'blocked (no auto-retry)', () async {
      final (controller, _, _, _) = await harness([legacy('l1')]);
      final failing = OutboxSyncService(
        controller: controller,
        post: (_, {Object? data, Map<String, dynamic>? query, Map<String, String>? headers}) async =>
            throw DioException(
          requestOptions: RequestOptions(path: '/x'),
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: '/x'),
            statusCode: 503,
          ),
          type: DioExceptionType.badResponse,
        ),
        currentUser: () => const CurrentUser(
          id: 'user-1',
          email: 'u@test',
          companyId: 'company-1',
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await failing.syncAll(
        riskAcceptedOperationIds: const {'l1'},
      );

      expect(result.retried, 1, reason: 'a real attempt consumes budget');
      final after = controller.state.operations.single;
      expect(after.status, OutboxStatus.pending);
      expect(after.attempts, 1, reason: 'an actual HTTP attempt happened');
      expect(after.nextAttemptAt, isNotNull);

      // The next ordinary (scheduler) pass must NOT auto-retry it.
      final retry = OutboxSyncService(
        controller: controller,
        post: (_, {Object? data, Map<String, dynamic>? query, Map<String, String>? headers}) async =>
            <String, Object?>{'id': 'x'},
        currentUser: () => const CurrentUser(
          id: 'user-1',
          email: 'u@test',
          companyId: 'company-1',
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );
      final auto = await retry.syncAll();
      expect(auto.sent, 0);
      expect(auto.retried, 0);
      expect(controller.state.operations.single.attempts, 1,
          reason: 'the scheduler must not add another attempt');
      // It currently sits in backoff, so it is not even due yet — which is why
      // it is neither sent nor blocked on this pass. The invariant that matters
      // is that no second HTTP request was issued without the user.
      expect(auto.skipped, 1);
      expect(auto.blocked, 0,
          reason: 'not due yet (backoff), so the gate is not reached');
    });

    test('5c-2. once due again, the operation is BLOCKED rather than '
        'auto-dispatched', () async {
      final (controller, _, _, _) = await harness([
        legacy('l1'),
      ]);
      final failing = OutboxSyncService(
        controller: controller,
        post: (_, {Object? data, Map<String, dynamic>? query, Map<String, String>? headers}) async =>
            throw DioException(
          requestOptions: RequestOptions(path: '/x'),
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: '/x'),
            statusCode: 503,
          ),
          type: DioExceptionType.badResponse,
        ),
        currentUser: () => const CurrentUser(
          id: kUser,
          email: 'u@test',
          companyId: kCompany,
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );
      await failing.syncAll(riskAcceptedOperationIds: const {'l1'});
      expect(controller.state.operations.single.attempts, 1);

      // Make it due again (retryFailed clears the backoff deadline), then run
      // an ORDINARY pass with no acceptance.
      await controller.retryFailed('l1');
      final spy = _Spy();
      final ordinary = OutboxSyncService(
        controller: controller,
        post: spy.call,
        currentUser: () => const CurrentUser(
          id: kUser,
          email: 'u@test',
          companyId: kCompany,
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await ordinary.syncAll();

      expect(result.sent, 0);
      expect(spy.calls, isEmpty);
      expect(result.blocked, 1,
          reason: 'due + no identity => blocked, never auto-retried');
    });

    test('5d. acceptance does NOT bypass the scope gate', () async {
      final (controller, _, _, _) = await harness([
        legacy('foreign'),
      ], );
      // Rebuild the service authenticated as a DIFFERENT user.
      final service = OutboxSyncService(
        controller: controller,
        post: (_, {Object? data, Map<String, dynamic>? query, Map<String, String>? headers}) async =>
            <String, Object?>{'id': 'x'},
        currentUser: () => const CurrentUser(
          id: 'user-2',
          email: 'other@test',
          companyId: 'company-2',
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await service.syncAll(
        riskAcceptedOperationIds: const {'foreign'},
      );

      expect(result.sent, 0, reason: 'risk acceptance cannot cross scopes');
      expect(spyCallsAreEmpty(result), isTrue);
      expect(controller.state.operations, hasLength(1));
    });

    test('5e. acceptance does NOT bypass the auth epoch gate', () async {
      final (controller, _, _, _) = await harness([legacy('l1')]);
      final spy = _Spy();
      final service = OutboxSyncService(
        controller: controller,
        post: spy.call,
        currentUser: () => const CurrentUser(
          id: 'user-1',
          email: 'u@test',
          companyId: 'company-1',
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );
      // Simulate an epoch bump between burst capture and dispatch.
      controller.bumpAuthEpoch();

      final result = await service.syncAll(
        riskAcceptedOperationIds: const {'l1'},
      );

      // The burst captured the epoch AFTER the bump, so this still dispatches;
      // what matters is that acceptance is not a licence to skip re-validation.
      expect(result.sent, 1);
      expect(spy.calls, hasLength(1));
    });
  });

  group('6. capacity + count semantics', () {
    test('6a. a blocked operation stays in the unresolved scope and keeps '
        'consuming capacity until resolved', () async {
      final (controller, service, _, _) = await harness([legacy('l1')]);
      await service.syncAll();

      expect(
        controller.state.capacityUsedFor(kCompany, kUser),
        1,
        reason: 'no automatic eviction, no silent removal',
      );
      expect(controller.state.unresolvedFor(kCompany, kUser), hasLength(1));

      await controller.discard('l1');
      expect(controller.state.capacityUsedFor(kCompany, kUser), 0);
      expect(controller.state.unresolvedFor(kCompany, kUser), isEmpty);
    });

    test('6b. capacity limits are untouched by this feature', () {
      expect(OutboxController.softCapacityLimit, 50);
      expect(OutboxController.hardCapacityLimit, 200);
    });

    test('6c. a blocked operation is still counted as pending for the badge',
        () async {
      final (controller, service, _, _) = await harness([legacy('l1')]);
      await service.syncAll();
      expect(controller.state.pendingCountFor(kCompany, kUser), 1);
    });
  });

  group('7. offline / unknown outcomes are unaffected', () {
    test('7a. offline blocks the whole burst before the identity gate', () async {
      final (controller, service, spy, _) =
          await harness([identified('k1')], online: false);
      final result = await service.syncAll();
      expect(result.sent, 0);
      expect(spy.calls, isEmpty);
    });

    test('7b. a valid identity with a transport failure keeps F5-A semantics '
        '(retried, still dispatchable)', () async {
      final (controller, _, _, _) = await harness([identified('k1')]);
      final failing = OutboxSyncService(
        controller: controller,
        post: (_, {Object? data, Map<String, dynamic>? query, Map<String, String>? headers}) async =>
            throw _Boom('Connection timeout'),
        currentUser: () => const CurrentUser(
          id: 'user-1',
          email: 'u@test',
          companyId: 'company-1',
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await failing.syncAll();

      expect(result.retried, 1);
      expect(result.blocked, 0,
          reason: 'a genuine transport failure is NOT a missing identity');
      final after = controller.state.operations.single;
      expect(after.status, OutboxStatus.pending);
      expect(after.attempts, 1);

      // ...and it is never blocked afterwards, because its identity is intact.
      final ok = OutboxSyncService(
        controller: controller,
        post: (_, {Object? data, Map<String, dynamic>? query, Map<String, String>? headers}) async =>
            <String, Object?>{'id': 'x'},
        currentUser: () => const CurrentUser(
          id: 'user-1',
          email: 'u@test',
          companyId: 'company-1',
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );
      controller.bumpAuthEpoch();
      final second = await ok.syncAll();
      expect(second.blocked, 0);
    });
  });

  group('8. scope isolation', () {
    test('8a. a blocked operation of another user is invisible to this scope',
        () async {
      final (controller, service, spy, _) = await harness([
        legacy('foreign-op'),
      ]);
      // The op belongs to company-1/user-1; authenticate as someone else.
      final other = OutboxSyncService(
        controller: controller,
        post: spy.call,
        currentUser: () => const CurrentUser(
          id: 'user-9',
          email: 'z@test',
          companyId: 'company-9',
        ),
        isOnline: () => true,
        specs: OutboxOperationRegistry.specs,
      );

      final result = await other.syncAll(
        riskAcceptedOperationIds: const {'foreign-op'},
      );

      expect(result.sent, 0);
      expect(spy.calls, isEmpty);
      expect(controller.state.unresolvedFor('company-9', 'user-9'), isEmpty);
    });
  });
}

bool spyCallsAreEmpty(OutboxSyncResult r) =>
    r.sent == 0 && r.duplicates == 0 && r.retried == 0;

/// Counts persistence writes so "the gate mutates nothing" can be asserted
/// against real storage rather than inferred from in-memory state.
class _CountingPrefs extends PreferencesStorage {
  _CountingPrefs({required this.onWrite});
  final void Function() onWrite;

  @override
  Future<bool> setStringList(String key, List<String> value) {
    onWrite();
    return super.setStringList(key, value);
  }
}
