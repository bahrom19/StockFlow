import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

/// Exposes [OutboxState.isInScope] for a single operation in tests.
bool inScopeOf(OutboxOperation o, String companyId, String userId) =>
    OutboxState(operations: [o]).isInScope(o, companyId, userId);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<OutboxController> controller({
    DateTime Function()? now,
    List<OutboxOperation> seeded = const [],
  }) async {
    final prefs = PreferencesStorage();
    await prefs.initialize();
    final storage = OutboxStorage(prefs);
    if (seeded.isNotEmpty) await storage.save(seeded);
    final c = OutboxController(storage, now: now);
    await c.hydrate();
    return c;
  }

  OutboxOperation op(
    String id, {
    DateTime? createdAt,
    OutboxStatus status = OutboxStatus.pending,
    // G16-N-3 P2-B-4 Phase 1: scope is EXACTLY companyId + userId.
    String companyId = 'company-1',
    String userId = 'user-1',
    String? idempotencyKey,
    Map<String, dynamic>? payload,
  }) {
    return OutboxOperation(
      clientOperationId: id,
      kind: OutboxOperationKind.createSale,
      companyId: companyId,
      userId: userId,
      payload: payload ?? const {'saleNumber': 'OFF-x'},
      idempotencyKey: idempotencyKey,
      status: status,
      createdAt: createdAt,
    );
  }

  group('OutboxController', () {
    test('enqueue adds an op and exposes it to the UI state', () async {
      final c = await controller();

      final added = await c.enqueue(op('op-1'));

      // Phase 2: enqueue returns an explicit outcome, not a bool.
      expect(added, OutboxEnqueueOutcome.added);
      expect(c.state.pendingCount, 1);
      expect(c.state.operations.single.clientOperationId, 'op-1');
    });

    test('duplicate clientOperationId is a no-op (no second entry)', () async {
      final c = await controller();
      await c.enqueue(op('same-id'));

      final addedAgain = await c.enqueue(op('same-id'));

      expect(addedAgain, OutboxEnqueueOutcome.duplicate);
      expect(c.state.operations, hasLength(1));
    });

    test('FIFO: ops are ordered by createdAt regardless of enqueue order',
        () async {
      final c = await controller();
      await c.enqueue(op('late', createdAt: DateTime(2026, 1, 3)));
      await c.enqueue(op('early', createdAt: DateTime(2026, 1, 1)));
      await c.enqueue(op('middle', createdAt: DateTime(2026, 1, 2)));

      expect(
        c.state.operations.map((o) => o.clientOperationId).toList(),
        ['early', 'middle', 'late'],
      );
    });

    test('confirmSent removes the entry ONLY after confirmation (dequeue)',
        () async {
      final c = await controller();
      await c.enqueue(op('op-1'));
      await c.enqueue(op('op-2'));

      await c.confirmSent('op-1');

      expect(
        c.state.operations.map((o) => o.clientOperationId),
        ['op-2'],
      );
    });

    test('queue survives a restart: persisted ops are restored by hydrate',
        () async {
      // First "app run": enqueue and persist.
      final first = await controller();
      await first.enqueue(op('survivor'));

      // Second "app run": a brand-new controller over the same storage.
      final second = await controller();

      expect(second.state.operations.single.clientOperationId, 'survivor');
    });

    test('retryable failure returns the op to PENDING with backoff', () async {
      final base = DateTime(2026, 1, 1, 12);
      final c = await controller(now: () => base);
      await c.enqueue(op('flaky'));

      await c.markRetryableFailure('flaky', 'HTTP 503');

      final stored = c.state.operations.single;
      expect(stored.status, OutboxStatus.pending);
      expect(stored.attempts, 1);
      expect(stored.lastError, 'HTTP 503');
      expect(stored.nextAttemptAt, base.add(const Duration(seconds: 30)));
      // Not due immediately after the failure…
      expect(stored.isDue(base), isFalse);
      // …but due once the backoff window has elapsed.
      expect(
        stored.isDue(base.add(const Duration(seconds: 31))),
        isTrue,
      );
    });

    test('permanent 4xx failure → FAILED_PERMANENT with reason', () async {
      final c = await controller();
      await c.enqueue(op('bad'));

      await c.markPermanentFailure('bad', 'HTTP 422');

      final stored = c.state.operations.single;
      expect(stored.status, OutboxStatus.failedPermanent);
      expect(stored.lastError, 'HTTP 422');
      expect(c.state.failedCount, 1);
    });

    test('retryFailed returns a FAILED_PERMANENT op to the PENDING queue',
        () async {
      final c = await controller();
      await c.enqueue(op('retry-me'));
      await c.markPermanentFailure('retry-me', 'HTTP 422');

      await c.retryFailed('retry-me');

      final stored = c.state.operations.single;
      expect(stored.status, OutboxStatus.pending);
      expect(stored.lastError, isNull);
      expect(stored.isDue(DateTime(2026, 1, 1)), isTrue);
    });

    test('discard removes a FAILED_PERMANENT op', () async {
      final c = await controller();
      await c.enqueue(op('discard-me'));
      await c.markPermanentFailure('discard-me', 'HTTP 422');

      await c.discard('discard-me');

      expect(c.state.operations, isEmpty);
    });

    test('clearForLogout wipes memory AND persistence', () async {
      final c = await controller();
      await c.enqueue(op('op-1'));
      expect(c.state.isNotEmpty, isTrue);

      await c.clearForLogout();

      expect(c.state.operations, isEmpty);
      // Persistence is gone too: a fresh controller hydrates nothing.
      final fresh = await controller();
      expect(fresh.state.operations, isEmpty);
    });

    group('F5-B: finite retry budget (maxRetryAttempts)', () {
      // The exact wall-clock waits of the UNCHANGED backoff formula
      // (30s * 2^(n-1), capped at 15 min) for attempts 1..11 — pinned as
      // literals so any accidental formula change breaks this test.
      const expectedWait = <int, int>{
        1: 30,
        2: 60,
        3: 120,
        4: 240,
        5: 480,
        6: 900,
        7: 900,
        8: 900,
        9: 900,
        10: 900,
        11: 900,
      };

      test('retryable failures 1..11 stay PENDING with the unchanged backoff',
          () async {
        final base = DateTime(2026, 1, 1, 12);
        final c = await controller(now: () => base);
        await c.enqueue(op('chain'));

        for (final entry in expectedWait.entries) {
          await c.markRetryableFailure('chain', 'HTTP 503 #${entry.key}');
          final stored = c.state.operations.single;
          expect(stored.status, OutboxStatus.pending,
              reason: 'attempt ${entry.key} must stay PENDING');
          expect(stored.attempts, entry.key,
              reason: 'attempt counter after ${entry.key} failures');
          expect(
            stored.nextAttemptAt,
            base.add(Duration(seconds: entry.value)),
            reason: 'backoff after attempt ${entry.key}',
          );
          expect(c.state.failedCount, 0, reason: 'no demotion below the cap');
        }
        expect(c.state.pendingCount, 1);
      });

      test('the 12th retryable failure ends the chain: FAILED_PERMANENT',
          () async {
        final base = DateTime(2026, 1, 1, 12);
        final c = await controller(now: () => base);
        await c.enqueue(op('cap'));

        // Eleven automatic retries keep the op alive…
        for (var i = 1; i < OutboxController.maxRetryAttempts; i++) {
          await c.markRetryableFailure('cap', 'HTTP 503');
        }
        expect(c.state.operations.single.status, OutboxStatus.pending);

        // …the 12th retryable failure exhausts the budget.
        expect(OutboxController.maxRetryAttempts, 12); // policy pinned
        await c.markRetryableFailure('cap', 'server never recovered');

        final stored = c.state.operations.single;
        expect(stored.status, OutboxStatus.failedPermanent);
        expect(stored.attempts, 12);
        expect(stored.lastError, 'server never recovered');
        expect(stored.nextAttemptAt, isNull);
        expect(c.state.failedCount, 1);
        expect(c.state.pendingCount, 0);
      });

      test('retryFailed after the cap resets attempts and restarts backoff',
          () async {
        final base = DateTime(2026, 1, 1, 12);
        // A capped op as persistence would restore it: FAILED_PERMANENT with
        // the budget spent and a stale (already elapsed) backoff deadline —
        // exactly what pre-F5-B permanent failures look like. The reset must
        // actually CLEAR that deadline, not keep it.
        final capped = op('capped').copyWith(
          status: OutboxStatus.failedPermanent,
          attempts: OutboxController.maxRetryAttempts,
          lastError: 'server never recovered',
          nextAttemptAt: base.subtract(const Duration(minutes: 30)),
        );
        final c = await controller(seeded: [capped], now: () => base);

        await c.retryFailed('capped');

        final reset = c.state.operations.single;
        expect(reset.status, OutboxStatus.pending);
        expect(reset.attempts, 0);
        expect(reset.nextAttemptAt, isNull);
        expect(reset.lastError, isNull);
        expect(reset.isDue(base), isTrue);

        // The next retryable failure starts the backoff from the FIRST step
        // (30s), not from the exhausted chain's position.
        await c.markRetryableFailure('capped', 'HTTP 503');
        final first = c.state.operations.single;
        expect(first.status, OutboxStatus.pending);
        expect(first.attempts, 1);
        expect(first.nextAttemptAt, base.add(const Duration(seconds: 30)));
      });

      test(
          'restart: persisted attempts survive; the cap still demotes after '
          'a restart', () async {
        final base = DateTime(2026, 1, 1, 12);
        // Run 1: three retryable failures are persisted with their backoff.
        final run1 = await controller(now: () => base);
        await run1.enqueue(op('survivor'));
        for (var i = 1; i <= 3; i++) {
          await run1.markRetryableFailure('survivor', 'HTTP 503');
        }
        expect(run1.state.operations.single.attempts, 3);

        // Run 2: a fresh controller over the same storage restores the
        // attempt counter and the pending backoff deadline verbatim.
        final run2 = await controller(now: () => base);
        final restored = run2.state.operations.single;
        expect(restored.attempts, 3);
        expect(restored.status, OutboxStatus.pending);
        expect(restored.nextAttemptAt, base.add(const Duration(seconds: 120)));

        // An op restored exactly at the budget boundary (11 prior attempts,
        // e.g. written by a pre-F5-B build) demotes on its NEXT failure…
        final boundary = op('boundary').copyWith(
          attempts: OutboxController.maxRetryAttempts - 1,
          lastError: 'HTTP 503',
        );
        final run2b = await controller(seeded: [boundary], now: () => base);
        expect(run2b.state.operations.single.attempts, 11);
        await run2b.markRetryableFailure('boundary', 'HTTP 503');
        final demoted = run2b.state.operations.single;
        expect(demoted.status, OutboxStatus.failedPermanent);
        expect(demoted.attempts, OutboxController.maxRetryAttempts);
        expect(demoted.nextAttemptAt, isNull);

        // …and the demotion itself is persisted across yet another restart.
        final run3 = await controller(now: () => base);
        final persisted = run3.state.operations.single;
        expect(persisted.status, OutboxStatus.failedPermanent);
        expect(persisted.attempts, OutboxController.maxRetryAttempts);
        expect(run3.state.failedCount, 1);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 0 + Phase 1.
  //
  // Phase 0: createdAt must survive every lifecycle transition and every
  // manual retry — the age display is only trustworthy if the timestamp is
  // immutable, and age must never gate a retry.
  //
  // Phase 1: the scope-filtered accessors must be exact and must never mutate
  // or drop anything from the persisted queue.
  // ───────────────────────────────────────────────────────────────────────
  group('Phase 0 — createdAt preservation and stale retry', () {
    final base = DateTime(2026, 1, 1, 12);
    final oldCreatedAt = base.subtract(const Duration(days: 400));

    test('retryFailed preserves the original createdAt verbatim', () async {
      final seeded = op(
        'stale-1',
        createdAt: oldCreatedAt,
        status: OutboxStatus.failedPermanent,
        idempotencyKey: 'stale-1',
      );
      final c = await controller(seeded: [seeded], now: () => base);

      final before = c.state.operations.single;
      expect(before.createdAt, oldCreatedAt);
      expect(before.isStaleAt(base), isTrue);

      await c.retryFailed('stale-1');

      final after = c.state.operations.single;
      // A 400-day-old operation is retried normally: no age gate, no demotion,
      // no silent loss. Durable identity makes the replay safe.
      expect(after.status, OutboxStatus.pending);
      expect(after.attempts, 0);
      expect(after.isDue(base), isTrue);
      // createdAt is untouched by the retry.
      expect(after.createdAt, oldCreatedAt);
    });

    test('every lifecycle transition preserves createdAt', () async {
      final c = await controller(now: () => base);
      await c
          .enqueue(op('lc-1', createdAt: oldCreatedAt, idempotencyKey: 'lc-1'));

      await c.markSending('lc-1');
      expect(c.state.operations.single.createdAt, oldCreatedAt);

      await c.markRetryableFailure('lc-1', 'boom');
      expect(c.state.operations.single.createdAt, oldCreatedAt);

      await c.markPermanentFailure('lc-1', 'nope');
      expect(c.state.operations.single.createdAt, oldCreatedAt);

      await c.retryFailed('lc-1');
      final retried = c.state.operations.single;
      expect(retried.createdAt, oldCreatedAt);
      // And identity is still intact across the whole chain.
      expect(retried.clientOperationId, 'lc-1');
      expect(retried.idempotencyKey, 'lc-1');
    });

    test('the retry budget cap also preserves createdAt', () async {
      final c = await controller(now: () => base);
      await c.enqueue(
          op('cap-1', createdAt: oldCreatedAt, idempotencyKey: 'cap-1'));

      for (var i = 0; i < OutboxController.maxRetryAttempts; i++) {
        await c.markRetryableFailure('cap-1', 'timeout');
      }
      final capped = c.state.operations.single;
      expect(capped.status, OutboxStatus.failedPermanent);
      expect(capped.createdAt, oldCreatedAt);
      // The demotion to FAILED_PERMANENT is caused by the budget, never by age.
      expect(capped.isStaleAt(base), isTrue);
      expect(capped.attempts, OutboxController.maxRetryAttempts);
    });

    test('enqueue stamps createdAt only when absent', () async {
      final c = await controller(now: () => base);
      await c.enqueue(op('stamp-none', idempotencyKey: 'stamp-none'));
      expect(c.state.operations.single.createdAt, base);

      final explicit = oldCreatedAt;
      await c.enqueue(op('stamp-explicit', createdAt: explicit));
      expect(
        c.state.operations
            .firstWhere((o) => o.clientOperationId == 'stamp-explicit')
            .createdAt,
        explicit,
      );
    });
  });

  group('Phase 1 — scope-filtered accessors', () {
    OutboxOperation pending(String id,
            {String c = 'company-1', String u = 'user-1'}) =>
        op(id, status: OutboxStatus.pending, companyId: c, userId: u);

    OutboxOperation failed(String id,
            {String c = 'company-1', String u = 'user-1'}) =>
        op(id, status: OutboxStatus.failedPermanent, companyId: c, userId: u);

    test('unresolvedFor returns only ops matching BOTH companyId and userId',
        () async {
      // NOTE: a SENDING entry cannot be seeded through storage — load()
      // normalises sending -> pending (pre-existing restart-recovery rule), so
      // the sending state is produced through markSending() instead.
      final c = await controller(
        seeded: [
          pending('mine-p'),
          pending('mine-s'),
          failed('mine-f'),
          pending('other-user-p', u: 'user-2'),
          failed('other-user-f', u: 'user-2'),
          pending('other-company-p', c: 'company-2'),
          failed('other-company-f', c: 'company-2'),
          // Same userId, different company: still foreign.
          pending('mixed-company', c: 'company-2'),
          // Same company, different userId: still foreign.
          failed('mixed-user', u: 'user-9'),
        ],
      );
      await c.markSending('mine-s');

      final mine = c.state.unresolvedFor('company-1', 'user-1');
      expect(
        mine.map((o) => o.clientOperationId).toSet(),
        {'mine-p', 'mine-s', 'mine-f'},
      );

      expect(c.state.pendingCountFor('company-1', 'user-1'), 1);
      expect(c.state.sendingCountFor('company-1', 'user-1'), 1);
      expect(c.state.failedCountFor('company-1', 'user-1'), 1);

      // A foreign-scope op that happens to be SENDING stays invisible.
      await c.markSending('other-user-p');
      expect(c.state.sendingCountFor('company-1', 'user-1'), 1);
      expect(c.state.unresolvedFor('company-1', 'user-1'), hasLength(3));
    });

    test('a foreign-only queue reports zero for every scoped counter',
        () async {
      final c = await controller(
        seeded: [
          failed('a-f', u: 'user-2'),
          pending('a-p', c: 'company-2'),
        ],
      );

      expect(c.state.unresolvedFor('company-1', 'user-1'), isEmpty);
      expect(c.state.pendingCountFor('company-1', 'user-1'), 0);
      expect(c.state.sendingCountFor('company-1', 'user-1'), 0);
      expect(c.state.failedCountFor('company-1', 'user-1'), 0);
      // The unscoped counters still see them — they remain for compatibility,
      // which is exactly why no user-visible surface may use them.
      expect(c.state.operations, hasLength(2));
      expect(c.state.pendingCount, 1);
      expect(c.state.failedCount, 1);
    });

    test('isInScope matches only on the exact companyId + userId pair', () {
      final mine = op('x', companyId: 'company-1', userId: 'user-1');
      expect(inScopeOf(mine, 'company-1', 'user-1'), isTrue);
      expect(inScopeOf(mine, 'company-1', 'user-2'), isFalse);
      expect(inScopeOf(mine, 'company-2', 'user-1'), isFalse);
    });

    test('mixed queue counts are exact', () async {
      final c = await controller(
        seeded: [
          pending('mine-1'),
          pending('mine-2'),
          pending('mine-3'),
          failed('mine-4'),
          pending('foreign-1', u: 'user-2'),
          failed('foreign-2', c: 'company-9'),
        ],
      );
      await c.markSending('mine-3');

      expect(c.state.unresolvedFor('company-1', 'user-1'), hasLength(4));
      expect(c.state.pendingCountFor('company-1', 'user-1'), 2);
      expect(c.state.sendingCountFor('company-1', 'user-1'), 1);
      expect(c.state.failedCountFor('company-1', 'user-1'), 1);
    });

    test(
        'filtering is pure — the underlying queue is neither mutated nor '
        'reordered nor deleted', () async {
      final seeded = [
        pending('p-1'),
        failed('f-1', u: 'user-2'),
        pending('p-2'),
      ];
      final c = await controller(seeded: seeded);
      final before =
          c.state.operations.map((o) => o.clientOperationId).toList();

      // Filter repeatedly, including for a scope that matches nothing.
      c.state.unresolvedFor('company-1', 'user-1');
      c.state.unresolvedFor('company-1', 'user-1');
      c.state.unresolvedFor('nobody', 'nobody');

      expect(
        c.state.operations.map((o) => o.clientOperationId).toList(),
        before,
      );
      expect(c.state.operations, hasLength(3));
    });

    test('the filtered view is unmodifiable and identity fields are intact',
        () async {
      final c = await controller(
        seeded: [
          op('id-1',
              companyId: 'company-1',
              userId: 'user-1',
              idempotencyKey: 'id-1',
              payload: const {'clientOperationId': 'id-1'}),
        ],
      );

      final view = c.state.unresolvedFor('company-1', 'user-1');
      expect(view, hasLength(1));
      expect(() => view.add(view.single), throwsUnsupportedError);

      final o = view.single;
      expect(o.clientOperationId, 'id-1');
      expect(o.idempotencyKey, 'id-1');
      expect(o.payload['clientOperationId'], 'id-1');
      expect(o.companyId, 'company-1');
      expect(o.userId, 'user-1');
    });

    test('scope filtering survives a restart (persisted scope is restored)',
        () async {
      final prefs = PreferencesStorage();
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      await storage.save([
        pending('keep-1'),
        failed('keep-2'),
        failed('foreign-1', u: 'user-2'),
      ]);

      final c = OutboxController(storage, now: () => DateTime(2026, 1, 1));
      await c.hydrate();

      expect(c.state.unresolvedFor('company-1', 'user-1'), hasLength(2));
      expect(c.state.failedCountFor('company-1', 'user-1'), 1);
      expect(c.state.failedCountFor('company-1', 'user-2'), 1);
      expect(c.state.unresolvedFor('company-1', 'user-2'), hasLength(1));
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // G16-N-3 P2-B-4 Phase 2 — bounded queue capacity (PD-3).
  //
  // Invariants under test:
  //  * capacity is SCOPED to companyId + userId;
  //  * the gate is atomic inside the existing _serialize lock;
  //  * a refusal mutates NOTHING (no state change, no save, no identity write);
  //  * recovery (retryFailed / discard / confirmSent) is NEVER gated, so a
  //    full queue can always be drained by the user;
  //  * dedupe is evaluated BEFORE capacity.
  // ───────────────────────────────────────────────────────────────────────
  group('Phase 2 — bounded queue capacity', () {
    const soft = OutboxController.softCapacityLimit;
    const hard = OutboxController.hardCapacityLimit;

    // The shared `controller()` helper reuses ONE SharedPreferences mock per
    // test, so a second controller would hydrate the first one's writes.
    // Phase 2 needs genuinely independent queues, hence this reset.
    Future<OutboxController> fresh() async {
      SharedPreferences.setMockInitialValues({});
      return controller();
    }

    OutboxOperation fill(String prefix, int count,
            {String c = 'company-1', String u = 'user-1'}) =>
        op(
          '$prefix-$count',
          companyId: c,
          userId: u,
          idempotencyKey: '$prefix-$count',
          createdAt: DateTime(2026, 1, 1),
        );

    Future<void> seed(OutboxController c, int n,
        {String prefix = 'seed',
        String company = 'company-1',
        String user = 'user-1'}) async {
      for (var i = 0; i < n; i++) {
        final r = await c.enqueue(
          fill(prefix, i, c: company, u: user),
        );
        expect(r, OutboxEnqueueOutcome.added);
      }
    }

    test('limits are the PD-3 approved values', () {
      expect(soft, 50);
      expect(hard, 200);
    });

    test('1-4: empty, 49, 50 and 199 all enqueue successfully', () async {
      final c0 = await fresh();
      expect(await c0.enqueue(op('a')), OutboxEnqueueOutcome.added);

      final c49 = await fresh();
      await seed(c49, 49);
      expect(c49.state.capacityUsedFor('company-1', 'user-1'), 49);
      expect(await c49.enqueue(op('fiftieth')), OutboxEnqueueOutcome.added);
      expect(c49.state.capacityUsedFor('company-1', 'user-1'), 50);
      // 50 is pressure, NOT a gate.
      expect(c49.state.isAtSoftCapacity('company-1', 'user-1'), isTrue);
      expect(c49.state.isAtHardCapacity('company-1', 'user-1'), isFalse);

      final c199 = await fresh();
      await seed(c199, 199, prefix: 'h');
      expect(
          await c199.enqueue(op('two-hundredth')), OutboxEnqueueOutcome.added);
      expect(c199.state.capacityUsedFor('company-1', 'user-1'), 200);
    });

    test('5: at the hard cap enqueue is refused', () async {
      final c = await fresh();
      await seed(c, hard);

      final outcome = await c.enqueue(op('overflow'));

      expect(outcome, OutboxEnqueueOutcome.capacityRefused);
      expect(c.state.capacityUsedFor('company-1', 'user-1'), hard);
    });

    test('13: refusal mutates nothing — state, order and identity intact',
        () async {
      final c = await fresh();
      await seed(c, hard);
      final before = c.state.operations;
      final beforeIds = before.map((o) => o.clientOperationId).toList();
      final rejected = op('overflow', idempotencyKey: 'overflow');

      expect(await c.enqueue(rejected), OutboxEnqueueOutcome.capacityRefused);

      expect(c.state.operations, hasLength(hard));
      expect(
        c.state.operations.map((o) => o.clientOperationId).toList(),
        beforeIds,
      );
      // Ordering preserved.
      expect(
        c.state.operations.map((o) => o.clientOperationId).toList(),
        beforeIds,
      );
      // The rejected operation was never mutated or persisted.
      expect(rejected.clientOperationId, 'overflow');
      expect(rejected.idempotencyKey, 'overflow');
    });

    test('6: discard at the cap frees capacity naturally', () async {
      final c = await fresh();
      await seed(c, hard);

      expect(await c.enqueue(op('nope')), OutboxEnqueueOutcome.capacityRefused);

      await c.discard('seed-0');

      expect(c.state.capacityUsedFor('company-1', 'user-1'), hard - 1);
      expect(await c.enqueue(op('now-fits')), OutboxEnqueueOutcome.added);
      expect(c.state.capacityUsedFor('company-1', 'user-1'), hard);
    });

    test('7: foreign-scope operations never consume this scope capacity',
        () async {
      final c = await fresh();
      // 200 ops belonging to somebody else.
      await seed(c, hard, prefix: 'foreign', user: 'user-2');
      expect(c.state.capacityUsedFor('company-1', 'user-1'), 0);
      expect(c.state.capacityUsedFor('company-1', 'user-2'), hard);

      // Our scope still accepts work.
      expect(await c.enqueue(op('mine')), OutboxEnqueueOutcome.added);
      expect(await c.enqueue(op('mine-2')), OutboxEnqueueOutcome.added);
    });

    test('8: mixed company/user scopes are counted and gated independently',
        () async {
      final c = await fresh();
      await seed(c, hard, prefix: 'c1u1');
      await seed(c, hard, prefix: 'c1u2', user: 'user-2');
      await seed(c, hard, prefix: 'c2u1', company: 'company-2');

      expect(c.state.capacityUsedFor('company-1', 'user-1'), hard);
      expect(c.state.capacityUsedFor('company-1', 'user-2'), hard);
      expect(c.state.capacityUsedFor('company-2', 'user-1'), hard);

      // Every scope is individually at its cap.
      expect(await c.enqueue(op('x', userId: 'user-2')),
          OutboxEnqueueOutcome.capacityRefused);
      expect(await c.enqueue(op('y', companyId: 'company-2')),
          OutboxEnqueueOutcome.capacityRefused);
      expect(await c.enqueue(op('z')), OutboxEnqueueOutcome.capacityRefused);
      // Total persisted count is untouched by any refusal.
      expect(c.state.operations, hasLength(hard * 3));
    });

    test('9: PENDING + SENDING + FAILED_PERMANENT all count', () async {
      final c = await fresh();
      await c.enqueue(op('p'));
      await c.enqueue(op('s'));
      await c.enqueue(op('f'));
      await c.markSending('s');
      await c.markPermanentFailure('p', 'boom');

      expect(c.state.pendingCountFor('company-1', 'user-1'), 1);
      expect(c.state.sendingCountFor('company-1', 'user-1'), 1);
      expect(c.state.failedCountFor('company-1', 'user-1'), 1);
      expect(c.state.capacityUsedFor('company-1', 'user-1'), 3);
    });

    test('duplicate is evaluated BEFORE capacity (F5-A same-key replay)',
        () async {
      final c = await fresh();
      await seed(c, hard);

      // Same id, queue full => duplicate, NOT a refusal.
      expect(await c.enqueue(op('seed-0')), OutboxEnqueueOutcome.duplicate);
    });

    test('11: retryFailed is never capacity-gated (no deadlock)', () async {
      final c = await fresh();
      await seed(c, hard - 1);
      await c.enqueue(op('stuck', idempotencyKey: 'stuck'));
      await c.markPermanentFailure('stuck', 'permanent');
      expect(c.state.capacityUsedFor('company-1', 'user-1'), hard);

      // The queue is full, yet recovery must still work.
      await c.retryFailed('stuck');

      final recovered =
          c.state.operations.firstWhere((o) => o.clientOperationId == 'stuck');
      expect(recovered.status, OutboxStatus.pending);
      expect(recovered.attempts, 0);
      expect(recovered.idempotencyKey, 'stuck');
    });

    test('12: refusal never rewrites identity of queued operations', () async {
      final c = await fresh();
      await seed(c, hard);
      final snapshot = {
        for (final o in c.state.operations)
          o.clientOperationId: (o.idempotencyKey, o.payload),
      };

      await c.enqueue(op('overflow', idempotencyKey: 'overflow'));

      for (final o in c.state.operations) {
        expect(o.idempotencyKey, snapshot[o.clientOperationId]!.$1);
        expect(o.payload, snapshot[o.clientOperationId]!.$2);
      }
    });

    test('14: concurrent enqueue at 199 admits exactly one', () async {
      final c = await fresh();
      await seed(c, hard - 1);

      // Fire 10 concurrent enqueues. The gate lives inside _serialize, so the
      // first wins and every other must observe the now-full queue.
      final results = await Future.wait([
        for (var i = 0; i < 10; i++) c.enqueue(op('race-$i')),
      ]);

      expect(
          results.where((r) => r == OutboxEnqueueOutcome.added), hasLength(1));
      expect(
        results.where((r) => r == OutboxEnqueueOutcome.capacityRefused),
        hasLength(9),
      );
      // The hard cap holds exactly — never exceeded.
      expect(c.state.capacityUsedFor('company-1', 'user-1'), hard);
      expect(c.state.operations, hasLength(hard));
    });

    test('10: the cap still holds after a restart', () async {
      final prefs = PreferencesStorage();
      await prefs.initialize();
      final storage = OutboxStorage(prefs);
      final first = OutboxController(storage);
      await first.hydrate();
      await seed(first, hard);

      // Simulate a cold start against the same persisted storage.
      final restarted = OutboxController(storage);
      await restarted.hydrate();
      expect(restarted.state.capacityUsedFor('company-1', 'user-1'), hard);
      expect(await restarted.enqueue(op('after-restart')),
          OutboxEnqueueOutcome.capacityRefused);

      await restarted.discard('seed-0');
      expect(
          await restarted.enqueue(op('fits-now')), OutboxEnqueueOutcome.added);
    });

    test('capacity pressure accessors agree with the gate', () async {
      final c = await fresh();
      await seed(c, soft);
      expect(c.state.isAtSoftCapacity('company-1', 'user-1'), isTrue);
      expect(c.state.isAtHardCapacity('company-1', 'user-1'), isFalse);

      await seed(c, hard - soft, prefix: 'more');
      expect(c.state.isAtHardCapacity('company-1', 'user-1'), isTrue);
      // A foreign scope is unaffected by our pressure.
      expect(c.state.isAtSoftCapacity('company-1', 'user-9'), isFalse);
      expect(c.state.isAtHardCapacity('company-9', 'user-1'), isFalse);
    });

    test('OutboxCapacityExceeded carries the limit and is not a StateError',
        () {
      const e = OutboxCapacityExceeded(OutboxController.hardCapacityLimit);
      expect(e.limit, 200);
      expect(e, isNot(isA<StateError>()));
      expect(e.toString(), contains('200'));
    });
  });
}
