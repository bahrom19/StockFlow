import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/features/inventory/data/repositories/inventory_repository.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';

/// Inventory List Notifier
class InventoryListNotifier extends StateNotifier<InventoryState> {
  final Ref _ref;
  Timer? _searchDebounce;
  String _currentSearch = '';

  InventoryListNotifier(this._ref) : super(const InventoryLoading());

  Future<void> loadInventory() async {
    state = const InventoryLoading();
    await _fetch();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is InventoryLoaded) {
      state = current.copyWith(isRefreshing: true);
    }
    await _fetch();
  }

  void search(String query) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      _currentSearch = query;
      final current = state;
      if (current is InventoryLoaded) {
        state = current.copyWith(isRefreshing: true);
      } else {
        state = const InventoryLoading();
      }
      _fetch();
    });
  }

  void filterByWarehouse(String? warehouseId) {
    final current = state;
    if (current is InventoryLoaded) {
      state = current.copyWith(warehouseFilter: warehouseId, isRefreshing: true);
    } else {
      state = const InventoryLoading();
    }
    _fetch(warehouseId: warehouseId);
  }

  Future<void> _fetch({String? warehouseId}) async {
    final repo = _ref.read(inventoryRepositoryProvider);

    // Fetch stock + warehouses concurrently
    final results = await Future.wait([
      repo.getStock(
        search: _currentSearch.isNotEmpty ? _currentSearch : null,
        warehouseId: warehouseId,
      ),
      repo.getWarehouses(),
    ]);

    final stockResult = results[0] as InvResult<StockListResponse>;
    final warehouseResult = results[1] as InvResult<List<Warehouse>>;

    if (stockResult is InvFailure) {
      state = InventoryError(
        (stockResult as InvFailure<StockListResponse>).error.message,
      );
      return;
    }

    final stockData = (stockResult as InvSuccess<StockListResponse>).data;
    final warehouses = warehouseResult is InvSuccess<List<Warehouse>>
        ? (warehouseResult as InvSuccess<List<Warehouse>>).data
        : <Warehouse>[];

    if (stockData.items.isEmpty) {
      state = InventoryEmpty();
      return;
    }

    state = InventoryLoaded(
      items: stockData.items,
      total: stockData.total,
      warehouses: warehouses,
      search: _currentSearch,
      warehouseFilter: warehouseId,
    );
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }
}

/// Movements Notifier
class MovementsNotifier extends StateNotifier<MovementsState> {
  final Ref _ref;

  MovementsNotifier(this._ref) : super(const MovementsLoading());

  Future<void> loadMovements({
    String? productId,
    String? warehouseId,
  }) async {
    state = const MovementsLoading();
    final repo = _ref.read(inventoryRepositoryProvider);
    final result = await repo.getMovements(
      productId: productId,
      warehouseId: warehouseId,
    );

    if (result is InvFailure) {
      state = MovementsError(
        (result as InvFailure<List<StockMovement>>).error.message,
      );
      return;
    }

    final movements = (result as InvSuccess<List<StockMovement>>).data;
    state = movements.isEmpty
        ? const MovementsEmpty()
        : MovementsLoaded(movements);
  }
}

/// Adjustment Notifier
class AdjustmentNotifier extends StateNotifier<AsyncValue<StockMovement?>> {
  final Ref _ref;

  AdjustmentNotifier(this._ref) : super(const AsyncData(null));

  Future<StockMovement?> adjust(AdjustStockDto dto) async {
    state = const AsyncLoading();
    final repo = _ref.read(inventoryRepositoryProvider);
    final result = await repo.adjustStock(dto);
    if (result is InvSuccess) {
      state = AsyncData(result.data);
      return result.data;
    }
    final error = (result as InvFailure).error;
    state = AsyncError(error.message, StackTrace.current);
    return null;
  }
}

/// Transfer Notifier
class TransferNotifier extends StateNotifier<AsyncValue<List<StockMovement>?>> {
  final Ref _ref;

  TransferNotifier(this._ref) : super(const AsyncData(null));

  Future<List<StockMovement>?> transfer(TransferStockDto dto) async {
    state = const AsyncLoading();
    final repo = _ref.read(inventoryRepositoryProvider);
    final result = await repo.transferStock(dto);
    if (result is InvSuccess) {
      state = AsyncData(result.data);
      return result.data;
    }
    final error = (result as InvFailure).error;
    state = AsyncError(error.message, StackTrace.current);
    return null;
  }
}

// ── Providers ──────────────────────────────────

final inventoryListProvider =
    StateNotifierProvider<InventoryListNotifier, InventoryState>((ref) {
  return InventoryListNotifier(ref);
});

final movementsProvider =
    StateNotifierProvider<MovementsNotifier, MovementsState>((ref) {
  return MovementsNotifier(ref);
});

final adjustmentProvider =
    StateNotifierProvider<AdjustmentNotifier, AsyncValue<StockMovement?>>(
  (ref) => AdjustmentNotifier(ref),
);

final transferProvider =
    StateNotifierProvider<TransferNotifier, AsyncValue<List<StockMovement>?>>(
  (ref) => TransferNotifier(ref),
);
