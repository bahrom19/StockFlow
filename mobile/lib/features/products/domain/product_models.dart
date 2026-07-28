import 'package:freezed_annotation/freezed_annotation.dart';

part 'product_models.freezed.dart';
part 'product_models.g.dart';

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

  const ProductsLoaded({
    required this.products,
    required this.total,
    required this.page,
    this.hasMore = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.search = '',
  });

  ProductsLoaded copyWith({
    List<Product>? products,
    int? total,
    int? page,
    bool? hasMore,
    bool? isRefreshing,
    bool? isLoadingMore,
    String? search,
  }) {
    return ProductsLoaded(
      products: products ?? this.products,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      search: search ?? this.search,
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
