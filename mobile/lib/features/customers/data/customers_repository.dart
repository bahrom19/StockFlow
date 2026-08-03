import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/customers/domain/customer_models.dart';

sealed class CustomersResult<T> {
  const CustomersResult();
}

class CustomersSuccess<T> extends CustomersResult<T> {
  final T data;
  const CustomersSuccess(this.data);
}

class CustomersFailure<T> extends CustomersResult<T> {
  final Failure error;
  const CustomersFailure(this.error);
}

/// CustomersRepository — real API calls against /customers endpoints.
class CustomersRepository {
  final ApiClient _api;
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('CustomersRepo'));

  CustomersRepository(this._api);

  Future<CustomersResult<CustomerListResponse>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? type,
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
      if (type != null) params['type'] = type;
      if (isActive != null) params['isActive'] = isActive;

      final response = await _api.get<Map<String, dynamic>>(
        ApiEndpoints.customers,
        queryParameters: params,
      );
      return CustomersSuccess(CustomerListResponse.fromJson(response.data!));
    } catch (e) {
      return CustomersFailure(_errorHandler.handle(e));
    }
  }

  Future<CustomersResult<Customer>> getById(String id) async {
    try {
      final response =
          await _api.get<Map<String, dynamic>>('${ApiEndpoints.customers}/$id');
      return CustomersSuccess(Customer.fromJson(response.data!));
    } catch (e) {
      return CustomersFailure(_errorHandler.handle(e));
    }
  }

  Future<CustomersResult<Customer>> create(CreateCustomerRequest request) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        ApiEndpoints.customers,
        data: request.toJson(),
      );
      return CustomersSuccess(Customer.fromJson(response.data!));
    } catch (e) {
      return CustomersFailure(_errorHandler.handle(e));
    }
  }

  Future<CustomersResult<Customer>> update(
    String id,
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '${ApiEndpoints.customers}/$id',
        data: data,
      );
      return CustomersSuccess(Customer.fromJson(response.data!));
    } catch (e) {
      return CustomersFailure(_errorHandler.handle(e));
    }
  }

  Future<CustomersResult<void>> delete(String id) async {
    try {
      await _api.delete<dynamic>('${ApiEndpoints.customers}/$id');
      return const CustomersSuccess(null);
    } catch (e) {
      return CustomersFailure(_errorHandler.handle(e));
    }
  }
}

final customersRepositoryProvider = Provider<CustomersRepository>((ref) {
  final api = ref.read(apiClientProvider);
  return CustomersRepository(api);
});
