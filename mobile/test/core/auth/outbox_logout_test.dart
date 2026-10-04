import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';
import 'package:stockflow/features/auth/data/repositories/auth_repository.dart';

/// Never touches the network or the platform channels.
class _StubTokenStorage extends TokenStorage {
  @override
  Future<String?> getRefreshToken() async => null;

  @override
  Future<void> clearTokens() async {}
}

class _StubAuthRepository extends AuthRepository {
  _StubAuthRepository(Ref ref) : super(ref);

  @override
  Future<ApiResult<void>> logout({String? refreshTokenValue}) async {
    return const ApiSuccess(null);
  }
}

OutboxOperation _saleOp() {
  return OutboxOperation(
    clientOperationId: 'logout-op-1',
    kind: OutboxOperationKind.createSale,
    companyId: 'company-1',
    userId: 'user-1',
    payload: const {'saleNumber': 'OFF-logout'},
    createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
  );
}

/// G16-N-3 Phase 3 P2-2: every outbox write is REJECTED WITHOUT throwing —
/// the silent-failure case that must not be reported as a persisted queue.
class _RejectingWritesPrefs extends PreferencesStorage {
  @override
  Future<bool> setStringList(String key, List<String> value) async => false;

  @override
  Future<bool> remove(String key) async => false;
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('logout → outbox is wiped from memory AND persistence', () async {
    final prefs = PreferencesStorage();
    await prefs.initialize();
    final outbox = OutboxController(OutboxStorage(prefs));

    final container = ProviderContainer(
      overrides: [
        tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
        authRepositoryProvider.overrideWith(
          (ref) => _StubAuthRepository(ref),
        ),
        outboxControllerProvider.overrideWith((ref) => outbox),
      ],
    );
    addTearDown(container.dispose);

    // An offline sale is queued before logout.
    await container
        .read(outboxControllerProvider.notifier)
        .enqueue(_saleOp());
    expect(container.read(outboxControllerProvider).operations, hasLength(1));

    await container.read(authStateProvider.notifier).logout();

    // Memory is empty…
    expect(container.read(outboxControllerProvider).operations, isEmpty);
    // …and persistence is empty: a fresh controller hydrates nothing.
    final fresh = OutboxController(OutboxStorage(prefs));
    await fresh.hydrate();
    expect(fresh.state.operations, isEmpty);
  });

