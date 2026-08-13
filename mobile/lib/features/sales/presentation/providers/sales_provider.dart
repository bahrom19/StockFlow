import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/sales/data/repositories/sales_repository.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

// ──────────────────────────────────
// Cart State
// ──────────────────────────────────
class CartState {
  final List<CartItem> items;
  final String? customerId;
  final String? customerName;
  final String currency;
  final String? notes;

  const CartState({
    this.items = const [],
    this.customerId,
    this.customerName,
    this.currency = 'KZT',
    this.notes,
  });

  CartState copyWith({
    List<CartItem>? items,
    String? customerId,
    String? customerName,
    String? currency,
    String? notes,
  }) {
    return CartState(
      items: items ?? this.items,
      customerId: customerId ?? this.customerId,
      customerName: customerName ?? this.customerName,
      currency: currency ?? this.currency,
      notes: notes ?? this.notes,
    );
  }

  double get subtotal =>
      items.fold(0.0, (sum, item) => sum + item.subtotal);

  double get totalDiscount =>
      items.fold(0.0, (sum, item) => sum + item.discount);

  /// Estimated tax — the backend computes the authoritative amount at sale
  /// creation; the receipt shows the returned `sale.tax`. A cart-level rate
  /// keeps the register transparent about the line before completion.
  double get taxRate => 0;

  double get tax => subtotal * taxRate;

  double get total => subtotal - totalDiscount;

  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);
}

// ──────────────────────────────────
// Cart Notifier
// ──────────────────────────────────
class CartNotifier extends StateNotifier<CartState> {
  // ignore: unused_field — reserved for future customer/warehouse lookups
  final Ref _ref;

  CartNotifier(this._ref) : super(const CartState());

  void addItem(CartItem item) {
    final existingIdx = state.items.indexWhere(
      (i) => i.productId == item.productId,
    );
    if (existingIdx >= 0) {
      final existing = state.items[existingIdx];
      final updated = existing.copyWith(
        quantity: existing.quantity + item.quantity,
      );
      final newItems = [...state.items];
      newItems[existingIdx] = updated;
      state = state.copyWith(items: newItems);
    } else {
      state = state.copyWith(items: [...state.items, item]);
    }
  }

  void updateQuantity(String productId, int quantity) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    final idx = state.items.indexWhere((i) => i.productId == productId);
    if (idx < 0) return;
    final newItems = [...state.items];
    newItems[idx] = newItems[idx].copyWith(quantity: quantity);
    state = state.copyWith(items: newItems);
  }

  void updateDiscount(String productId, double discount) {
    final idx = state.items.indexWhere((i) => i.productId == productId);
    if (idx < 0) return;
    final newItems = [...state.items];
    newItems[idx] = newItems[idx].copyWith(discount: discount);
    state = state.copyWith(items: newItems);
  }

  void removeItem(String productId) {
    state = state.copyWith(
      items: state.items.where((i) => i.productId != productId).toList(),
    );
  }

  void setCustomer(String? id, String? name) {
    state = state.copyWith(customerId: id, customerName: name);
  }

  void setCurrency(String currency) {
    state = state.copyWith(currency: currency);
  }

  void setNotes(String? notes) {
    state = state.copyWith(notes: notes);
  }

  void clear() {
    state = const CartState();
  }

  /// Validate cart before checkout.
  ///
  /// Pass [l10n] from the UI layer to get localized messages; without it the
  /// historical English strings are returned (keeps tests and callers that
  /// don't have a BuildContext working unchanged).
  String? validate([AppLocalizations? l10n]) {
    if (state.items.isEmpty) {
      return l10n?.posCartEmpty ?? 'Cart is empty';
    }
    for (final item in state.items) {
      if (item.quantity < 1) {
        return l10n?.posInvalidQuantity(item.productName) ??
            'Invalid quantity for ${item.productName}';
      }
      if (item.unitPrice < 0) {
        return l10n?.posInvalidPrice(item.productName) ??
            'Invalid price for ${item.productName}';
      }
    }
    return null;
  }
}

// ──────────────────────────────────
// Sale List State
// ──────────────────────────────────
sealed class SaleListState {
  const SaleListState();
}

class SaleListLoading extends SaleListState {
  const SaleListLoading();
}

class SaleListLoaded extends SaleListState {
  final List<Sale> sales;
  final int total;
  final int page;
  final bool hasMore;
  final bool isRefreshing;
  final bool isLoadingMore;
  final String search;

  const SaleListLoaded({
    required this.sales,
    required this.total,
    required this.page,
    this.hasMore = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.search = '',
  });

  SaleListLoaded copyWith({
    List<Sale>? sales,
    int? total,
    int? page,
    bool? hasMore,
    bool? isRefreshing,
    bool? isLoadingMore,
    String? search,
  }) {
    return SaleListLoaded(
      sales: sales ?? this.sales,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      search: search ?? this.search,
    );
  }
}

class SaleListEmpty extends SaleListState {
  const SaleListEmpty();
}

class SaleListError extends SaleListState {
  final String message;
  final Failure? failure;
  const SaleListError(this.message, {this.failure});
}

// ──────────────────────────────────
// Sale List Notifier
// ──────────────────────────────────
class SaleListNotifier extends StateNotifier<SaleListState> {
  final Ref _ref;
  Timer? _searchDebounce;
  String _currentSearch = '';
  String? _statusFilter;
  String? _warehouseFilter;
  String? _customerFilter;

  SaleListNotifier(this._ref) : super(const SaleListLoading());

