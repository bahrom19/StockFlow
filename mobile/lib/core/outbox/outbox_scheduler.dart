import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/core/services/connectivity_service.dart';

import 'outbox_controller.dart';
import 'outbox_operation.dart';
import 'outbox_sync_service.dart';

/// Creates the single retry timer for the scheduler. Injectable so tests can
/// drive time deterministically (no real async waiting).
typedef OutboxRetryTimerFactory = Timer Function(
  Duration delay,
  void Function() onFire,
);

/// Phase F5-C-A: automatic retry scheduling for the durable outbox.
///
/// F5-B gave every operation a finite automatic retry budget, but nothing
/// fired when the backoff deadline actually arrived: [nextAttemptAt] is a
/// due-filter inside the worker, and the only flush triggers were the manual
/// "Send now" / Retry actions and the app-level resume / OFFLINE→ONLINE
/// bursts. A retryable failure on a foregrounded device therefore stalled
/// until one of those external triggers happened.
///
/// [OutboxRetryScheduler] closes that gap with ONE decision only — WHEN to
/// call the existing worker burst ([OutboxSyncService.syncAll], F3/F4). It
/// owns NO retry policy, NO error classification, NO backoff formula and NO
/// idempotency logic: the worker keeps the whole send pipeline, the
/// controller keeps the backoff/cap state machine. There is deliberately no
/// second worker and no second queue.
///
/// Invariants:
/// * at most ONE active timer; every re-arm cancels the previous one;
/// * no timer for an empty queue, a queue without PENDING entries, or while
///   OFFLINE (the worker refuses to flush anyway);
/// * SENDING and FAILED_PERMANENT entries are never scheduled — a capped op
///   only moves again through the explicit manual Retry (F5-B);
/// * an entry whose deadline has already passed fires one burst immediately
///   (this also covers the cold-start backlog and a manual retry reset);
/// * a burst fires at most ONCE per identical PENDING queue state (the
///   fingerprint gate) — a burst that changed nothing (worker busy, scope
///   skip, race to OFFLINE) can never degenerate into a hot loop;
/// * bursts never stack: while one is in flight the next one is deferred to
///   the post-burst re-arm, on top of the worker's own re-entrancy guard.
class OutboxRetryScheduler {
  OutboxRetryScheduler({
    required OutboxState Function() snapshot,
    required bool Function() isOnline,
    required Future<void> Function() sync,
    DateTime Function()? now,
    OutboxRetryTimerFactory? timerFactory,
    AppLogger? logger,
  })  : _snapshot = snapshot,
        _isOnline = isOnline,
        _sync = sync,
        _now = now ?? DateTime.now,
        _timerFactory = timerFactory ?? _defaultTimerFactory,
        _logger = logger ?? AppLogger('OutboxRetryScheduler');

  static Timer _defaultTimerFactory(Duration delay, void Function() onFire) =>
      Timer(delay, onFire);

  /// Read-only queue snapshot (the controller's current [OutboxState]).
  final OutboxState Function() _snapshot;

  /// The single connectivity signal — same source the worker uses.
  final bool Function() _isOnline;

  /// The existing worker burst ([OutboxSyncService.syncAll]) — the scheduler
  /// never sends anything itself.
  final Future<void> Function() _sync;

  final DateTime Function() _now;
  final OutboxRetryTimerFactory _timerFactory;
  final AppLogger _logger;

  Timer? _timer;
  bool _disposed = false;
  bool _burstInFlight = false;
  String _lastFiredFingerprint = '';

  /// Re-evaluates the schedule. Called on every queue mutation and on
  /// connectivity flips (the [outboxSchedulerProvider] wiring). Idempotent
  /// and cheap: the previous timer is always cancelled first, so repeated
  /// calls with an unchanged queue never accumulate timers or bursts.
  void notifyChanged() {
    if (_disposed) return;
    _rearm();
  }

