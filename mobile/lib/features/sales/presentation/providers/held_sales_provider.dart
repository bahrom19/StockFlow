import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/currency/money.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';

/// G16-N-3 P1 — the authenticated identity a held sale belongs to.
///
/// Every persisted held sale carries its owner. A held sale created under one
/// scope can never be loaded, listed, resumed or discarded under another one.
typedef HeldSaleScope = ({String companyId, String userId});

/// A suspended sale — the full cart snapshot persisted locally so the
/// cashier can resume it later (Hold Sale workflow).
///
/// G16-N-3 P1: [companyId] and [userId] are REQUIRED and are stamped from the
/// authenticated [CurrentUser] at [HeldSalesNotifier.hold] time. They are the
/// only attribution the record carries, so they must never be defaulted,
/// inferred, or reconstructed from the current login.
class HeldSale {
  final String id;
  final String label;
  final DateTime heldAt;
  final List<CartItem> items;
  final String? customerId;
  final String? customerName;
  final String currency;

  /// Tenant that owns this held sale. Never inferred.
  final String companyId;

  /// User that created this held sale. Never inferred.
  final String userId;

  /// Version of the persisted JSON layout of THIS record.
  ///
  /// v1 records (the pre-G16-N-3 `held_sales_v1` layout) carry no scope at
  /// all and are therefore unattributable — see
  /// [HeldSalesNotifier.legacyStorageKey] for their disposal.
  final int schemaVersion;

  const HeldSale({
    required this.id,
    required this.label,
    required this.heldAt,
    required this.items,
    required this.companyId,
    required this.userId,
    this.schemaVersion = currentSchemaVersion,
    this.customerId,
    this.customerName,
    this.currency = 'KZT',
  });

  /// Persisted-layout version stamped onto every freshly created record.
  /// Bumped from the implicit v1 layout when the scope fields were added.
  static const int currentSchemaVersion = 2;

  HeldSaleScope get scope => (companyId: companyId, userId: userId);

  Money get total =>
      items.fold(Money.zero(currency), (sum, i) => sum + i.total);
  int get itemCount => items.fold(0, (sum, i) => sum + i.quantity);

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'heldAt': heldAt.toIso8601String(),
        'items': items.map((i) => i.toJson()).toList(),
        'customerId': customerId,
        'customerName': customerName,
        'currency': currency,
        'companyId': companyId,
        'userId': userId,
        'schemaVersion': schemaVersion,
      };

  /// Strict parse of a record read from a SCOPED partition.
  ///
  /// Throws [FormatException] when the record carries no usable attribution —
  /// the caller ([HeldSalesNotifier._parseOwned]) treats that as a drop, so a
  /// record without an owner is never handed to application code.
  factory HeldSale.fromJson(Map<String, dynamic> json) {
    final currency = (json['currency'] as String?) ?? 'KZT';
    final rawItems = (json['items'] as List<dynamic>? ?? const []);
    final companyId = json['companyId'];
    final userId = json['userId'];
    if (companyId is! String || companyId.isEmpty) {
      throw const FormatException(
        'Held sale record has no companyId — unattributable, dropped',
      );
    }
    if (userId is! String || userId.isEmpty) {
      throw const FormatException(
        'Held sale record has no userId — unattributable, dropped',
      );
    }
    return HeldSale(
      id: json['id'] as String,
      label: (json['label'] as String?) ?? 'Held sale',
      heldAt:
          DateTime.tryParse(json['heldAt'] as String? ?? '') ?? DateTime.now(),
      items: rawItems
          .map((e) => CartItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      customerId: json['customerId'] as String?,
      customerName: json['customerName'] as String?,
      currency: currency,
      companyId: companyId,
      userId: userId,
      schemaVersion: (json['schemaVersion'] as num?)?.toInt() ?? 0,
    );
  }
}

// ──────────────────────────────────
// State
// ──────────────────────────────────
class HeldSalesState {
  final List<HeldSale> held;
  const HeldSalesState({this.held = const []});

  HeldSalesState copyWith({List<HeldSale>? held}) =>
      HeldSalesState(held: held ?? this.held);
}

// ──────────────────────────────────
// Notifier
// ──────────────────────────────────
class HeldSalesNotifier extends StateNotifier<HeldSalesState> {
  /// G16-N-3 P1: the pre-scope, GLOBAL storage key. Its records carry no
  /// `companyId`/`userId`, so they cannot be attributed to any tenant and are
  /// never deserialized, never imported and never shown to anyone. Read once
  /// to count them, then deleted.
  static const String legacyStorageKey = 'held_sales_v1';