  Future<void> loadSales() async {
    state = const SaleListLoading();
    await _fetch();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is SaleListLoaded) {
      state = current.copyWith(
        isRefreshing: true,
        page: 1,
        sales: [],
      );
    }
    _currentSearch = '';
    _statusFilter = null;
    _warehouseFilter = null;
    await _fetch();
  }

  void search(String query) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      _currentSearch = query;
      final current = state;
      if (current is SaleListLoaded) {
        state = current.copyWith(isRefreshing: true, page: 1, sales: []);
      } else {
        state = const SaleListLoading();
      }
      _fetch();
    });
  }

  void filterByStatus(String? status) {
    _statusFilter = status;
    final current = state;
    if (current is SaleListLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, sales: []);
    } else {
      state = const SaleListLoading();
    }
    _fetch();
  }

  void filterByWarehouse(String? warehouseId) {
    _warehouseFilter = warehouseId;
    final current = state;
    if (current is SaleListLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, sales: []);
    } else {
      state = const SaleListLoading();
    }
    _fetch();
  }

  /// Filters the sale list by a single customer (used for the customer's
  /// purchase history view). Resets other filters.
  void filterByCustomer(String? customerId) {
    _customerFilter = customerId;
    _statusFilter = null;
    _warehouseFilter = null;
    final current = state;
    if (current is SaleListLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, sales: []);
    } else {
      state = const SaleListLoading();
    }
    _fetch();
  }

  String? get customerFilter => _customerFilter;

  Future<void> loadMore() async {
    final current = state;
    if (current is! SaleListLoaded ||
        current.isLoadingMore ||
        !current.hasMore) return;

    state = current.copyWith(isLoadingMore: true);
    await _fetch(page: current.page + 1, append: true);
  }

  Future<void> _fetch({int page = 1, bool append = false}) async {
    final repo = _ref.read(salesRepositoryProvider);
    final result = await repo.list(
      page: page,
      limit: 20,
      search: _currentSearch.isNotEmpty ? _currentSearch : null,
      status: _statusFilter,
      warehouseId: _warehouseFilter,
      customerId: _customerFilter,
    );

    if (result is SalesFailure) {
      state = SaleListError(
        (result as SalesFailure<SaleListResponse>).error.message,
        failure: (result as SalesFailure<SaleListResponse>).error,
      );
      return;
    }

    final response = (result as SalesSuccess<SaleListResponse>).data;

    if (response.items.isEmpty && page == 1) {
      state = const SaleListEmpty();
      return;
    }

    final sales = append
        ? [...(state as SaleListLoaded).sales, ...response.items]
        : response.items;
    final hasMore = sales.length < response.total;

    state = SaleListLoaded(
      sales: sales,
      total: response.total,
      page: page,
      hasMore: hasMore,
      search: _currentSearch,
    );
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }
}

// ──────────────────────────────────
// POS Notifier (handles checkout flow)
// ──────────────────────────────────
class PosNotifier extends StateNotifier<AsyncValue<Sale?>> {
  final Ref _ref;

  PosNotifier(this._ref) : super(const AsyncData(null));

  /// Create sale as DRAFT
  Future<Sale?> createDraft({
    required String warehouseId,
    required List<CartItem> cartItems,
    required List<CreatePayment> payments,
    String? customerId,
    String? currency,
    String? notes,
  }) async {
    state = const AsyncLoading();
    final repo = _ref.read(salesRepositoryProvider);
    final request = CreateSaleRequest(
      warehouseId: warehouseId,
      customerId: customerId,
      currency: currency ?? 'KZT',
      notes: notes,
      items: cartItems.map((c) => CreateSaleItem(
        productId: c.productId,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        costPrice: c.costPrice,
        discount: c.discount,
      )).toList(),
      payments: payments,
    );
    final result = await repo.create(request);
    if (result is SalesSuccess<Sale>) {
      state = AsyncData(result.data);
      return result.data;
    }
    final error = (result as SalesFailure<Sale>).error;
    state = AsyncError(error.message, StackTrace.current);
    return null;
  }

  /// Complete a sale (DRAFT → COMPLETED)
  Future<Sale?> completeSale(String saleId) async {
    state = const AsyncLoading();
    final repo = _ref.read(salesRepositoryProvider);
    final result = await repo.complete(saleId);
    if (result is SalesSuccess<Sale>) {
      state = AsyncData(result.data);
      return result.data;
    }
    final error = (result as SalesFailure<Sale>).error;
    state = AsyncError(error.message, StackTrace.current);
    return null;
  }

  /// Cancel a sale
  Future<Sale?> cancelSale(String saleId) async {
    final repo = _ref.read(salesRepositoryProvider);
    final result = await repo.cancel(saleId);
    if (result is SalesSuccess<Sale>) {
      return result.data;
    }
    return null;
  }

  /// Refund a sale
  Future<Sale?> refundSale(String saleId) async {
    final repo = _ref.read(salesRepositoryProvider);
    final result = await repo.refund(saleId);
    if (result is SalesSuccess<Sale>) {
      return result.data;
    }
    return null;
  }

  void reset() {
    state = const AsyncData(null);
  }
}

// ──────────────────────────────────
// Providers
// ──────────────────────────────────
final cartProvider = StateNotifierProvider<CartNotifier, CartState>((ref) {
  return CartNotifier(ref);
});

final saleListProvider =
    StateNotifierProvider<SaleListNotifier, SaleListState>((ref) {
  return SaleListNotifier(ref);
});

final posProvider = StateNotifierProvider<PosNotifier, AsyncValue<Sale?>>(
  (ref) => PosNotifier(ref),
);