  /// Stops scheduling for good (provider disposal). A burst already in
  /// flight completes naturally — the worker owns its own lifecycle.
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    _timer = null;
  }

  void _rearm() {
    _timer?.cancel();
    _timer = null;
    if (_disposed) return;

    // OFFLINE: keep everything disarmed. A later connectivity flip re-enters
    // through [notifyChanged] (provider wiring).
    if (!_isOnline()) return;

    final now = _now();
    final pending = _snapshot()
        .operations
        .where((o) => o.status == OutboxStatus.pending)
        .toList(growable: false);

    DateTime? earliest;
    var dueNow = false;
    for (final op in pending) {
      final due = op.nextAttemptAt;
      if (due == null || !due.isAfter(now)) {
        dueNow = true;
      } else if (earliest == null || due.isBefore(earliest)) {
        earliest = due;
      }
    }

    if (dueNow) {
      // Something is due immediately: fire one burst — but only once per
      // identical PENDING queue state, so a no-op burst (worker busy, scope
      // skip, offline race) can never turn into a busy loop.
      _fire(_fingerprintOf(pending));
      return;
    }

    if (earliest != null) {
      final delay = earliest.difference(now);
      _timer = _timerFactory(
        delay.isNegative ? Duration.zero : delay,
        _onTimerFired,
      );
      _logger.info('Outbox retry scheduled in ${delay.inMilliseconds}ms');
    }
  }

  void _onTimerFired() {
    // The backoff deadline arrived — re-evaluate. The queue may have changed
    // since this timer was armed; the fingerprint gate keeps this safe.
    notifyChanged();
  }

  void _fire(String fingerprint) {
    if (_disposed || _burstInFlight) return;
    // Fingerprint gate: at most ONE burst per identical PENDING queue state —
    // a no-op burst (worker busy, scope skip, offline race) must never
    // degenerate into a hot loop. A burst deferred by the in-flight guard
    // above never consumed its fingerprint, so it stays fireable after the
    // current burst completes.
    if (fingerprint == _lastFiredFingerprint) return;
    _lastFiredFingerprint = fingerprint;
    _burstInFlight = true;
    _logger.info('Outbox retry burst fired');
    unawaited(
      _sync().whenComplete(() {
        _burstInFlight = false;
        // The burst usually mutates the queue and the controller listener
        // re-arms anyway, but a zero-change completion must re-evaluate too —
        // e.g. to arm the next future-due timer after a race with a manual
        // pass, or to discover that the worker skipped everything (nothing
        // left to do for this exact queue state).
        notifyChanged();
      }),
    );
  }

  /// Stable identity of the PENDING part of the queue: ids, attempt counters
  /// and deadlines. Any worker transition (sent / retried / capped) changes
  /// at least one of them.
  static String _fingerprintOf(List<OutboxOperation> pending) => pending
      .map(
        (o) =>
            '${o.clientOperationId}|${o.attempts}|'
            '${o.nextAttemptAt?.millisecondsSinceEpoch ?? 0}',
      )
      .join(';');
}

/// Injectable clock for the scheduler wiring (F5-C-B): production uses the
/// wall clock; wiring tests override it to drive retry timing
/// deterministically. It MUST agree with the controller's clock (tests
/// override both with the same value) — the worker's due-filter and the
/// scheduler compute against one notion of "now".
final outboxSchedulerClockProvider =
    Provider<DateTime Function()>((ref) => DateTime.now);

/// Injectable timer factory for the scheduler wiring (F5-C-B): production
/// arms real [Timer]s; wiring tests override it with a manually advanced
/// fake schedule.
final outboxSchedulerTimerFactoryProvider =
    Provider<OutboxRetryTimerFactory>(
  (ref) => (delay, onFire) => Timer(delay, onFire),
);

/// Wiring: the scheduler observes THE outbox controller queue and THE single
/// connectivity signal, and drives THE sync worker — the same instances the
/// manual triggers use. No second worker, no second queue, no duplicated
/// policy: every controller state mutation and every connectivity flip
/// re-enters [OutboxRetryScheduler.notifyChanged], which re-arms the single
/// timer (or fires a due burst).
///
/// The provider is inert until watched — the F5-C-B wiring (one watch in the
/// outbox indicator shell) arms it for the whole app.
final outboxSchedulerProvider = Provider<OutboxRetryScheduler>((ref) {
  final scheduler = OutboxRetryScheduler(
    snapshot: () => ref.read(outboxControllerProvider),
    isOnline: () => ref.read(connectivityStatusProvider),
    sync: () async {
      await ref.read(outboxSyncProvider).syncAll();
    },
    now: ref.watch(outboxSchedulerClockProvider),
    timerFactory: ref.watch(outboxSchedulerTimerFactoryProvider),
  );
  ref.onDispose(scheduler.dispose);

  // Re-evaluate on every queue mutation: enqueue, sending, retryable failure
  // (backoff deadline moved), the F5-B cap demotion, confirm/removal, manual
  // retry (attempts reset → due immediately), discard and the logout wipe.
  ref.listen<OutboxState>(outboxControllerProvider, (_, __) {
    scheduler.notifyChanged();
  });

  // Re-evaluate on connectivity flips: reconnection re-arms the schedule, an
  // outage disarms it. A listen callback never fires for the initial value —
  // matching the app-level "no burst on launch" rule.
  ref.listen<bool>(connectivityStatusProvider, (_, __) {
    scheduler.notifyChanged();
  });

  // Initial probe: covers the case where this provider is first watched AFTER
  // the queue was already hydrated — listen would never fire for the current
  // value, and a persisted backlog must be flushed on cold start.
  scheduler.notifyChanged();
  return scheduler;
});