import 'dart:async';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';

// ──────────────────────────────────
// Products List Notifier
// ──────────────────────────────────
class ProductsListNotifier extends StateNotifier<ProductsState> {
  final Ref _ref;
  Timer? _searchDebounce;
  String _currentSearch = '';
  String? _currentCategory;

  /// Active stock-level filter ("Низкий остаток" / "Нет в наличии"). Set from
  /// the Dashboard alert deep link ([applyStockFilter]) or the filter chips
  /// ([setStockFilter]); matching itself happens client-side in [_fetch] via
  /// the shared rules in product_models.dart.
  ProductStockFilter? _currentStockFilter;

  /// Raw API pagination cursor used while a stock filter is active — matches
  /// can be sparse, so several raw pages may back a single visible page.
  int _rawCursorPage = 0;

  static const int _pageSize = 20;

  ProductsListNotifier(this._ref) : super(const ProductsLoading());

  Future<void> loadProducts() async {
    state = const ProductsLoading();
    await _fetch();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is ProductsLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, products: []);
    }
    _currentSearch = '';
    await _fetch();
  }

  void setCategory(String? category) {
    _currentCategory = category;
    final current = state;
    if (current is ProductsLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, products: []);
    } else {
      state = const ProductsLoading();
    }
    _fetch();
  }

  /// Applies the stock-level filter carried by the `/products?stock=` deep
  /// link (Dashboard → Требует внимания → «Проверить остатки»). No-op when
  /// the same filter is already applied to a loaded list.
  void applyStockFilter(ProductStockFilter filter) {
    if (_currentStockFilter == filter && state is ProductsLoaded) return;
    _resetToFilter(filter);
  }

  /// Filter-chip handler on the Products screen: applying the active filter
  /// again (or the "All" chip with a `null` value) clears the stock filter.
  void setStockFilter(ProductStockFilter? filter) {
    final next = filter == _currentStockFilter ? null : filter;
    _resetToFilter(next);
  }

  void _resetToFilter(ProductStockFilter? filter) {
    _currentStockFilter = filter;
    _rawCursorPage = 0;
    final current = state;
    if (current is ProductsLoaded) {
      // Built directly instead of copyWith so an explicit `null` clears the
      // previous filter.
      state = ProductsLoaded(
        products: const [],
        total: current.total,
        page: 1,
        isRefreshing: true,
        search: _currentSearch,
        category: _currentCategory,
        stockFilter: filter,
      );
    } else {
      state = const ProductsLoading();
    }
    _fetch();
  }

  void search(String query) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      _currentSearch = query;
      final current = state;
      if (current is ProductsLoaded) {
        state = current.copyWith(isRefreshing: true, page: 1, products: []);
      } else {
        state = const ProductsLoading();
      }
      _fetch();
    });
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! ProductsLoaded ||
        current.isLoadingMore ||
        !current.hasMore) return;

    state = current.copyWith(isLoadingMore: true);
    await _fetch(page: current.page + 1, append: true);
  }

  Future<void> _fetch({int page = 1, bool append = false}) async {
    // Stock-level filters are evaluated on the client (the products API has
    // no stock-quantity predicate) with their own pagination strategy.
    if (_currentStockFilter != null) {
      await _fetchFilteredStock(append: append);
      return;
    }

    final repo = _ref.read(productsRepositoryProvider);
    final result = await repo.list(
      page: page,
      limit: _pageSize,
      search: _currentSearch.isNotEmpty ? _currentSearch : null,
      category: _currentCategory,
    );

    if (result is ProductsFail<ProductListResponse>) {
      state = ProductsError(
        result.error.message,
        failure: result.error,
      );
      return;
    }

    final response = (result as ProductsSuccess<ProductListResponse>).data;

    if (response.items.isEmpty && page == 1) {
      state = ProductsEmpty();
      return;
    }

    final products = append
        ? [...(state as ProductsLoaded).products, ...response.items]
        : response.items;
    final hasMore = products.length < response.total;

    state = ProductsLoaded(
      products: products,
      total: response.total,
      page: page,
      hasMore: hasMore,
      search: _currentSearch,
      category: _currentCategory,
    );
  }

  /// Loads products for the active stock filter ([_currentStockFilter]).
  ///
  /// Matching uses the shared classification from product_models.dart
  /// ([ProductStockFilter.matches] → [ProductStockX]) — no separate threshold
  /// math here. Because matching items can be sparse (e.g. a single product
  /// out of stock among hundreds), raw pages keep being consumed until a full
  /// visible page of matches is collected or the catalog is exhausted; the
  /// cursor survives across loadMore() so already-shown items never reshuffle.
  Future<void> _fetchFilteredStock({required bool append}) async {
    final repo = _ref.read(productsRepositoryProvider);
    final filter = _currentStockFilter!;
    final previous = state is ProductsLoaded ? state as ProductsLoaded : null;
    final matched = append && previous != null
        ? [...previous.products]
        : <Product>[];
    if (!append) _rawCursorPage = 0;

    var exhausted = false;
    while (matched.length < _pageSize) {
      final nextPage = _rawCursorPage + 1;
      final result = await repo.list(
        page: nextPage,
        // Kept explicit: the scan loop relies on the request page size being
        // identical to the repository/API default (20).
        // ignore: avoid_redundant_argument_values
        limit: _pageSize,
        search: _currentSearch.isNotEmpty ? _currentSearch : null,
        category: _currentCategory,
      );

      if (result is ProductsFail<ProductListResponse>) {
        // Keep whatever is already on screen; only surface the error when
        // there is nothing to show yet.
        if (matched.isEmpty) {
          state = ProductsError(result.error.message, failure: result.error);
        }
        return;
      }

      final response = (result as ProductsSuccess<ProductListResponse>).data;
      _rawCursorPage = nextPage;
      matched.addAll(response.items.where(filter.matches));

      final rawExhausted =
          response.items.isEmpty || nextPage * _pageSize >= response.total;
      if (rawExhausted) {
        exhausted = true;
        break;
      }
    }

    state = ProductsLoaded(
      products: matched,
      // Exact count once the whole catalog has been classified.
      total: matched.length,
      page: append && previous != null ? previous.page + 1 : 1,
      hasMore: !exhausted,
      search: _currentSearch,
      category: _currentCategory,
      stockFilter: filter,
    );
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }
}

