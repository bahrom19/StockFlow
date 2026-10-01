import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/core/currency/money.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
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

  /// G16-C-01: the Idempotency-Key for the CURRENT business submit. Minted
  /// once per PAY submit and reused for every retry of the same submit —
  /// retries can never mint a new key, otherwise a duplicate submit would
  /// create a second sale. Cleared only when the submit reaches a terminal
  /// outcome (2xx, permanent 4xx or the user abandons the flow).
  String? _submitIdempotencyKey;

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
    // G16-C-01: one immutable key per business submit — attempt 1 and every
    // retry share it, so the backend replays instead of double-selling.
    final key = _submitIdempotencyKey ??= OutboxOperation.idGenerator();
    final result = await repo.create(request, idempotencyKey: key);
    if (result is SalesSuccess<Sale>) {
      _submitIdempotencyKey = null;
      state = AsyncData(result.data);
      return result.data;
    }
    final error = (result as SalesFailure<Sale>).error;
    state = AsyncError(error.message, StackTrace.current);
    return null;
  }

  /// G16-C-01: the caller (POS workspace) abandons the current submit — the
  /// pending key is dropped so the NEXT submit mints a fresh one. Called on
  /// the failure paths after the user has been informed.
  void abandonSubmit() {
    _submitIdempotencyKey = null;
  }

  /// Complete a sale (DRAFT → COMPLETED)
  Future<Sale?> completeSale(String saleId) async {
    state = const AsyncLoading();
    final repo = _ref.read(salesRepositoryProvider);
    // G16-C-01: reuse the submit key through complete so create+complete of
    // one business submit form one idempotency chain; fall back to a fresh
    // key when completing outside that flow.
    final key = _submitIdempotencyKey ??= OutboxOperation.idGenerator();
    final result = await repo.complete(saleId, idempotencyKey: key);
    if (result is SalesSuccess<Sale>) {
      _submitIdempotencyKey = null;
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

  /// One logical refund submission = one immutable Idempotency-Key (G16-N-2).
  ///
  /// The key is minted lazily once per logical submit and reused for every
  /// retry attempt of that submit — the transport never auto-retries POSTs
  /// (`_RetryInterceptor` covers GET/HEAD/OPTIONS only), so attempts are
  /// user-driven re-taps of the same confirmation. The key is cleared only
  /// when the submit reaches a terminal outcome for the CURRENT submission:
  /// success, a definitive non-retryable failure (mapped 4xx — the backend
  /// rejected the submission itself and the reservation rolled back with the
  /// business transaction), or an explicit abandonment before a NEW
  /// submission. A timeout/network failure keeps the key: the user retry must
  /// replay the same reservation, never mint a new one.
  ///
  /// Not persisted (refund is online-only — no outbox kind exists for it):
  /// an app restart mid-submit loses the key. That is safe — a refund is
  /// all-or-nothing (the reservation commits atomically with the aggregate),
  /// and the UI gates the action on the live sale status, so a retry after
  /// restart either finds the refund already applied or starts clean.
  final RefundSubmitKey _refundSubmitKey = RefundSubmitKey();

  /// The sale the currently held refund key belongs to. `posProvider` is an
  /// app-wide notifier, so a key retained after a timeout on one sale must
  /// never be reused for a different sale's refund (different payload → the
  /// backend would 422 a legitimate new submission). Switching sales starts
  /// a clean submission context.
  String? _refundSubmitSaleId;

  /// Refund a sale through the canonical `POST /sales/:id/refund` endpoint.
  ///
  /// Key lifecycle: mint-once per logical submit, reuse on every retry,
  /// clear on terminal outcomes per [RefundSubmitKey] docs.
  ///
  /// Pass `items: null` (or empty) for a FULL refund (all remaining
  /// quantities — the canonical semantics of the endpoint). Pass explicit
  /// `items` for a partial refund. Each refundSale() call = ONE logical
  /// submit attempt; a NEW submission must call [beginRefundSubmit] first so
  /// it mints a fresh key.
  ///
  /// Returns `null` on success, or the failure message for display (mapped
  /// by the canonical ErrorHandler — localize via `localizedErrorLabel`).
  Future<String?> refundSale(
    String saleId, {
    List<RefundItem>? items,
  }) async {
    final repo = _ref.read(salesRepositoryProvider);
    // Cross-sale guard: a retained key from another sale's uncertain submit
    // must not pin this sale's submission (see [_refundSubmitSaleId]).
    if (_refundSubmitSaleId != saleId) {
      _refundSubmitKey.clear();
      _refundSubmitSaleId = saleId;
    }
    final result = await repo.refund(
      saleId,
      request: items == null ? null : RefundSaleRequest(items: items),
      idempotencyKey: _refundSubmitKey.currentOrNew(),
    );
    if (result is SalesSuccess<void>) {
      _refundSubmitKey.clear();
      return null;
    }
    final failure = (result as SalesFailure<void>).error;
    if (_isDefinitiveRefundFailure(failure)) {
      // 4xx: the backend rejected this submission itself — the key's
      // reservation rolled back with the business transaction, so a later
      // retry must start a NEW submission (new key). Timeout/network keeps
      // the key so the retry replays the same reservation.
      _refundSubmitKey.clear();
    }
    return failure.message;
  }

  /// Start a NEW logical refund submission (G16-N-2): drops any held key so
  /// the next [refundSale] mints a fresh one. Called by the UI before a NEW
  /// user-confirmed refund — for the SAME submission's user retries, the UI
  /// must NOT call this, so the retry reuses the immutable key.
  void beginRefundSubmit() => _refundSubmitKey.clear();

  /// Definitive (non-retryable) refund failures: mapped 400/404/401/403.
  /// These rejected the submission itself — the idempotency reservation
  /// rolled back with the business transaction, so keeping the key would pin
  /// the next submission to a dead reservation. Everything else (network,
  /// timeouts, 5xx, and 409 Conflict) is NOT definitive: the backend MAY
  /// have committed (lost response / another same-key request in flight),
  /// which is exactly the duplicate risk the key protects against — a retry
  /// with the SAME key either replays the committed result or runs clean.
  static bool _isDefinitiveRefundFailure(Failure failure) {
    if (failure is ValidationFailure || // 400 / 422
        failure is NotFoundFailure || // 404 (sale gone / other tenant)
        failure is AuthFailure) {
      // 401/403 — re-auth needed; a stale key must not bind a later submit
      return true;
    }
    return false;
  }

  void reset() {
    state = const AsyncData(null);
  }
}

/// Immutable-per-submit Idempotency-Key holder for the canonical refund
/// submission (G16-N-2).
///
/// Mirrors the proven `_submitIdempotencyKey` pattern of G16-C-01 (create /
/// complete): the key is minted lazily once per logical submit and reused
/// verbatim by every retry of that submit. Cleared only at terminal
/// boundaries — see [PosNotifier.refundSale].
///
/// Key material is an opaque UUID v4 from the centralised [OutboxOperation
/// .idGenerator] (tests stub the same seam as the outbox does).
class RefundSubmitKey {
  String? _value;

  /// The currently held key, minting a fresh UUID v4 on first access.
  /// Subsequent reads return the SAME value until [clear].
  String currentOrNew() => _value ??= OutboxOperation.idGenerator();

  /// The currently held key without minting one.
  String? get current => _value;

  /// Drop the key. The next [currentOrNew] mints a fresh UUID v4 — used on
  /// terminal outcomes and before a NEW logical submission.
  void clear() => _value = null;
}

// ──────────────────────────────────
// Providers
// ──────────────────────────────────
final cartProvider = StateNotifierProvider<CartNotifier, CartState>((ref) {
  final notifier = CartNotifier(ref);
  notifier.syncFromCurrency(); // initial currency mirrors current provider.
  // G16-N-3 P1: the active POS cart is the same cross-user disclosure class as
  // held sales — CartState carries customerId/customerName plus CartItem
  // product and costPrice data, and the root ProviderScope outlives logout, so
  // without this a second cashier on a shared terminal inherits the first
  // cashier's live cart. Cleared on any change of authenticated identity.
  // Same lifecycle pattern as heldSalesProvider / outboxSchedulerProvider.
  ref.listen<AuthState>(authStateProvider, (prev, next) {
    if (_cartIdentityOf(prev) == _cartIdentityOf(next)) return;
    notifier.clear();
  });
  return notifier;
});

/// The authenticated identity carried by an [AuthState], or null when the
/// session is not authenticated. Used only to decide whether the cart must be
/// reset on an auth transition.
({String companyId, String userId})? _cartIdentityOf(AuthState? state) {
  if (state is! AuthAuthenticated) return null;
  final user = state.user;
  return (companyId: user.companyId, userId: user.id);
}

final saleListProvider =
    StateNotifierProvider<SaleListNotifier, SaleListState>((ref) {
  return SaleListNotifier(ref);
});

final posProvider = StateNotifierProvider<PosNotifier, AsyncValue<Sale?>>(
  (ref) => PosNotifier(ref),
);
