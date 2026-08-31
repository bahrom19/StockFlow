import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_scheduler.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

/// Deterministic timer: records itself in the shared schedule and fires only
/// through [elapse], so tests never rely on real async waiting.
class _FakeTimer implements Timer {
  _FakeTimer(this._schedule, this._callback);

  final List<_FakeTimer> _schedule;
  final void Function() _callback;
  bool _cancelled = false;

  @override
  bool get isActive => !_cancelled && _schedule.contains(this);

  void elapse() {
    if (_cancelled) return;
    _schedule.remove(this);
    _callback();
  }

  @override
  void cancel() {
    _cancelled = true;
    _schedule.remove(this);
  }

  @override
  int get tick => 0;
}

/// Wires the real controller + real F3/F4 sync worker to the scheduler, with
/// an injectable clock/timer so time only moves when a test moves it.
class _Harness {
  List<_FakeTimer> timerSchedule = <_FakeTimer>[];
  List<DateTime> syncCalls = <DateTime>[];
  DateTime now = DateTime(2026, 1, 1, 12);
  bool online;
  bool flushReentry = false;
  Object? failWith;

  /// Mutable current user — the sync service's scope guard compares each op
  /// against this, so tests can switch the auth scope.
  CurrentUser? user =
      const CurrentUser(id: 'user-1', email: 'u@t', companyId: 'company-1');

  late PreferencesStorage _prefs;
  late OutboxStorage _storage;
  late OutboxController controller;
  late OutboxSyncService service;
  late OutboxRetryScheduler scheduler;

  _Harness({this.online = true});

  Future<void> init() async {
    SharedPreferences.setMockInitialValues({});
    _prefs = PreferencesStorage();
    await _prefs.initialize();
    _storage = OutboxStorage(_prefs);
    controller = OutboxController(_storage, now: () => now);
    await controller.hydrate();
    service = OutboxSyncService(
      controller: controller,
      post: _post,
      currentUser: () => user,
      isOnline: () => online,
    );
    scheduler = OutboxRetryScheduler(
      snapshot: () => controller.state,
      isOnline: () => online,
      sync: () => service.syncAll(),
      now: () => now,
      timerFactory: (delay, onFire) {
        final timer = _FakeTimer(timerSchedule, onFire);
        timerSchedule.add(timer);
        return timer;
      },
    );
  }

  Future<dynamic> _post(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
  }) async {
    syncCalls.add(now);
    if (failWith != null) throw failWith!;
    if (flushReentry) {
      flushReentry = false;
      // Simulates the legacy double-flush pattern: a flush started from
      // inside a flush must be collapsed by the worker's re-entrancy guard.
      await service.syncAll();
    }
    return const {'id': 'ok'};
  }
}

OutboxOperation op(
  String id, {
  DateTime? createdAt,
  OutboxStatus status = OutboxStatus.pending,
  DateTime? nextAttemptAt,
}) {
  return OutboxOperation(
    clientOperationId: id,
    kind: OutboxOperationKind.createSale,
    companyId: 'company-1',
    userId: 'user-1',
    payload: const {'saleNumber': 'OFF-x'},
    status: status,
    createdAt: createdAt,
    nextAttemptAt: nextAttemptAt,
  );
}