// ──────────────────────────────────
// Product Detail Notifier
// ──────────────────────────────────
class ProductDetailNotifier extends StateNotifier<ProductsState> {
  final Ref _ref;

  ProductDetailNotifier(this._ref) : super(const ProductDetailLoading());

  Future<void> loadProduct(String id, {AppLocalizations? l10n}) async {
    state = const ProductDetailLoading();
    final repo = _ref.read(productsRepositoryProvider);
    try {
      final result = await repo.getById(id);
      state = result is ProductsSuccess<Product>
          ? ProductDetailLoaded(result.data)
          : ProductDetailError(
              result is ProductsFail<Product>
                  ? result.error.message
                  : (l10n?.failedToLoadProduct ?? 'Failed to load product'));
    } catch (_) {
      // Unexpected repository error — surface a localized message instead of
      // letting the exception escape the async caller unhandled.
      state = ProductDetailError(
        l10n?.failedToLoadProduct ?? 'Failed to load product',
      );
    }
  }

  Future<bool> deleteProduct(String id) async {
    final repo = _ref.read(productsRepositoryProvider);
    final result = await repo.delete(id);
    if (result is ProductsFail) return false;
    return true;
  }
}

// ──────────────────────────────────
// Providers
// ──────────────────────────────────
final productsListProvider =
    StateNotifierProvider<ProductsListNotifier, ProductsState>((ref) {
  return ProductsListNotifier(ref);
});

final productDetailProvider =
    StateNotifierProvider.family<ProductDetailNotifier, ProductsState, String>(
  (ref, id) => ProductDetailNotifier(ref),
);
