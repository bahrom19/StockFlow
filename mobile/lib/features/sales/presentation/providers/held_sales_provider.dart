import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';

/// A suspended sale — the full cart snapshot persisted locally so the
/// cashier can resume it later (Hold Sale workflow).
class HeldSale {
  final String id;
  final String label;
  final DateTime heldAt;
  final List<CartItem> items;
  final String? customerId;
  final String? customerName;

  const HeldSale({
    required this.id,
    required this.label,
    required this.heldAt,
    required this.items,
    this.customerId,
    this.customerName,
  });

  double get total => items.fold(0.0, (sum, i) => sum + i.total);
  int get itemCount => items.fold(0, (sum, i) => sum + i.quantity);

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'heldAt': heldAt.toIso8601String(),
        'items': items.map((i) => i.toJson()).toList(),
        'customerId': customerId,
        'customerName': customerName,
      };

  factory HeldSale.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List<dynamic>? ?? const []);
    return HeldSale(
      id: json['id'] as String,
      label: (json['label'] as String?) ?? 'Held sale',
      heldAt: DateTime.tryParse(json['heldAt'] as String? ?? '') ??
          DateTime.now(),
      items: rawItems
          .map((e) => CartItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      customerId: json['customerId'] as String?,
      customerName: json['customerName'] as String?,
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
  static const String _storageKey = 'held_sales_v1';
  final Ref _ref;
  bool _loaded = false;

  HeldSalesNotifier(this._ref) : super(const HeldSalesState());

  Future<void> load() async {
    if (_loaded) return;
    try {
      final storage = _ref.read(preferencesStorageProvider);
      final raw = storage.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final list = (jsonDecode(raw) as List<dynamic>)
            .map((e) => HeldSale.fromJson(e as Map<String, dynamic>))
            .toList();
        state = HeldSalesState(held: list);
      }
      _loaded = true;
    } catch (_) {
      _loaded = true;
    }
  }

  /// Suspends the current cart into the held list.
  Future<void> hold(CartState cart, {String? label}) async {
    await load();
    final held = HeldSale(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      label: label?.trim().isNotEmpty == true
          ? label!.trim()
          : 'Held ${DateTime.now().hour.toString().padLeft(2, '0')}:'
              '${DateTime.now().minute.toString().padLeft(2, '0')}',
      heldAt: DateTime.now(),
      items: cart.items,
      customerId: cart.customerId,
      customerName: cart.customerName,
    );
    state = HeldSalesState(held: [held, ...state.held]);
    await _persist();
  }

  /// Restores a held sale's items into the cart and removes it from the list.
  Future<HeldSale?> resume(String id) async {
    await load();
    final idx = state.held.indexWhere((h) => h.id == id);
    if (idx < 0) return null;
    final held = state.held[idx];
    state = HeldSalesState(
      held: state.held.where((h) => h.id != id).toList(),
    );
    await _persist();
    return held;
  }

  Future<void> discard(String id) async {
    await load();
    state = HeldSalesState(held: state.held.where((h) => h.id != id).toList());
    await _persist();
  }

  Future<void> _persist() async {
    try {
      final storage = _ref.read(preferencesStorageProvider);
      await storage.setString(
        _storageKey,
        jsonEncode(state.held.map((h) => h.toJson()).toList()),
      );
    } catch (_) {
      // Persistence is best-effort — the sale can still be resumed in-memory.
    }
  }
}

// ──────────────────────────────────
// Providers
// ──────────────────────────────────
final heldSalesProvider =
    StateNotifierProvider<HeldSalesNotifier, HeldSalesState>((ref) {
  return HeldSalesNotifier(ref);
});
