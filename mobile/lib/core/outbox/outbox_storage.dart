import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

import 'outbox_operation.dart';

/// Durable storage for the offline mutation queue (Offline 1B-min).
///
/// Backed by [PreferencesStorage] (SharedPreferences) — the only local store
/// already present in the app. The queue is stored as an ordered JSON list of
/// [OutboxOperation]s under a single key; list order == FIFO order.
///
/// Scope: storage is deliberately dumb — no business rules, only CRUD. Rules
/// (dedupe, backoff, scope guard) live in the controller / sync service.
class OutboxStorage {
  OutboxStorage(this._prefs);

  static const String _key = 'outbox_ops_v1';

  final PreferencesStorage _prefs;

  /// Loads the persisted queue in FIFO order. `SENDING` entries found after a
  /// restart are reset to PENDING: the app may have died between "request
  /// sent" and "record removed". Re-sending is safe — CREATE_SALE carries a
  /// client-generated unique saleNumber, a duplicate is recognised server-side.
  ///
  /// Entries that cannot be parsed — corrupted JSON, or a kind unknown to
  /// this build (never coerced into createSale) — are dropped here and are
  /// therefore never dispatched anywhere.
  Future<List<OutboxOperation>> load() async {
    final raw = _prefs.getStringList(_key) ?? const <String>[];
    final ops = <OutboxOperation>[];
    for (final item in raw) {
      try {
        final op = OutboxOperation.fromJson(
          (jsonDecode(item) as Map).cast<String, dynamic>(),
        );
        ops.add(
          op.status == OutboxStatus.sending
              ? op.copyWith(status: OutboxStatus.pending)
              : op,
        );
      } catch (_) {
        // A corrupted entry must never break the whole queue — drop it.
      }
    }
    return ops;
  }

  /// Overwrites the whole queue and returns the platform write result.
  ///
  /// G16-N-3 P2-B-4 Phase 3 remediation (P2-2): the underlying store signals a
  /// REJECTED write by returning false WITHOUT throwing, so the result is
  /// propagated unchanged and never coerced to true. Callers that must not
  /// overstate success — the logout cleanup path, which reports
  /// `LogoutResult.queuePersisted` to the user — depend on this. Callers with
  /// no success/failure contract of their own (enqueue, _mutate,
  /// confirmSent) keep their existing behaviour and ignore it.
  ///
  /// A thrown exception is deliberately NOT caught here: it continues to
  /// propagate to the caller exactly as before.
  ///
  /// Still NOT a database transaction; no atomicity beyond this single
  /// whole-list overwrite is claimed.
  Future<bool> save(List<OutboxOperation> ops) async {
    return _prefs.setStringList(
      _key,
      ops.map((o) => jsonEncode(o.toJson())).toList(growable: false),
    );
  }

  /// Removes the whole queue, returning the platform write result under the
  /// same contract as [save] (false == rejected without throwing).
  Future<bool> clear() => _prefs.remove(_key);
}

/// The single app instance is created in `main()` (over the warmed
/// [PreferencesStorage]) and injected via ProviderScope.overrides — the same
/// pattern as connectivityServiceProvider. This guarantees the outbox exists
/// from the very first frame (no async warm-up window before the first UI
/// build or the first offline enqueue).
/// Tests override this provider with an in-memory-backed storage.
final outboxStorageProvider = Provider<OutboxStorage>((ref) {
  throw UnimplementedError(
    'outboxStorageProvider must be overridden with the warmed instance in '
    'main.dart (or with a test double in tests)',
  );
});
