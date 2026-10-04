import 'dart:async' show unawaited;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/auth/auth_state.dart';

import 'outbox_operation.dart';
import 'outbox_storage.dart';

/// Outcome of [OutboxController.enqueue].
///
/// G16-N-3 P2-B-4 Phase 2. A dedicated result replaces the previous `bool`
/// because `false` was already ambiguous — it meant "duplicate" — and because
/// BOTH direct callers previously discarded the return value entirely, so a
/// refusal would have been indistinguishable from a successful park.
enum OutboxEnqueueOutcome {
  /// The operation was appended and persisted.
  added,

  /// An operation with the same `clientOperationId` was already queued, so the
  /// enqueue was a no-op. The already-queued operation is authoritative and is
  /// left untouched — its identity is never rewritten.
  duplicate,

  /// The current scope already holds [OutboxController.hardCapacityLimit]
  /// unresolved operations. Nothing was mutated or persisted.
  capacityRefused,
}

/// Raised when an enqueue is refused because the current scope is at
/// [OutboxController.hardCapacityLimit].
///
/// Deliberately NOT a [StateError]: `StateError` already means "no
/// authenticated user" and existing `on StateError` handlers must keep that
/// single meaning. An uncaught instance therefore fails loudly instead of
/// being silently reported to the user as "saved offline".
class OutboxCapacityExceeded implements Exception {
  const OutboxCapacityExceeded(this.limit);

  /// The hard cap that was reached.
  final int limit;

  @override
  String toString() =>
      'OutboxCapacityExceeded: the offline queue already holds $limit '
      'unresolved changes for this account.';
}

/// Immutable snapshot of the outbox for UI and the sync worker.
class OutboxState {
  const OutboxState({this.operations = const <OutboxOperation>[]});

  /// FIFO-ordered queue.
  final List<OutboxOperation> operations;

  int get pendingCount =>
      operations.where((o) => o.status == OutboxStatus.pending).length;

  int get failedCount =>
      operations.where((o) => o.status == OutboxStatus.failedPermanent).length;

  int get sendingCount =>
      operations.where((o) => o.status == OutboxStatus.sending).length;

  bool get isEmpty => operations.isEmpty;
  bool get isNotEmpty => operations.isNotEmpty;

  // ── G16-N-3 P2-B-4 Phase 1 (F2): scope-safe views ──────────────────────
  //
  // The unscoped counters above stay for backward compatibility, but they must
  // NOT be used for anything the authenticated user sees. On a shared till the
  // persisted queue can legitimately hold operations belonging to a previous
  // user or a previous company, and a global count would leak their existence
  // (and, through the failed-ops dialog, their payload) across the account
  // boundary.
  //
  // Scope is EXACTLY companyId + userId — the same pair the sync worker's
  // dispatch-time scope guard compares. Filtering here is a second, independent
  // layer; the worker guard is unchanged and remains the authority on whether
  // an operation may actually be SENT.

  /// Operations belonging to [companyId] + [userId] that are still
  /// unresolved, i.e. every non-terminal status.
  ///
  /// All three [OutboxStatus] values are unresolved by construction: an
  /// operation leaves the queue only via `confirmSent` (server confirmation or
  /// a recognised duplicate), the user's explicit `discard`, or a scope change.
  /// There is therefore no "completed" entry to exclude here.
  ///
  /// Purely a filter — the returned list is unmodifiable and the underlying
  /// [operations] are never mutated, reordered or removed.
  List<OutboxOperation> unresolvedFor(String companyId, String userId) {
    return operations
        .where((o) => o.companyId == companyId && o.userId == userId)
        .toList(growable: false);
  }

  bool isInScope(OutboxOperation op, String companyId, String userId) =>
      op.companyId == companyId && op.userId == userId;

  /// PENDING operations visible to [companyId] + [userId].
  int pendingCountFor(String companyId, String userId) => operations
      .where((o) =>
          o.companyId == companyId &&
          o.userId == userId &&
          o.status == OutboxStatus.pending)
      .length;

  /// SENDING operations visible to [companyId] + [userId].
  int sendingCountFor(String companyId, String userId) => operations
      .where((o) =>
          o.companyId == companyId &&
          o.userId == userId &&
          o.status == OutboxStatus.sending)
      .length;

  /// FAILED_PERMANENT operations visible to [companyId] + [userId].
  int failedCountFor(String companyId, String userId) => operations
      .where((o) =>
          o.companyId == companyId &&
          o.userId == userId &&
          o.status == OutboxStatus.failedPermanent)
      .length;

