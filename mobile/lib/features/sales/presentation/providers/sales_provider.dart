import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/core/currency/money.dart';
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

  Money get subtotal =>
      items.fold(Money.zero(currency), (sum, item) => sum + item.subtotal);

  Money get totalDiscount => items.fold(
      Money.zero(currency), (sum, item) => sum + item.effectiveDiscount);

  /// Estimated tax — the backend computes the authoritative amount at sale
  /// creation; the receipt shows the returned `sale.tax`. A cart-level rate
  /// keeps the register transparent about the line before completion.
  double get taxRate => 0;

  Money get tax {
    final rateBp = (taxRate * 100).round();
    if (rateBp == 0) return Money.zero(currency);
    // Exact percentage of subtotal in minor units (rateBp per-mille).
    return Money.fromMinorUnits(
        (subtotal.minorUnits * rateBp) ~/ 10000, currency);
  }

  Money get total {
    final t = subtotal - totalDiscount;
    return t.isNegative ? Money.zero(currency) : t;
  }

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
    syncFromCurrency();
    // Single operating-currency invariant: a cart never mixes currencies.
    // Reject (do not silently convert) any item whose currency differs —
    // this mirrors Money's own cross-currency safety behavior.
    if (item.unitPrice.currency != state.currency) {
      throw ArgumentError(
        'Cannot add an item in ${item.unitPrice.currency} to a '
        'cart operating in ${state.currency}; mixed-currency '
        'carts are not supported.',
      );
    }
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
    syncFromCurrency();
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

  void updateDiscount(String productId, Money discount) {
    syncFromCurrency();
    final idx = state.items.indexWhere((i) => i.productId == productId);
    if (idx < 0) return;
    final item = state.items[idx];
    // A discount can never exceed the line subtotal nor go below zero.
    final clamped = discount.clamp(Money.zero(state.currency), item.subtotal);
    final newItems = [...state.items];
    newItems[idx] = newItems[idx].copyWith(discount: clamped);
    state = state.copyWith(items: newItems);
  }

  void removeItem(String productId) {
    syncFromCurrency();
    state = state.copyWith(
      items: state.items.where((i) => i.productId != productId).toList(),
    );
  }

  void setCustomer(String? id, String? name) {
    syncFromCurrency();
    state = state.copyWith(customerId: id, customerName: name);
  }

  /// Keeps [currencyProvider] the single source of truth. Any caller updating
  /// the cart's currency routes through the provider value instead of storing
  /// a competing value on the cart.
  void setCurrency(String currency) {
    syncFromCurrency();
  }

  /// Re-syncs the cart currency to the current [currencyProvider] value.
  void syncFromCurrency() {
    final currency = _ref.read(currencyProvider);
    if (currency == state.currency) return;
    state = state.copyWith(currency: currency);
  }

  void setNotes(String? notes) {
    syncFromCurrency();
    state = state.copyWith(notes: notes);
  }

  void clear() {
    // Preserve the active provider currency — never fall back to a hard-coded
    // default here.
    final currency = _ref.read(currencyProvider);
    state = CartState(currency: currency);
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
      if (item.unitPrice.isNegative) {
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
    if (current is! SaleListLoaded || current.isLoadingMore || !current.hasMore)
      return;

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
  /// Single source of truth for the CREATE_SALE request body — shared by the
  /// online draft flow and the offline outbox (Offline 1B-min) so both paths
  /// send identical payloads.
  CreateSaleRequest buildCreateSaleRequest({
    required String warehouseId,
    required List<CartItem> cartItems,
    required List<CreatePayment> payments,
    String? customerId,
    String? currency,
    String? notes,
  }) {
    return CreateSaleRequest(
      warehouseId: warehouseId,
      customerId: customerId,
      currency: currency ?? _ref.read(currencyProvider),
      notes: notes,
      items: cartItems
          .map((c) => CreateSaleItem(
                productId: c.productId,
                quantity: c.quantity,
                // API-boundary adapter: the backend DTO expects a JSON number, so
                // Money converts losslessly here via toApiNumber().
                unitPrice: c.unitPrice.toApiNumber().toDouble(),
                costPrice: c.costPrice.toApiNumber().toDouble(),
                discount: c.effectiveDiscount.toApiNumber().toDouble(),
              ))
          .toList(),
      payments: payments,
    );
  }

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
    final request = buildCreateSaleRequest(
      warehouseId: warehouseId,
      cartItems: cartItems,
      payments: payments,
      customerId: customerId,
      currency: currency,
      notes: notes,
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
  final notifier = CartNotifier(ref);
  notifier.syncFromCurrency(); // initial currency mirrors current provider.
  return notifier;
});

final saleListProvider =
    StateNotifierProvider<SaleListNotifier, SaleListState>((ref) {
  return SaleListNotifier(ref);
});

final posProvider = StateNotifierProvider<PosNotifier, AsyncValue<Sale?>>(
  (ref) => PosNotifier(ref),
);
