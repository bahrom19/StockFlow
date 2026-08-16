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
    final repo = _ref.read(productsRepositoryProvider);
    final result = await repo.list(
      page: page,
      limit: 20,
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
