import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

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
  }) {
    return OutboxOperation(
      clientOperationId: id,
      kind: OutboxOperationKind.createSale,
      companyId: 'company-1',
      userId: 'user-1',
      payload: const {'saleNumber': 'OFF-x'},
      status: status,
      createdAt: createdAt,
    );
  }

  group('OutboxController', () {
    test('enqueue adds an op and exposes it to the UI state', () async {
      final c = await controller();

      final added = await c.enqueue(op('op-1'));

      expect(added, isTrue);
      expect(c.state.pendingCount, 1);
      expect(c.state.operations.single.clientOperationId, 'op-1');
    });

    test('duplicate clientOperationId is a no-op (no second entry)',
        () async {
      final c = await controller();
      await c.enqueue(op('same-id'));

      final addedAgain = await c.enqueue(op('same-id'));

      expect(addedAgain, isFalse);
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

    test('retryable failure returns the op to PENDING with backoff',
        () async {
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

      test('restart: persisted attempts survive; the cap still demotes after '
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
}