  /// Prefix of the per-scope storage partitions.
  static const String scopedKeyPrefix = 'held_sales_v2_';

  /// The storage partition of exactly one (company, user) pair.
  ///
  /// Partitioning at the KEY level — not only filtering a shared list — means
  /// a foreign session has no key to read, so a regression in the in-memory
  /// filter still cannot expose another tenant's records.
  static String scopedStorageKey(String companyId, String userId) =>
      '$scopedKeyPrefix${companyId}_$userId';

  final Ref _ref;
  final AppLogger _logger = AppLogger('HeldSales');

  /// Identity the in-memory [state] was built for. Null ⇒ nothing is loaded
  /// and [load] must run.
  ///
  /// G16-N-3 P1: this replaces the old process-wide one-shot `_loaded` latch.
  /// A latch cannot express "these records belong to a DIFFERENT user", so a
  /// cached list used to survive logout and be served to the next session. The
  /// latch is now keyed by the identity it is valid for.
  HeldSaleScope? _loadedScope;

  /// One-shot guard so the legacy purge runs at most once per process.
  bool _legacyPurged = false;

  HeldSalesNotifier(this._ref) : super(const HeldSalesState());

  /// Drops every in-memory record and invalidates the loaded scope so the next
  /// [load] re-reads storage for the CURRENT identity.
  ///
  /// Called by the provider's auth listener whenever the authenticated
  /// identity changes. This is the layer that closes the ProviderScope-survival
  /// hole: the root `ProviderScope` is never disposed, so without this a
  /// logout/login cycle would leave the previous user's drafts on screen.
  void onAuthScopeChanged() {
    _loadedScope = null;
    if (state.held.isNotEmpty) state = const HeldSalesState();
  }

  Future<void> load() async {
    final user = _ref.read(currentUserProvider);
    if (user == null) {
      // Fail closed: an unauthenticated session never reads held sales, and
      // never renders a previously authenticated session's records.
      _loadedScope = null;
      if (state.held.isNotEmpty) state = const HeldSalesState();
      return;
    }
    final scope = (companyId: user.companyId, userId: user.id);
    if (_loadedScope == scope) return;

    try {
      final storage = await _ref.read(preferencesStorageProvider.future);
      await _purgeLegacyStorage(storage);
      final raw = storage.getString(
        scopedStorageKey(scope.companyId, scope.userId),
      );
      final held = <HeldSale>[];
      if (raw != null && raw.isNotEmpty) {
        for (final entry in jsonDecode(raw) as List<dynamic>) {
          final owned = _parseOwned(entry, scope);
          if (owned != null) held.add(owned);
        }
      }
      _loadedScope = scope;
      state = HeldSalesState(held: held);
    } catch (e) {
      // Same fail-closed posture as the pre-G16-N-3 implementation: a storage
      // fault shows an empty list rather than an unattributable one.
      _logger.error('Held sales load failed', e);
      _loadedScope = scope;
      state = const HeldSalesState();
    }
  }

  /// Parses and validates ONE record against [scope].
  ///
  /// Returns null — dropping the record, never surfacing it — when the record
  /// is malformed, carries no attribution, was written by an incompatible
  /// layout, or belongs to a different (company, user).
  HeldSale? _parseOwned(Object? entry, HeldSaleScope scope) {
    if (entry is! Map) return null;
    try {
      final sale = HeldSale.fromJson(entry.cast<String, dynamic>());
      if (sale.schemaVersion != HeldSale.currentSchemaVersion) return null;
      if (sale.companyId != scope.companyId || sale.userId != scope.userId) {
        return null;
      }
      return sale;
    } catch (_) {
      return null;
    }
  }

