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
  });
}