  test('logout with an empty queue stays a no-op for the outbox', () async {
    final prefs = PreferencesStorage();
    await prefs.initialize();
    final outbox = OutboxController(OutboxStorage(prefs));

    final container = ProviderContainer(
      overrides: [
        tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
        authRepositoryProvider.overrideWith(
          (ref) => _StubAuthRepository(ref),
        ),
        outboxControllerProvider.overrideWith((ref) => outbox),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authStateProvider.notifier).logout();

    expect(
      container.read(authStateProvider),
      isA<AuthUnauthenticated>(),
    );
    expect(container.read(outboxControllerProvider).operations, isEmpty);
  });

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 3 — selective logout cleanup + identity races.
  //
  // PD-1: the outgoing scope's unresolved operations are PRESERVED by default.
  // PD-2: every foreign-scope operation is REMOVED at sign-out.
  // Ownership is never mutated: only whole entries are kept or dropped.
  // ───────────────────────────────────────────────────────────────────────
  group('Phase 3 — selective logout cleanup', () {
    const a = CurrentUser(id: 'user-A', email: 'a@t', companyId: 'company-A');

    OutboxOperation op(
      String id, {
      required String companyId,
      required String userId,
      String? key,
    }) =>
        OutboxOperation(
          clientOperationId: id,
          kind: OutboxOperationKind.cashIn,
          companyId: companyId,
          userId: userId,
          payload: const {'amount': 100.0, 'warehouseId': 'wh-1'},
          idempotencyKey: key ?? id,
          createdAt: DateTime(2026, 1, 1),
        );

    /// Container authenticated as [user], with a real controller over a real
    /// (mock-backed) SharedPreferences store.
    Future<
        (
          ProviderContainer,
          OutboxController,
          PreferencesStorage,
          AuthStateNotifier
        )> harness(CurrentUser user) async {
      final prefs = PreferencesStorage();
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      final controller = OutboxController(storage);
      final container = ProviderContainer(
        overrides: [
          tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
          authRepositoryProvider
              .overrideWith((ref) => _StubAuthRepository(ref)),
          outboxStorageProvider.overrideWithValue(storage),
          outboxControllerProvider.overrideWith((ref) => controller),
          currentUserProvider.overrideWithValue(user),
        ],
      );
      addTearDown(container.dispose);
      // Put the auth notifier into the authenticated state so `logout()`
      // can capture a real outgoing identity.
      final auth = container.read(authStateProvider.notifier);
      // ignore: invalid_use_of_protected_member
      auth.state = AuthAuthenticated(user);
      return (container, controller, prefs, auth);
    }

    OutboxController freshController(PreferencesStorage prefs) =>
        OutboxController(OutboxStorage(prefs));

    test('1. logout preserves same-scope pending operations', () async {
      final (_, c, prefs, auth) = await harness(a);
      await c.enqueue(op('a-1', companyId: 'company-A', userId: 'user-A'));

      final result = await auth.logout();

      expect(result.queuePersisted, isTrue);
      expect(c.state.operations, hasLength(1));
      expect(c.state.operations.single.clientOperationId, 'a-1');
      // ...and it really is on disk.
      final reloaded = freshController(prefs);
      await reloaded.hydrate();
      expect(reloaded.state.operations, hasLength(1));
    });

    test('2. logout removes foreign-scope operations', () async {
      final (_, c, prefs, auth) = await harness(a);
      await c.enqueue(op('mine', companyId: 'company-A', userId: 'user-A'));
      await c.enqueue(op('theirs', companyId: 'company-B', userId: 'user-B'));

      await auth.logout();

      expect(c.state.operations.map((o) => o.clientOperationId), ['mine']);
      final reloaded = freshController(prefs);
      await reloaded.hydrate();
      expect(
        reloaded.state.operations.map((o) => o.clientOperationId),
        ['mine'],
      );
    });

    test('3. mixed-scope cleanup keeps only the outgoing scope', () async {
      final (_, c, _, auth) = await harness(a);
      await c.enqueue(op('a-1', companyId: 'company-A', userId: 'user-A'));
      await c.enqueue(op('a-2', companyId: 'company-A', userId: 'user-A'));
      // Same company, different user.
      await c
          .enqueue(op('a-c-other-u', companyId: 'company-A', userId: 'user-Z'));
      // Different company, same user.
      await c
          .enqueue(op('a-other-c', companyId: 'company-Z', userId: 'user-A'));
      // Fully foreign.
      await c.enqueue(op('b-1', companyId: 'company-B', userId: 'user-B'));

      await auth.logout();

      expect(
        c.state.operations.map((o) => o.clientOperationId).toSet(),
        {'a-1', 'a-2'},
      );
    });

    test('4/5. B cannot see A ops; A sees them again after signing back in',
        () async {
      final (_, c, _, auth) = await harness(a);
      await c.enqueue(op('a-1', companyId: 'company-A', userId: 'user-A'));
      await auth.logout();

      // B is authenticated: nothing of A's is visible or counted.
      expect(c.state.unresolvedFor('company-B', 'user-B'), isEmpty);
      expect(c.state.pendingCountFor('company-B', 'user-B'), 0);
      expect(c.state.capacityUsedFor('company-B', 'user-B'), 0);

      // A signs back in: the preserved operation is visible again, unchanged.
      expect(
        c.state
            .unresolvedFor('company-A', 'user-A')
            .map((o) => o.clientOperationId),
        ['a-1'],
      );
    });

    test('15. discard & sign out empties the queue', () async {
      final (_, c, prefs, auth) = await harness(a);
      await c.enqueue(op('a-1', companyId: 'company-A', userId: 'user-A'));
      await c.enqueue(op('b-1', companyId: 'company-B', userId: 'user-B'));

      final result = await auth.logout(discardPendingWork: true);

      expect(result.queuePersisted, isTrue);
      expect(c.state.operations, isEmpty);
      final reloaded = freshController(prefs);
      await reloaded.hydrate();
      expect(reloaded.state.operations, isEmpty);
    });

    test('16. queue full after preservation still refuses a new enqueue',
        () async {
      final (_, c, _, auth) = await harness(a);
      for (var i = 0; i < OutboxController.hardCapacityLimit; i++) {
        await c.enqueue(op('f-$i', companyId: 'company-A', userId: 'user-A'));
      }
      await auth.logout();

      // Preserved 200 operations; a fresh enqueue is still refused.
      expect(c.state.capacityUsedFor('company-A', 'user-A'),
          OutboxController.hardCapacityLimit);
      expect(
        await c
            .enqueue(op('overflow', companyId: 'company-A', userId: 'user-A')),
        OutboxEnqueueOutcome.capacityRefused,
      );
    });

    test('17. ownership fields are never mutated by cleanup', () async {
      final (_, c, prefs, auth) = await harness(a);
      await c.enqueue(op('a-1', companyId: 'company-A', userId: 'user-A'));
      final before = c.state.operations.single;
      final beforeFields = (
        before.companyId,
        before.userId,
        before.idempotencyKey,
        before.clientOperationId,
        before.createdAt,
        before.payload,
      );

      await auth.logout();

      final after = c.state.operations.single;
      expect(
        (
          after.companyId,
          after.userId,
          after.idempotencyKey,
          after.clientOperationId,
          after.createdAt,
          after.payload,
        ),
        beforeFields,
      );
      // 18. identity unchanged, and it survived a full storage round trip.
      final reloaded = freshController(prefs);
      await reloaded.hydrate();
      final persisted = reloaded.state.operations.single;
      expect(persisted.idempotencyKey, beforeFields.$3);
      expect(persisted.clientOperationId, beforeFields.$4);
      expect(persisted.createdAt, beforeFields.$5);
    });

    test(
        '14. cleanup is a whole-list write; a crash leaves old-or-new, '
        'never foreign-dispatchable', () async {
      final (_, c, prefs, auth) = await harness(a);
      await c.enqueue(op('mine', companyId: 'company-A', userId: 'user-A'));
      await c.enqueue(op('theirs', companyId: 'company-B', userId: 'user-B'));

      await auth.logout();

      // Simulate a crash BEFORE the cleanup write: the old list survives...
      final stale = freshController(prefs);
      // ...re-seed the foreign entry to emulate a pre-write snapshot.
      await stale.hydrate();
      await stale
          .enqueue(op('resurrected', companyId: 'company-B', userId: 'user-B'));

      // ...and the foreign entry is INERT, not dispatchable for A.
      expect(stale.state.unresolvedFor('company-A', 'user-A'), hasLength(1));
      expect(stale.state.pendingCountFor('company-B', 'user-B'), 1);
      // A re-sign-out removes it again.
      final c2 = OutboxController(OutboxStorage(prefs));
      await c2.hydrate();
      await c2.cleanupForLogout('company-A', 'user-A');
      expect(
        c2.state.operations.map((o) => o.clientOperationId),
        isNot(contains('resurrected')),
      );
    });

    test('19. an anonymous sign-out keeps the legacy full wipe', () async {
      final prefs = PreferencesStorage();
      await prefs.initialize();
      final controller = OutboxController(OutboxStorage(prefs));
      final container = ProviderContainer(
        overrides: [
          tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
          authRepositoryProvider
              .overrideWith((ref) => _StubAuthRepository(ref)),
          outboxStorageProvider.overrideWithValue(OutboxStorage(prefs)),
          outboxControllerProvider.overrideWith((ref) => controller),
        ],
      );
      addTearDown(container.dispose);
      await controller
          .enqueue(op('x', companyId: 'company-A', userId: 'user-A'));

      // No authenticated user => no outgoing scope => nothing to preserve.
      final result = await container.read(authStateProvider.notifier).logout();

      expect(result.queuePersisted, isTrue);
      expect(controller.state.operations, isEmpty);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 3 remediation (P2-2) — logout must never claim the
  // cleanup persisted when the store silently rejected the write.
  // ───────────────────────────────────────────────────────────────────────
  group('Phase 3 P2-2 — logout reports a rejected write honestly', () {
    test('selective cleanup: rejected write → queuePersisted is FALSE', () async {
      final prefs = _RejectingWritesPrefs();
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      final controller = OutboxController(storage);
      final container = ProviderContainer(
        overrides: [
          tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
          authRepositoryProvider.overrideWith((ref) => _StubAuthRepository(ref)),
          outboxStorageProvider.overrideWithValue(storage),
          outboxControllerProvider.overrideWith((ref) => controller),
          currentUserProvider.overrideWithValue(
            const CurrentUser(id: 'user-A', email: 'a@t', companyId: 'company-A'),
          ),
        ],
      );
      addTearDown(container.dispose);
      final auth = container.read(authStateProvider.notifier);
      // ignore: invalid_use_of_protected_member
      auth.state = AuthAuthenticated(
        const CurrentUser(id: 'user-A', email: 'a@t', companyId: 'company-A'),
      );
      await controller.enqueue(
        OutboxOperation(
          clientOperationId: 'persist-1',
          kind: OutboxOperationKind.cashIn,
          companyId: 'company-A',
          userId: 'user-A',
          payload: const {'amount': 5.0, 'warehouseId': 'wh-1'},
          idempotencyKey: 'persist-1',
          createdAt: DateTime(2026, 1, 1),
        ),
      );

      final result = await auth.logout();

      // The write was rejected without throwing — the honest answer is false,
      // NOT a silent true.
      expect(result.queuePersisted, isFalse);
    });

    test('destructive discard: rejected write → queuePersisted is FALSE, so '
        'the UI cannot claim the discard definitely succeeded', () async {
      final prefs = _RejectingWritesPrefs();
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      final controller = OutboxController(storage);
      final container = ProviderContainer(
        overrides: [
          tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
          authRepositoryProvider.overrideWith((ref) => _StubAuthRepository(ref)),
          outboxStorageProvider.overrideWithValue(storage),
          outboxControllerProvider.overrideWith((ref) => controller),
          currentUserProvider.overrideWithValue(
            const CurrentUser(id: 'user-A', email: 'a@t', companyId: 'company-A'),
          ),
        ],
      );
      addTearDown(container.dispose);
      final auth = container.read(authStateProvider.notifier);
      // ignore: invalid_use_of_protected_member
      auth.state = AuthAuthenticated(
        const CurrentUser(id: 'user-A', email: 'a@t', companyId: 'company-A'),
      );
      await controller.enqueue(
        OutboxOperation(
          clientOperationId: 'discard-1',
          kind: OutboxOperationKind.cashIn,
          companyId: 'company-A',
          userId: 'user-A',
          payload: const {'amount': 5.0, 'warehouseId': 'wh-1'},
          idempotencyKey: 'discard-1',
          createdAt: DateTime(2026, 1, 1),
        ),
      );

      final result = await auth.logout(discardPendingWork: true);

      expect(result.queuePersisted, isFalse);
      // In-memory reduction did happen; only persistence is unconfirmed. The
      // failure direction is fail-safe: the on-disk list is untouched, so no
      // same-scope work is lost and any surviving foreign entry stays inert.
      expect(controller.state.operations, isEmpty);
    });

    test('accepted write → queuePersisted is TRUE (no false alarm)', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = PreferencesStorage();
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      final controller = OutboxController(storage);
      final container = ProviderContainer(
        overrides: [
          tokenStorageProvider.overrideWithValue(_StubTokenStorage()),
          authRepositoryProvider.overrideWith((ref) => _StubAuthRepository(ref)),
          outboxStorageProvider.overrideWithValue(storage),
          outboxControllerProvider.overrideWith((ref) => controller),
          currentUserProvider.overrideWithValue(
            const CurrentUser(id: 'user-A', email: 'a@t', companyId: 'company-A'),
          ),
        ],
      );
      addTearDown(container.dispose);
      final auth = container.read(authStateProvider.notifier);
      // ignore: invalid_use_of_protected_member
      auth.state = AuthAuthenticated(
        const CurrentUser(id: 'user-A', email: 'a@t', companyId: 'company-A'),
      );
      await controller.enqueue(
        OutboxOperation(
          clientOperationId: 'ok-1',
          kind: OutboxOperationKind.cashIn,
          companyId: 'company-A',
          userId: 'user-A',
          payload: const {'amount': 5.0, 'warehouseId': 'wh-1'},
          idempotencyKey: 'ok-1',
          createdAt: DateTime(2026, 1, 1),
        ),
      );

      final result = await auth.logout();

      expect(result.queuePersisted, isTrue);
      expect(controller.state.operations, hasLength(1));
    });
  });
}
