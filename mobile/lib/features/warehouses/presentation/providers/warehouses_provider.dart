import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/inventory/data/repositories/inventory_repository.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';

// ──────────────────────────────────
// State
// ──────────────────────────────────
sealed class WarehouseListState {
  const WarehouseListState();
}

class WarehouseListLoading extends WarehouseListState {
  const WarehouseListLoading();
}

class WarehouseListLoaded extends WarehouseListState {
  final List<Warehouse> warehouses;
  final bool isRefreshing;
  final String search;

  const WarehouseListLoaded({
    required this.warehouses,
    this.isRefreshing = false,
    this.search = '',
  });

  WarehouseListLoaded copyWith({
    List<Warehouse>? warehouses,
    bool? isRefreshing,
    String? search,
  }) {
    return WarehouseListLoaded(
      warehouses: warehouses ?? this.warehouses,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      search: search ?? this.search,
    );
  }
}

class WarehouseListEmpty extends WarehouseListState {
  const WarehouseListEmpty();
}

class WarehouseListError extends WarehouseListState {
  final String message;
  final Failure? failure;
  const WarehouseListError(this.message, {this.failure});
}

// ──────────────────────────────────
// Notifier
// ──────────────────────────────────
class WarehouseListNotifier extends StateNotifier<WarehouseListState> {
  final Ref _ref;
  String _currentSearch = '';

  WarehouseListNotifier(this._ref) : super(const WarehouseListLoading());

  Future<void> loadWarehouses() async {
    state = const WarehouseListLoading();
    await _fetch();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is WarehouseListLoaded) {
      state = current.copyWith(isRefreshing: true);
    } else {
      state = const WarehouseListLoading();
    }
    _currentSearch = '';
    await _fetch();
  }

  void search(String query) {
    _currentSearch = query.toLowerCase();
    final current = state;
    if (current is WarehouseListLoaded) {
      state = current.copyWith(isRefreshing: true, search: query);
    } else {
      state = const WarehouseListLoading();
    }
    // Client-side filtering — the endpoint returns the full list.
    _applyFilter(current is WarehouseListLoaded ? current.warehouses : []);
  }

  Future<void> _fetch() async {
    final repo = _ref.read(inventoryRepositoryProvider);
    final result = await repo.getWarehouses();
    if (result is InvFailure) {
      state = WarehouseListError(
        (result as InvFailure<List<Warehouse>>).error.message,
        failure: (result as InvFailure<List<Warehouse>>).error,
      );
      return;
    }
    final warehouses = (result as InvSuccess<List<Warehouse>>).data;
    if (warehouses.isEmpty) {
      state = const WarehouseListEmpty();
      return;
    }
    _applyFilter(warehouses);
  }

  void _applyFilter(List<Warehouse> warehouses) {
    final filtered = _currentSearch.isEmpty
        ? warehouses
        : warehouses.where((w) {
            final name = w.name.toLowerCase();
            final code = w.code.toLowerCase();
            return name.contains(_currentSearch) ||
                code.contains(_currentSearch);
          }).toList();
    state = WarehouseListLoaded(warehouses: filtered, search: _currentSearch);
  }

  /// Returns true on success — caller shows a snackbar.
  Future<bool> create(CreateWarehouseRequest request) async {
    final repo = _ref.read(inventoryRepositoryProvider);
    final result = await repo.createWarehouse(request);
    if (result is InvFailure) return false;
    await _fetch();
    return true;
  }

  Future<bool> update(String id, UpdateWarehouseRequest request) async {
    final repo = _ref.read(inventoryRepositoryProvider);
    final result = await repo.updateWarehouse(id, request);
    if (result is InvFailure) return false;
    await _fetch();
    return true;
  }

  Future<bool> delete(String id) async {
    final repo = _ref.read(inventoryRepositoryProvider);
    final result = await repo.deleteWarehouse(id);
    if (result is InvFailure) return false;
    await _fetch();
    return true;
  }

  @override
  void dispose() {
    super.dispose();
  }
}

final warehouseListProvider =
    StateNotifierProvider<WarehouseListNotifier, WarehouseListState>((ref) {
  return WarehouseListNotifier(ref);
});