DioException _status(int statusCode) {
  final options = RequestOptions(path: '/sales');
  return DioException(
    requestOptions: options,
    response: Response<dynamic>(requestOptions: options, statusCode: statusCode),
    type: DioExceptionType.badResponse,
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('OutboxRetryScheduler', () {
    test('arms ONE timer on the nearest nextAttemptAt without syncing',
        () async {
      final h = _Harness();
      await h.init();
      final base = DateTime(2026, 1, 1, 12);
      h.now = base;
      await h.controller.enqueue(
        op('far', nextAttemptAt: base.add(const Duration(minutes: 5))),
      );
      await h.controller.enqueue(
        op('near', nextAttemptAt: base.add(const Duration(seconds: 30))),
      );

      h.scheduler.notifyChanged();

      expect(h.timerSchedule, hasLength(1), reason: 'a single active timer');
      expect(h.syncCalls, isEmpty, reason: 'arming itself never flushes');
    });

    test('timer fire runs the worker: due op is sent and confirmed', () async {
      final h = _Harness();
      await h.init();
      final base = DateTime(2026, 1, 1, 12);
      h.now = base;
      await h.controller.enqueue(
        op('op-1', nextAttemptAt: base.add(const Duration(seconds: 30))),
      );
      h.scheduler.notifyChanged();
      expect(h.timerSchedule, hasLength(1));

      h.now = base.add(const Duration(seconds: 30));
      h.timerSchedule.single.elapse();
      await pumpEventQueue();

      expect(h.syncCalls, hasLength(1));
      expect(h.controller.state.operations, isEmpty);
      expect(h.controller.state.pendingCount, 0);
      expect(
        h.timerSchedule.where((t) => t.isActive),
        isEmpty,
        reason: 'empty queue → nothing is armed afterwards',
      );
    });

    test('no due/pending entries → nothing is armed and nothing is sent',
        () async {
      final base = DateTime(2026, 1, 1, 12);

      // empty queue
      final empty = _Harness();
      await empty.init();
      empty.scheduler.notifyChanged();
      expect(empty.timerSchedule, isEmpty);
      expect(empty.syncCalls, isEmpty);

      // pending op, but its deadline is in the future → one timer, no burst
      final h = _Harness();
      await h.init();
      h.now = base;
      await h.controller.enqueue(
        op('op-1', nextAttemptAt: base.add(const Duration(seconds: 30))),
      );
      h.scheduler.notifyChanged();

      expect(h.timerSchedule, hasLength(1));
      expect(h.syncCalls, isEmpty);
      expect(h.controller.state.pendingCount, 1);
    });

    test('scope guard: the scheduler fires, but the worker refuses foreign ops',
        () async {
      final h = _Harness();
      await h.init();
      h.now = DateTime(2026, 1, 1, 12);
      await h.controller.enqueue(op('foreign-op'));

      h.user = const CurrentUser(
        id: 'user-1',
        email: 'u@t',
        companyId: 'company-2',
      );

      h.scheduler.notifyChanged();
      await pumpEventQueue();

      expect(
        h.syncCalls,
        isEmpty,
        reason: 'the WHAT-decision stays inside the sync service',
      );
      expect(h.controller.state.pendingCount, 1);
    });

    test('repeated queue notifications re-arm ONE timer without duplicates',
        () async {
      final h = _Harness();
      await h.init();
      final base = DateTime(2026, 1, 1, 12);
      h.now = base;
      await h.controller.enqueue(
        op('op-1', nextAttemptAt: base.add(const Duration(seconds: 30))),
      );

      for (var i = 0; i < 5; i++) {
        h.scheduler.notifyChanged();
      }

      expect(h.timerSchedule, hasLength(1));
      expect(h.syncCalls, isEmpty);
    });

    test('offline: no arming and fire does not send; reconnect re-arms',
        () async {
      final h = _Harness(online: false);
      await h.init();
      final base = DateTime(2026, 1, 1, 12);
      h.now = base;
      await h.controller.enqueue(
        op('op-1', nextAttemptAt: base.add(const Duration(seconds: 30))),
      );

      // armed while offline → never
      h.scheduler.notifyChanged();
      expect(h.timerSchedule, isEmpty);

      // connectivity flip re-arms
      h.online = true;
      h.scheduler.notifyChanged();
      expect(h.timerSchedule, hasLength(1));

      // an offline race between arming and firing must not send anything
      h.online = false;
      h.timerSchedule.single.elapse();
      await pumpEventQueue();

      expect(h.syncCalls, isEmpty);
      expect(h.controller.state.pendingCount, 1);
    });

    test(
        're-entrancy: a flush started from inside a flush is collapsed '
        'to one pass', () async {
      final h = _Harness();
      await h.init();
      h.flushReentry = true;
      await h.controller.enqueue(op('op-1'));

      h.scheduler.notifyChanged();
      await pumpEventQueue();

      expect(
        h.syncCalls,
        hasLength(1),
        reason: 'the worker skips the re-entrant pass (no second POST)',
      );
      expect(h.controller.state.operations, isEmpty);
    });

    test(
        'fingerprint gate: a burst that changes nothing fires once per '
        'identical queue state (no hot loop)', () async {
      final h = _Harness();
      await h.init();
      var syncCount = 0;
      final schedule = <_FakeTimer>[];
      final scheduler = OutboxRetryScheduler(
        snapshot: () => h.controller.state,
        isOnline: () => true,
        sync: () async {
          syncCount++;
        },
        now: () => h.now,
        timerFactory: (delay, onFire) {
          final timer = _FakeTimer(schedule, onFire);
          schedule.add(timer);
          return timer;
        },
      );
      h.now = DateTime(2026, 1, 1, 12);
      await h.controller.enqueue(op('op-1'));

      scheduler.notifyChanged();
      await pumpEventQueue();
      expect(syncCount, 1);

      // The no-op sync leaves the queue untouched: every further
      // notification sees the same PENDING fingerprint → suppressed.
      for (var i = 0; i < 3; i++) {
        scheduler.notifyChanged();
      }
      await pumpEventQueue();
      expect(syncCount, 1);

      // Proves the gate is fingerprint-based, not time-based: even a much
      // later re-arm with the unchanged queue does not re-fire.
      h.now = h.now.add(const Duration(hours: 1));
      scheduler.notifyChanged();
      await pumpEventQueue();
      expect(syncCount, 1);
    });

    test('FAILED_PERMANENT is never scheduled; only manual retry plans it',
        () async {
      final h = _Harness();
      await h.init();
      h.now = DateTime(2026, 1, 1, 12);
      await h.controller.enqueue(
        op('op-1', status: OutboxStatus.failedPermanent),
      );

      h.scheduler.notifyChanged();
      expect(h.timerSchedule, isEmpty);
      expect(h.syncCalls, isEmpty);

      // Manual retry resets the F5-B budget → due immediately → one burst.
      await h.controller.retryFailed('op-1');
      h.scheduler.notifyChanged();
      await pumpEventQueue();

      expect(h.syncCalls, hasLength(1));
      expect(h.controller.state.operations, isEmpty);
    });

    test('automatic chain drives real backoff: each fire advances attempts',
        () async {
      final h = _Harness();
      await h.init();
      final base = DateTime(2026, 1, 1, 12);
      h.now = base;
      h.failWith = _status(503);
      await h.controller.enqueue(op('op-1'));

      // attempt 1 (no deadline yet → immediate burst), then attempts 2..4
      // each on their own backoff deadline moved by the worker.
      for (var i = 1; i <= 4; i++) {
        h.scheduler.notifyChanged();
        await pumpEventQueue();
        final single = h.controller.state.operations.single;
        expect(single.status, OutboxStatus.pending);
        expect(single.attempts, i, reason: 'attempt $i');
        if (i < 4) {
          h.now = single.nextAttemptAt!;
        }
      }
      expect(h.syncCalls, hasLength(4));
      // 5xx backoff: 30s + 60s + 120s + 240s = 450s from the first attempt —
      // the F5-B formula, untouched.
      expect(
        h.controller.state.operations.single.nextAttemptAt!.difference(base),
        const Duration(seconds: 450),
      );
    });

    test('F5-B cap: the 12th automatic attempt ends in FAILED_PERMANENT',
        () async {
      final h = _Harness();
      await h.init();
      final base = DateTime(2026, 1, 1, 12);
      h.now = base;
      h.failWith = _status(503);
      await h.controller.enqueue(op('op-1'));

      for (var i = 1; i <= 12; i++) {
        h.scheduler.notifyChanged();
        await pumpEventQueue();
        final single = h.controller.state.operations.single;
        if (i < 12) {
          expect(single.status, OutboxStatus.pending, reason: 'attempt $i');
          expect(single.attempts, i, reason: 'attempt $i');
          h.now = single.nextAttemptAt!;
        } else {
          expect(
            single.status,
            OutboxStatus.failedPermanent,
            reason: 'attempt $i hits the cap',
          );
          expect(single.attempts, 12);
          expect(single.lastError, isNotNull);
          expect(single.nextAttemptAt, isNull);
        }
      }
      expect(h.syncCalls, hasLength(12));
      expect(h.controller.state.pendingCount, 0);
      expect(h.controller.state.failedCount, 1);

      // capped op: no further arming, no further automatic attempts
      h.scheduler.notifyChanged();
      await pumpEventQueue();
      expect(h.timerSchedule.where((t) => t.isActive), isEmpty);
      expect(h.syncCalls, hasLength(12));

      // manual retry still works with a fresh budget and succeeds
      h.failWith = null;
      await h.controller.retryFailed('op-1');
      h.scheduler.notifyChanged();
      await pumpEventQueue();

      expect(h.syncCalls, hasLength(13));
      expect(h.controller.state.operations, isEmpty);
    });
  });
}