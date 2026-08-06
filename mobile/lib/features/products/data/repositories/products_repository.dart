import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/products/domain/product_models.dart';

sealed class ProductsResult<T> {
  const ProductsResult();
}

class ProductsSuccess<T> extends ProductsResult<T> {
  final T data;
  const ProductsSuccess(this.data);
}

class ProductsFail<T> extends ProductsResult<T> {
  final Failure error;
  const ProductsFail(this.error);
}

/// ProductsRepository — real API calls against /products endpoints.
class ProductsRepository {
  final Ref _ref;
  final AppLogger _logger = AppLogger('ProductsRepo');
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('ErrHandler'));

  ProductsRepository(this._ref);

  Future<ProductsResult<ProductListResponse>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    String? sortBy,
    String? sortOrder,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final params = <String, dynamic>{
        'page': page.toString(),
        'limit': limit.toString(),
      };
      if (search != null && search.isNotEmpty) params['search'] = search;
      if (category != null && category.isNotEmpty) {
        params['category'] = category;
      }
      if (sortBy != null) params['sortBy'] = sortBy;
      if (sortOrder != null) params['sortOrder'] = sortOrder;

      final response = await client.get(
        ApiEndpoints.products,
        queryParameters: params,
      );
      final data = response.data as Map<String, dynamic>;
      return ProductsSuccess(ProductListResponse.fromJson(data));
    } catch (e) {
      _logger.error('Products list failed', e);
      return ProductsFail(_errorHandler.handle(e));
    }
  }

  Future<ProductsResult<Product>> getById(String id) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get('${ApiEndpoints.products}/$id');
      final data = response.data as Map<String, dynamic>;
      return ProductsSuccess(Product.fromJson(data));
    } catch (e) {
      _logger.error('Product detail failed', e);
      return ProductsFail(_errorHandler.handle(e));
    }
  }

  Future<ProductsResult<Product>> create(CreateProductRequest request) async {
    try {
      final client = _ref.read(apiClientProvider);
      // The deployed CreateProductDto requires companyId in the request body.
      final companyId = _ref.read(currentUserProvider)?.companyId;
      final payload = <String, dynamic>{
        ...request.toJson(),
        if (companyId != null && companyId.isNotEmpty)
          'companyId': companyId,
      };
      final response = await client.post(
        ApiEndpoints.products,
        data: payload,
      );
      final data = response.data as Map<String, dynamic>;
      return ProductsSuccess(Product.fromJson(data));
    } catch (e) {
      _logger.error('Product create failed', e);
      return ProductsFail(_errorHandler.handle(e));
    }
  }

  Future<ProductsResult<Product>> update(
    String id,
    Map<String, dynamic> data,
  ) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.patch(
        '${ApiEndpoints.products}/$id',
        data: data,
      );
      final responseData = response.data as Map<String, dynamic>;
      return ProductsSuccess(Product.fromJson(responseData));
    } catch (e) {
      _logger.error('Product update failed', e);
      return ProductsFail(_errorHandler.handle(e));
    }
  }

  Future<ProductsResult<void>> delete(String id) async {
    try {
      final client = _ref.read(apiClientProvider);
      await client.delete('${ApiEndpoints.products}/$id');
      return const ProductsSuccess(null);
    } catch (e) {
      _logger.error('Product delete failed', e);
      return ProductsFail(_errorHandler.handle(e));
    }
  }
}

final productsRepositoryProvider = Provider<ProductsRepository>((ref) {
  return ProductsRepository(ref);
});
