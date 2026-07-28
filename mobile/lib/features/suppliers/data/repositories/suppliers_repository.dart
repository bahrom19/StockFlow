import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';

sealed class SuppliersResult<T> {
  const SuppliersResult();
}

class SuppliersSuccess<T> extends SuppliersResult<T> {
  final T data;
  const SuppliersSuccess(this.data);
}

class SuppliersFailure<T> extends SuppliersResult<T> {
  final Failure error;
  const SuppliersFailure(this.error);
}

class SuppliersRepository {
  final ApiClient _api;
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('SuppliersRepo'));

  SuppliersRepository(this._api);

  Future<SuppliersResult<SupplierListResponse>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? isActive,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
        'sortBy': sortBy,
        'sortOrder': sortOrder,
      };
      if (search != null && search.isNotEmpty) params['search'] = search;
      if (isActive != null) params['isActive'] = isActive;

      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers',
        queryParameters: params,
      );
      return SuppliersSuccess(SupplierListResponse.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<Supplier>> getById(String id) async {
    try {
      final response = await _api.get<Map<String, dynamic>>('/suppliers/$id');
      return SuppliersSuccess(Supplier.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<Supplier>> create(CreateSupplierRequest request) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/suppliers',
        data: request.toJson(),
      );
      return SuppliersSuccess(Supplier.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<Supplier>> update(
      String id, Map<String, dynamic> data) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/suppliers/$id',
        data: data,
      );
      return SuppliersSuccess(Supplier.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<void>> delete(String id) async {
    try {
      await _api.delete<dynamic>('/suppliers/$id');
      return const SuppliersSuccess(null);
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }
}

final suppliersRepositoryProvider = Provider<SuppliersRepository>((ref) {
  final api = ref.read(apiClientProvider);
  return SuppliersRepository(api);
});
