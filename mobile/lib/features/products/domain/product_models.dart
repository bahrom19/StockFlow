import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:stockflow/core/errors/failures.dart';

part 'product_models.freezed.dart';
part 'product_models.g.dart';

// ──────────────────────────────────
// Stock level classification
// ──────────────────────────────────

/// Low-stock threshold shared by the whole app: a product whose TOTAL stock
/// quantity is in `(0, kLowStockThreshold]` counts as "low on stock", and a
/// product with `0` is out of stock. This mirrors the existing presentation
/// rules (orange/red stock cell in the Products table and product card, POS
/// catalog badge) and the dashboard summary counters from the backend
/// (`/reports/dashboard`: low = `quantity > 0 && quantity <= 5`,
/// out-of-stock = `quantity === 0`). The constants below are THE single
/// source of truth for that classification — filters and cells must derive
/// from them instead of re-hardcoding numbers.
const int kLowStockThreshold = 5;

extension ProductStockX on Product {
  /// True when the available (total across warehouses) quantity is zero.
  bool get isOutOfStock => stockQuantity == 0;

  /// True when the product still has stock but is at/below the reorder
  /// threshold ([kLowStockThreshold]). Out-of-stock products are NOT low
  /// stock (same rule as the dashboard Action Center: OUT_OF_STOCK ≠ LOW_STOCK).
  bool get isLowStock =>
      stockQuantity > 0 && stockQuantity <= kLowStockThreshold;
}

/// Stock-level filter for the Products list, driven by the Dashboard
/// "Requires attention" alerts through the `/products?stock=<param>` deep
/// link (see [queryParameterKey]).
enum ProductStockFilter {
  /// Products below/at the reorder threshold — `0 < stockQuantity <=
  /// kLowStockThreshold` ("Товар заканчивается" alert).
  low('low'),

  /// Products with zero available quantity ("Товар закончился" alert).
  out('out');

  const ProductStockFilter(this.queryParam);

  /// URL query-parameter value used on the `/products` route.
  final String queryParam;

  /// Name of the `/products` query parameter carrying this filter.
  static const String queryParameterKey = 'stock';

  /// Parses the raw query-parameter value; unknown/null values degrade to
  /// `null` (unfiltered list) instead of throwing.
  static ProductStockFilter? fromQueryParam(String? value) {
    for (final filter in values) {
      if (filter.queryParam == value) return filter;
    }
    return null;
  }

  /// Whether [product] should be listed under this filter. Reuses the shared
  /// classification above — no separate threshold math here.
  bool matches(Product product) => switch (this) {
        ProductStockFilter.low => product.isLowStock,
        ProductStockFilter.out => product.isOutOfStock,
      };
}

// ──────────────────────────────────
// Product (matches ProductEntity)
// ──────────────────────────────────
@freezed
class Product with _$Product {
  const factory Product({
    required String id,
    required String companyId,
    required String name,
    String? description,
    String? sku,
    String? barcode,
    String? ntin,
    String? price,
    String? costPrice,
    String? unit,
    String? category,
    String? brand,
    @Default(0) int stockQuantity,
    @Default(true) bool isActive,
    required String createdAt,
    required String updatedAt,
    String? deletedAt,
  }) = _Product;

  factory Product.fromJson(Map<String, dynamic> json) =>
      _$ProductFromJson(json);
}

// ──────────────────────────────────
// Product List Response (paginated)
// ──────────────────────────────────
@freezed
class ProductListResponse with _$ProductListResponse {
  const factory ProductListResponse({
    required List<Product> items,
    required int total,
    required int page,
    required int limit,
  }) = _ProductListResponse;

  factory ProductListResponse.fromJson(Map<String, dynamic> json) =>
      _$ProductListResponseFromJson(json);
}

// ──────────────────────────────────
// Product Form Data (create/update)
// ──────────────────────────────────
@freezed
class ProductFormData with _$ProductFormData {
  const factory ProductFormData({
    required String name,
    String? sku,
    String? barcode,
    String? ntin,
    required String price,
    String? costPrice,
    String? unit,
    String? category,
    String? brand,
    String? description,
    @Default(0) int stockQuantity,
    @Default(true) bool isActive,
  }) = _ProductFormData;

  factory ProductFormData.fromJson(Map<String, dynamic> json) =>
      _$ProductFormDataFromJson(json);
}

// ──────────────────────────────────
// Create Product Request
// ──────────────────────────────────
@freezed
class CreateProductRequest with _$CreateProductRequest {
  const factory CreateProductRequest({
    required String name,
    String? sku,
    String? barcode,
    String? ntin,
    required String price,
    String? costPrice,
    String? unit,
    String? category,
    String? brand,
    String? description,
    @Default(0) int stockQuantity,
    @Default(true) bool isActive,
  }) = _CreateProductRequest;

  factory CreateProductRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateProductRequestFromJson(json);
}

// ──────────────────────────────────
// Products State
// ──────────────────────────────────
sealed class ProductsState {
  const ProductsState();
}

class ProductsLoading extends ProductsState {
  const ProductsLoading();
}

class ProductsLoaded extends ProductsState {
  final List<Product> products;
  final int total;
  final int page;
  final bool hasMore;
  final bool isRefreshing;
  final bool isLoadingMore;
  final String search;
  final String? category;

  /// Active stock-level filter (from a Dashboard alert deep link or the
  /// filter chips). Null → unfiltered.
  final ProductStockFilter? stockFilter;

  const ProductsLoaded({
    required this.products,
    required this.total,
    required this.page,
    this.hasMore = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.search = '',
    this.category,
    this.stockFilter,
  });

  ProductsLoaded copyWith({
    List<Product>? products,
    int? total,
    int? page,
    bool? hasMore,
    bool? isRefreshing,
    bool? isLoadingMore,
    String? search,
    String? category,
    ProductStockFilter? stockFilter,
  }) {
    return ProductsLoaded(
      products: products ?? this.products,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      search: search ?? this.search,
      category: category ?? this.category,
      stockFilter: stockFilter ?? this.stockFilter,
    );
  }
}

class ProductsEmpty extends ProductsState {
  final String message;
  const ProductsEmpty([this.message = 'No products found']);
}

class ProductsError extends ProductsState {
  final String message;
  final Failure? failure;

  const ProductsError(this.message, {this.failure});
}

class ProductDetailLoading extends ProductsState {
  const ProductDetailLoading();
}

class ProductDetailLoaded extends ProductsState {
  final Product product;
  const ProductDetailLoaded(this.product);
}

class ProductDetailError extends ProductsState {
  final String message;
  const ProductDetailError(this.message);
}