  /// G16-N-3 P2-B-4 Phase 2: total unresolved operations visible to
  /// [companyId] + [userId] — the number the capacity gate is evaluated
  /// against and the number the pressure warning may display.
  ///
  /// Derived from [unresolvedFor] so the gate, the badge and the warning can
  /// never disagree: there is exactly one definition of "how full is this
  /// queue". Scope is companyId + userId, so a foreign account's backlog is
  /// never counted here and can never be inferred from it.
  int capacityUsedFor(String companyId, String userId) =>
      unresolvedFor(companyId, userId).length;

  /// True when this scope has reached the soft cap (visible pressure). The
  /// queue is still fully functional — enqueue is not gated here.
  bool isAtSoftCapacity(String companyId, String userId) =>
      capacityUsedFor(companyId, userId) >= OutboxController.softCapacityLimit;

  /// True when this scope has reached the hard cap, so the next enqueue will
  /// be refused.
  bool isAtHardCapacity(String companyId, String userId) =>
      capacityUsedFor(companyId, userId) >= OutboxController.hardCapacityLimit;
}

/// In-memory owner of the outbox queue.
///
/// Responsibilities:
/// * enqueue with clientOperationId dedupe (re-enqueue == no-op);
/// * keep FIFO order and persist on every mutation;
/// * apply the retry backoff policy (30s * 2^n, capped) and the F5-B finite
///   retry budget — a retryable chain longer than [OutboxController
///   .maxRetryAttempts] attempts ends in FAILED_PERMANENT;
/// * expose counts for the compact UI indicator;
/// * wipe the queue on logout.
class OutboxController extends StateNotifier<OutboxState> {
  OutboxController(this._storage, {DateTime Function()? now})
      : _now = now ?? DateTime.now,
        super(const OutboxState());

  static const Duration _baseBackoff = Duration(seconds: 30);
  static const Duration _maxBackoff = Duration(minutes: 15);

  /// F5-B: the finite automatic retry budget per operation. The 12th
  /// retryable failure (≈2h of wall-clock under the existing backoff:
  /// 30s + 60s + 120s + 240s + 480s, then 15-minute steps) demotes the op to
  /// FAILED_PERMANENT instead of retrying forever, so it surfaces in the
  /// existing failed UI for an explicit Retry or Discard. This is a budget
  /// policy ONLY — the sync worker's error classification (what is
  /// retryable vs permanent) is intentionally untouched.
  static const int maxRetryAttempts = 12;

  // ── G16-N-3 P2-B-4 Phase 2: bounded queue capacity (PD-3) ──────────────
  //
  // PD-3 rules encoded here, deliberately:
  //  * no time-based eviction of anything;
  //  * PENDING and SENDING are NEVER auto-removed;
  //  * FAILED_PERMANENT is NEVER evicted by age;
  //  * growth is bounded by VISIBLE PRESSURE plus a user-resolvable refusal.
  //
  // Every persisted operation counts, because `OutboxStatus` has exactly three
  // values and a confirmed operation is removed immediately — there is no
  // terminal "sent" row that could accumulate.

  /// At or above this many operations **in the current scope**, the indicator
  /// surfaces persistent queue pressure. Enqueue still succeeds — this is a
  /// warning, never a gate.
  static const int softCapacityLimit = 50;

  /// At or above this many operations **in the current scope**, enqueue is
  /// refused. Existing operations are left completely untouched and nothing is
  /// deleted to make room.
  static const int hardCapacityLimit = 200;

  final OutboxStorage _storage;
  final DateTime Function() _now;

  // ── G16-N-3 P2-B-4 Phase 3: auth lifecycle epoch (in-memory only) ──────
  //
  // NOT persisted, deliberately. It is a burst-abort signal, not durable
  // state: a restart re-derives the truth from `currentUserProvider`, so an
  // epoch that survives a restart would be meaningless. It exists so a sync
  // burst that STARTED under one identity can detect, mid-pass, that the
  // authenticated scope moved on, and stop before it dispatches anything
  // further under the wrong credentials.
  int _authEpoch = 0;

  /// Monotonic counter bumped on every authenticated-scope change.
  int get authEpoch => _authEpoch;

  /// Bumps the lifecycle epoch. Called by the provider's auth listener and by
  /// [cleanupForLogout]'s caller path; never touches operation identity.
  void bumpAuthEpoch() => _authEpoch++;

  /// Read-only snapshot for the sync worker and UI — the protected
  /// [state] member must not be reached from outside this class.
  OutboxState get snapshot => state;

  Future<void> _guard = Future<void>.value();
  bool _hydrated = false;