  /// G16-N-3 P1 legacy disposal: counts the unattributable `held_sales_v1`
  /// records and deletes the key.
  ///
  /// The records are deliberately NOT deserialized and NOT attributed to the
  /// current login — inferring ownership would hand every pre-upgrade draft to
  /// whoever signs in next, which is the very disclosure being closed. A held
  /// sale is an inert local draft with no server-side effect, so discarding it
  /// is safe; leaving a foreign tenant's customer data and cost figures on disk
  /// forever is not.
  Future<void> _purgeLegacyStorage(PreferencesStorage storage) async {
    if (_legacyPurged) return;
    _legacyPurged = true;
    final raw = storage.getString(legacyStorageKey);
    if (raw == null || raw.isEmpty) return;
    var count = 0;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) count = decoded.length;
    } catch (_) {
      // Unparseable legacy blob: still deleted, count simply unknown.
    }
    await storage.remove(legacyStorageKey);
    _logger.info(
      'G16-N-3 P1: purged $count unattributed held sale record(s) from '
      '$legacyStorageKey — pre-scope records cannot be attributed and are '
      'never imported',
    );
  }

  /// Suspends the current cart into the held list, owned by the authenticated
  /// user.
  ///
  /// Throws [StateError] when nobody is authenticated — the same fail-closed
  /// contract as [OfflineSaleQueue.enqueueCreateSale], so an unscoped draft can
  /// never be persisted in the first place.
  Future<void> hold(CartState cart, {String? label}) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) {
      throw StateError('Cannot hold a sale without an authenticated user');
    }
    await load();
    final held = HeldSale(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      label: label?.trim().isNotEmpty == true
          ? label!.trim()
          : 'Held ${DateTime.now().hour.toString().padLeft(2, '0')}:'
              '${DateTime.now().minute.toString().padLeft(2, '0')}',
      heldAt: DateTime.now(),
      items: cart.items,
      companyId: user.companyId,
      userId: user.id,
      customerId: cart.customerId,
      customerName: cart.customerName,
      currency: cart.currency,
    );
    state = HeldSalesState(held: [held, ...state.held]);
    await _persist();
  }

  /// Restores a held sale's items into the cart and removes it from the list.
  ///
  /// G16-N-3 P1: ownership is verified HERE, inside the notifier — the last
  /// point before foreign data would reach active POS state via
  /// `setCustomer(customerId, customerName)`. Screens are not part of the
  /// security boundary. A mismatched record is neither returned nor removed.
  Future<HeldSale?> resume(String id) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) return null;
    await load();
    final idx = state.held.indexWhere((h) => h.id == id);
    if (idx < 0) return null;
    final held = state.held[idx];
    if (!isOwnedBy(held, user)) {
      _logger.warning(
        'G16-N-3 P1: blocked resume of held sale $id — owned by '
        '${held.companyId}/${held.userId}, session is '
        '${user.companyId}/${user.id}',
      );
      return null;
    }
    state = HeldSalesState(
      held: state.held.where((h) => h.id != id).toList(),
    );
    await _persist();
    return held;
  }

  Future<void> discard(String id) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) return;
    await load();
    final match = state.held.where((h) => h.id == id);
    if (match.isEmpty) return;
    if (!match.every((h) => isOwnedBy(h, user))) return;
    state = HeldSalesState(held: state.held.where((h) => h.id != id).toList());
    await _persist();
  }

  /// The single ownership predicate. Used by [resume], [discard] and the
  /// loader so every path answers the boundary question identically.
  static bool isOwnedBy(HeldSale sale, CurrentUser user) =>
      sale.companyId == user.companyId && sale.userId == user.id;

  /// Writes the in-memory list back to ITS OWN partition.
  ///
  /// The destination is derived from [_loadedScope] — the identity the list
  /// actually belongs to — so a save can never write one user's drafts into
  /// another user's partition.
  Future<void> _persist() async {
    final scope = _loadedScope;
    if (scope == null) return;
    try {
      final storage = await _ref.read(preferencesStorageProvider.future);
      await storage.setString(
        scopedStorageKey(scope.companyId, scope.userId),
        jsonEncode(state.held.map((h) => h.toJson()).toList()),
      );
    } catch (e) {
      // Persistence is best-effort — the sale can still be resumed in-memory.
      _logger.error('Held sales persist failed', e);
    }
  }
}

// ──────────────────────────────────
// Providers
// ──────────────────────────────────
final heldSalesProvider =
    StateNotifierProvider<HeldSalesNotifier, HeldSalesState>((ref) {
  final notifier = HeldSalesNotifier(ref);
  // G16-N-3 P1: an authentication transition must never leave the previous
  // identity's held sales in memory. The root ProviderScope outlives logout,
  // so this is the only thing standing between a shared terminal and the next
  // user's drafts. Same lifecycle pattern as `outboxSchedulerProvider`
  // (outbox_scheduler.dart), which listens to the controller/connectivity in
  // exactly this way.
  ref.listen<AuthState>(authStateProvider, (prev, next) {
    if (_identityOf(prev) == _identityOf(next)) return;
    notifier.onAuthScopeChanged();
  });
  return notifier;
});

/// The authenticated identity carried by an [AuthState], or null when the
/// session is not authenticated.
HeldSaleScope? _identityOf(AuthState? state) {
  if (state is! AuthAuthenticated) return null;
  final user = state.user;
  return (companyId: user.companyId, userId: user.id);
}
