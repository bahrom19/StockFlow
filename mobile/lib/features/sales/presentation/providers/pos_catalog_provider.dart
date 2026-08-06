import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';

// ──────────────────────────────────
// Catalog State
// ──────────────────────────────────
class PosCatalogState {
  final List<Product> products;
  final int total;
  final int page;
  final bool hasMore;
  final bool isLoading;
  final bool isSearching;
  final String query;
  final String? category;
  final List<String> categories;
  final int selectedIndex;
  final String? error;

  const PosCatalogState({
    this.products = const [],
    this.total = 0,
    this.page = 1,
    this.hasMore = false,
    this.isLoading = false,
    this.isSearching = false,
    this.query = '',
    this.category,
    this.categories = const [],
    this.selectedIndex = 0,
    this.error,
  });

  Product? get selected =>
      products.isEmpty ? null : products[selectedIndex.clamp(0, products.length - 1)];

  PosCatalogState copyWith({
    List<Product>? products,
    int? total,
    int? page,
    bool? hasMore,
    bool? isLoading,
    bool? isSearching,
    String? query,
    String? category,
    List<String>? categories,
    int? selectedIndex,
    String? error,
    bool clearError = false,
  }) {
    return PosCatalogState(
      products: products ?? this.products,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      isLoading: isLoading ?? this.isLoading,
      isSearching: isSearching ?? this.isSearching,
      query: query ?? this.query,
      category: category ?? this.category,
      categories: categories ?? this.categories,
      selectedIndex: selectedIndex ?? this.selectedIndex,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

// ──────────────────────────────────
// Notifier — debounced search, LRU cache, pagination, keyboard nav
// ──────────────────────────────────
class PosCatalogNotifier extends StateNotifier<PosCatalogState> {
  final Ref _ref;
  Timer? _debounce;

  /// Simple query cache: key = "query|category|page".
  final Map<String, List<Product>> _cache = {};
  static const int _cacheLimit = 8;

  PosCatalogNotifier(this._ref) : super(const PosCatalogState());

  Future<void> init() async {
    if (state.products.isNotEmpty || state.isLoading) return;
    await _fetch(page: 1, reset: true);
  }

  /// Debounced search by name / SKU / barcode (server side).
  void search(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (query == state.query) return;
      state = state.copyWith(
        query: query,
        isSearching: true,
        clearError: true,
      );
      _fetch(page: 1, reset: true);
    });
  }

  /// Immediate search — used by Enter / barcode scanners.
  Future<void> searchNow(String query) async {
    _debounce?.cancel();
    state = state.copyWith(query: query, isSearching: true, clearError: true);
    await _fetch(page: 1, reset: true);
  }

  /// Applies a category filter and reloads page 1.
  /// Returns the fetch future so callers (and tests) can await completion.
  Future<void> setCategory(String? category) async {
    if (category == state.category) return;
    state = state.copyWith(category: category, isSearching: true, clearError: true);
    await _fetch(page: 1, reset: true);
  }

  Future<void> loadMore() async {
    final s = state;
    if (s.isLoading || !s.hasMore) return;
    await _fetch(page: s.page + 1, reset: false);
  }

  void moveSelection(int delta) {
    final s = state;
    if (s.products.isEmpty) return;
    final next = (s.selectedIndex + delta)
        .clamp(0, s.products.length - 1);
    if (next != s.selectedIndex) {
      state = s.copyWith(selectedIndex: next);
    }
  }

  Future<void> _fetch({required int page, required bool reset}) async {
    final s = state;
    final cacheKey = '${s.query}|${s.category}|$page';
    final cached = _cache[cacheKey];

    state = s.copyWith(
      isLoading: reset ? s.products.isEmpty : false,
      isSearching: false,
      error: null,
    );

    List<Product> items;
    int total;
    if (cached != null) {
      items = cached;
      total = s.total;
    } else {
      final repo = _ref.read(productsRepositoryProvider);
      final result = await repo.list(
        page: page,
        limit: 30,
        search: s.query.trim().isEmpty ? null : s.query.trim(),
        category: s.category,
      );
      if (result is ProductsFail<ProductListResponse>) {
        state = state.copyWith(
          isLoading: false,
          isSearching: false,
          error: (result as ProductsFail<ProductListResponse>).error.message,
        );
        return;
      }
      final response = (result as ProductsSuccess<ProductListResponse>).data;
      items = response.items;
      total = response.total;
      _cache[cacheKey] = items;
      if (_cache.length > _cacheLimit) {
        _cache.remove(_cache.keys.first);
      }
    }

    final merged = reset ? items : [...s.products, ...items];
    final categories = _deriveCategories(merged, s.categories);

    state = PosCatalogState(
      products: merged,
      total: total,
      page: page,
      hasMore: merged.length < total,
      query: s.query,
      category: s.category,
      categories: categories,
      selectedIndex: s.selectedIndex.clamp(0, merged.length - 1),
      error: null,
    );
  }

  List<String> _deriveCategories(List<Product> products, List<String> existing) {
    final set = <String>{...existing};
    for (final p in products) {
      final c = p.category;
      if (c != null && c.trim().isNotEmpty) set.add(c.trim());
    }
    final list = set.toList()..sort();
    return list;
  }

  /// Clears the search and refreshes the first page (e.g. after a sale).
  Future<void> resetToDefaults() async {
    _debounce?.cancel();
    state = const PosCatalogState();
    await _fetch(page: 1, reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }
}

final posCatalogProvider =
    StateNotifierProvider<PosCatalogNotifier, PosCatalogState>((ref) {
  return PosCatalogNotifier(ref);
});