  /// Serialises mutations so concurrent enqueues keep FIFO order.
  Future<T> _serialize<T>(Future<T> Function() task) {
    final run = _guard.then((_) => task());
    _guard = run.then<void>((_) {}, onError: (Object _) {});
    return run;
  }

  /// Loads persisted ops once (restart persistence). SENDING → PENDING
  /// normalisation already happened inside [OutboxStorage.load].
  Future<void> hydrate() => _serialize(_hydrateLocked);

  /// Inner hydrate WITHOUT re-entering [_serialize] — must only be called
  /// while already holding the serialisation lock (e.g. from [enqueue]).
  Future<void> _hydrateLocked() async {
    if (_hydrated) return;
    final ops = await _storage.load();
    _hydrated = true;
    state = OutboxState(operations: _sorted(ops));
  }

  /// Appends a new operation, subject to the bounded-queue capacity gate.
  ///
  /// G16-N-3 P2-B-4 Phase 2. Every step below runs INSIDE [_serialize], which
  /// is the single lock every queue mutation passes through (enqueue, _mutate,
  /// confirmSent, clearForLogout). Placing the capacity decision in the same
  /// critical section as the append is what makes the hard cap atomic: two
  /// concurrent enqueues cannot both observe "below the cap", because the
  /// second does not begin until the first has finished appending AND saving.
  /// No additional locking, transaction or version counter is required.
  ///
  /// Order is deliberate and load-bearing:
  ///   1. hydrate — so the count is correct even on a cold start;
  ///   2. duplicate detection — MUST precede capacity, otherwise the F5-A
  ///      fallback (which re-enqueues under the SAME clientOperationId) would
  ///      be wrongly refused the moment the queue is full;
  ///   3. capacity gate — refuses only NEW work, never recovery;
  ///   4. append + persist.
  ///
  /// On [OutboxEnqueueOutcome.capacityRefused] nothing is mutated: `state` is
  /// untouched, [_storage.save] is not called, and no identity field of [op] is
  /// read, rewritten or regenerated. There is deliberately NO time-based
  /// eviction to make room (PD-3) — capacity is released only by the user
  /// resolving work (discard / retry / successful send), which is what keeps a
  /// full queue from becoming a deadlock.
  Future<OutboxEnqueueOutcome> enqueue(OutboxOperation op) {
    return _serialize(() async {
      await _hydrateLocked();
      if (state.operations
          .any((o) => o.clientOperationId == op.clientOperationId)) {
        return OutboxEnqueueOutcome.duplicate;
      }
      // Capacity is SCOPED: this operation's own companyId + userId, the same
      // pair the Phase 1 accessors and the sync worker's dispatch guard use.
      // A foreign scope's backlog must never consume this scope's capacity,
      // and must never be visible to it.
      if (state.unresolvedFor(op.companyId, op.userId).length >=
          hardCapacityLimit) {
        return OutboxEnqueueOutcome.capacityRefused;
      }
      final withDefaults = op.copyWith(createdAt: op.createdAt ?? _now());
      final ops = [...state.operations, withDefaults];
      state = OutboxState(operations: _sorted(ops));
      await _storage.save(state.operations);
      return OutboxEnqueueOutcome.added;
    });
  }

  /// Marks the op as being sent right now.
  Future<void> markSending(String clientOperationId) => _mutate(
      clientOperationId, (o) => o.copyWith(status: OutboxStatus.sending));

  /// G16-N-3 P2-B-4 Phase 3 remediation (P2-1) — identity lifecycle stop.
  ///
  /// Returns an operation that was already marked SENDING back to PENDING
  /// because the authenticated scope changed in the window between
  /// [markSending] and the actual dispatch, so the request was NEVER issued.
  ///
  /// This is deliberately NOT [markRetryableFailure]: no HTTP request was made,
  /// so the operation must not consume the F5-B retry budget, must not accrue
  /// backoff, and must not risk demotion to FAILED_PERMANENT. [attempts],
  /// [nextAttemptAt] and [lastError] are all left exactly as they were, and
  /// every identity field ([clientOperationId], [idempotencyKey], [createdAt],
  /// companyId, userId) is untouched. It is the same "stay PENDING" outcome the
  /// sync worker's loop-top identity guard produces for untouched operations.
  Future<void> releaseDispatchAborted(String clientOperationId) {
    return _mutate(
      clientOperationId,
      (o) => o.copyWith(status: OutboxStatus.pending),
    );
  }

  /// Retryable failure: back to PENDING with exponential backoff — until the
  /// F5-B budget is exhausted. When the NEXT attempt would reach
  /// [maxRetryAttempts], the endless retryable chain ends: the op is demoted
  /// to FAILED_PERMANENT (lastError kept for the failed UI, nextAttemptAt
  /// cleared so it is never auto-dispatched again). A manual [retryFailed]
  /// grants a fresh full budget.
  Future<void> markRetryableFailure(
    String clientOperationId,
    String reason,
  ) {
    return _mutate(clientOperationId, (o) {
      final attempts = o.attempts + 1;
      // F5-B cap. `>=` (not `==`) also ends the chain for ops restored from a
      // pre-F5-B build already at (or beyond) the budget on their next
      // failure. The demotion itself is NOT a classification change — the
      // sync worker still counts it as a retryable outcome.
      if (attempts >= maxRetryAttempts) {
        return _withRetryStateReset(
          o,
          status: OutboxStatus.failedPermanent,
          attempts: attempts,
          nextAttemptAt: null,
          lastError: reason,
        );
      }
      final backoff = _baseBackoff * (1 << (attempts - 1).clamp(0, 5));
      final capped = backoff > _maxBackoff ? _maxBackoff : backoff;
      return o.copyWith(
        status: OutboxStatus.pending,
        attempts: attempts,
        nextAttemptAt: _now().add(capped),
        lastError: reason,
      );
    });
  }

  /// Permanent failure: stays in the queue until the user Retries or Discards.
  Future<void> markPermanentFailure(
    String clientOperationId,
    String reason,
  ) {
    return _mutate(
      clientOperationId,
      (o) => o.copyWith(
        status: OutboxStatus.failedPermanent,
        nextAttemptAt: null,
        lastError: reason,
      ),
    );
  }

  /// User-triggered retry of a FAILED_PERMANENT op (F5-B: grants a FULL new
  /// budget — attempts reset to 0, the op becomes due immediately and the
  /// next retryable failure restarts the backoff from the first step).
  Future<void> retryFailed(String clientOperationId) {
    return _mutate(
      clientOperationId,
      (o) => _withRetryStateReset(
        o,
        status: OutboxStatus.pending,
        attempts: 0,
        nextAttemptAt: null,
        lastError: null,
      ),
    );
  }

  /// Rebuilds [o] for a retry-state transition that must CLEAR
  /// [OutboxOperation.nextAttemptAt]. [OutboxOperation.copyWith] cannot null
  /// it (`??` keeps the previous value), so the cap demotion and the
  /// manual-retry reset construct the entry explicitly. Immutable identity
  /// fields — clientOperationId, kind, payload, idempotencyKey, createdAt,
  /// schemaVersion — are carried over verbatim: the idempotency key in
  /// particular can never be minted or altered by a retry (F4 invariant).
  static OutboxOperation _withRetryStateReset(
    OutboxOperation o, {
    required OutboxStatus status,
    required int attempts,
    required DateTime? nextAttemptAt,
    required String? lastError,
  }) {
    return OutboxOperation(
      clientOperationId: o.clientOperationId,
      kind: o.kind,
      companyId: o.companyId,
      userId: o.userId,
      payload: o.payload,
      idempotencyKey: o.idempotencyKey,
      status: status,
      attempts: attempts,
      nextAttemptAt: nextAttemptAt,
      createdAt: o.createdAt,
      lastError: lastError,
      schemaVersion: o.schemaVersion,
    );
  }

  /// Confirmed application (2xx or recognized duplicate) → remove from queue.
  /// Removal happens ONLY here, after the confirmation.
  Future<void> confirmSent(String clientOperationId) {
    return _serialize(() async {
      final ops = state.operations
          .where((o) => o.clientOperationId != clientOperationId)
          .toList();
      state = OutboxState(operations: ops);
      await _storage.save(ops);
    });
  }

  /// User-triggered discard of a FAILED_PERMANENT op.
  Future<void> discard(String clientOperationId) =>
      confirmSent(clientOperationId);

  /// Logout: wipe everything (both memory and persistence).
  ///
  /// Returns the platform write result (false == the store rejected the write
  /// without throwing) so the caller can report an honest outcome.
  Future<bool> clearForLogout() {
    return _serialize(() async {
      state = const OutboxState();
      return _storage.clear();
    });
  }

  /// G16-N-3 P2-B-4 Phase 3 — selective logout cleanup (PD-1 + PD-2).
  ///
  /// Replaces the unconditional [clearForLogout] wipe at sign-out:
  ///  * operations belonging to the OUTGOING scope `(companyId, userId)` are
  ///    RETAINED by default (PD-1: "sign out and keep pending work"), so the
  ///    same cashier signing back in resumes exactly where they left off;
  ///  * every FOREIGN-scope operation is REMOVED (PD-2), so another
  ///    account's work can never be dispatched, displayed or counted;
  ///  * [discardSameScope] = true takes the destructive PD-1 path and removes
  ///    the outgoing scope as well, leaving an empty queue.
  ///
  /// Runs inside [_serialize], so it is exclusive with `enqueue`, `_mutate`
  /// and `confirmSent`: nothing can interleave between the filter and the
  /// write. The persistence step is the SAME single-key whole-list overwrite
  /// [OutboxStorage.save] already performs — this is NOT a database
  /// transaction and no transactional guarantee is claimed. A crash leaves
  /// either the old or the new list, never a torn one, and any surviving
  /// foreign entries stay INERT: Phase 1 hides them from every UI surface and
  /// the sync worker's scope guard refuses to dispatch them, so they are
  /// removed again on the next lifecycle cleanup.
  ///
  /// Never mutates ownership: no `companyId`, `userId`, `idempotencyKey`,
  /// `clientOperationId` or `createdAt` is written here. Only whole entries
  /// are kept or dropped.
  ///
  /// Returns the platform write result (false == the store rejected the write
  /// without throwing). A `false` here leaves the PREVIOUS list on disk: the
  /// in-memory queue has already been reduced, but persistence did not
  /// confirm. That direction is fail-safe — a surviving list keeps the
  /// outgoing scope's work recoverable, and any foreign entries that survive
  /// stay inert behind the Phase 1 scoped visibility and the sync worker's
  /// scope guard. The caller must not report success on `false`.
  Future<bool> cleanupForLogout(
    String outgoingCompanyId,
    String outgoingUserId, {
    bool discardSameScope = false,
  }) {
    // Stop any burst that started under the outgoing identity BEFORE the
    // queue is rewritten, so nothing can dispatch mid-cleanup.
    _authEpoch++;
    return _serialize(() async {
      final remaining = state.operations.where((o) {
        final sameScope =
            o.companyId == outgoingCompanyId && o.userId == outgoingUserId;
        return sameScope ? !discardSameScope : false;
      }).toList(growable: false);
      state = OutboxState(operations: _sorted(remaining));
      return _storage.save(state.operations);
    });
  }

  Future<void> _mutate(
    String clientOperationId,
    OutboxOperation Function(OutboxOperation) transform,
  ) {
    return _serialize(() async {
      final ops = state.operations.map((o) {
        return o.clientOperationId == clientOperationId ? transform(o) : o;
      }).toList();
      state = OutboxState(operations: ops);
      await _storage.save(ops);
    });
  }

  List<OutboxOperation> _sorted(List<OutboxOperation> ops) {
    final copy = [...ops];
    copy.sort((a, b) {
      final at = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bt = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final cmp = at.compareTo(bt);
      return cmp != 0
          ? cmp
          : a.clientOperationId.compareTo(b.clientOperationId);
    });
    return copy;
  }
}

/// Wiring: builds the controller from the warmed [OutboxStorage] injected in
/// main.dart. Tests override this provider directly with an in-memory setup.
final outboxControllerProvider =
    StateNotifierProvider<OutboxController, OutboxState>((ref) {
  final notifier = OutboxController(ref.watch(outboxStorageProvider));
  // G16-N-3 P2-B-4 Phase 3: an authentication transition must invalidate any
  // sync burst that started under the PREVIOUS identity, so a preserved
  // same-scope operation can never be dispatched with the next account's
  // credentials. Same lifecycle pattern already proven by `heldSalesProvider`
  // (held_sales_provider.dart) and the POS cart (`sales_provider.dart`).
  //
  // This listener deliberately does NOT clean the queue: after an
  // `-> unauthenticated` transition the OUTGOING identity is unknowable here,
  // so foreign-scope removal stays owned by `logout()`, which captured it.
  // Bumping the epoch is enough — foreign entries are already inert.
  ref.listen<AuthState>(authStateProvider, (prev, next) {
    if (_scopeOf(prev) == _scopeOf(next)) return;
    notifier.bumpAuthEpoch();
  });
  return notifier;
});

/// The authenticated identity carried by an [AuthState], or null when the
/// session is not authenticated. Used only to detect a scope transition.
({String companyId, String userId})? _scopeOf(AuthState? state) {
  if (state is! AuthAuthenticated) return null;
  return (companyId: state.user.companyId, userId: state.user.id);
}

/// Fires once per controller lifetime: hydrates the persisted queue
/// (restart survival — ops enqueued while OFFLINE must surface after the app
/// is killed and relaunched). Watched by the outbox indicator, so the badge
/// reflects the restored queue on cold start without any user interaction.
final outboxInitProvider = Provider<void>((ref) {
  unawaited(ref.watch(outboxControllerProvider.notifier).hydrate());
});
