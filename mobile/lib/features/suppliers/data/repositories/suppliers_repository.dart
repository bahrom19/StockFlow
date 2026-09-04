import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_contact_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_address_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_payment_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_product_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';
// ProductPurchaseListResponse is in the same file

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
  final Ref _ref;
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('SuppliersRepo'));

  SuppliersRepository(this._api, this._ref);

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
      // The deployed CreateSupplierDto requires companyId in the request body.
      final companyId = _ref.read(currentUserProvider)?.companyId;
      final payload = <String, dynamic>{
        ...request.toJson(),
        if (companyId != null && companyId.isNotEmpty)
          'companyId': companyId,
      };
      final response = await _api.post<Map<String, dynamic>>(
        '/suppliers',
        data: payload,
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

  // ── Contacts ──────────────────────────────────────────────

  Future<SuppliersResult<List<SupplierContact>>> getContacts(
      String supplierId) async {
    try {
      final response = await _api.get<List>(
        '/suppliers/$supplierId/contacts',
      );
      final contacts = (response.data ?? [])
          .map((e) => SupplierContact.fromJson(e as Map<String, dynamic>))
          .toList();
      return SuppliersSuccess(contacts);
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierContact>> createContact(
      String supplierId, CreateSupplierContactRequest request) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/suppliers/$supplierId/contacts',
        data: request.toJson(),
      );
      return SuppliersSuccess(SupplierContact.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierContact>> updateContact(
      String supplierId, String contactId, Map<String, dynamic> data) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/suppliers/$supplierId/contacts/$contactId',
        data: data,
      );
      return SuppliersSuccess(SupplierContact.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<void>> deleteContact(
      String supplierId, String contactId) async {
    try {
      await _api.delete<dynamic>(
        '/suppliers/$supplierId/contacts/$contactId',
      );
      return const SuppliersSuccess(null);
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  // ── Addresses ─────────────────────────────────────────────

  Future<SuppliersResult<List<SupplierAddress>>> getAddresses(
      String supplierId) async {
    try {
      final response = await _api.get<List>(
        '/suppliers/$supplierId/addresses',
      );
      final addresses = (response.data ?? [])
          .map((e) => SupplierAddress.fromJson(e as Map<String, dynamic>))
          .toList();
      return SuppliersSuccess(addresses);
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierAddress>> createAddress(
      String supplierId, CreateSupplierAddressRequest request) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/suppliers/$supplierId/addresses',
        data: request.toJson(),
      );
      return SuppliersSuccess(SupplierAddress.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierAddress>> updateAddress(
      String supplierId, String addressId, Map<String, dynamic> data) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/suppliers/$supplierId/addresses/$addressId',
        data: data,
      );
      return SuppliersSuccess(SupplierAddress.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<void>> deleteAddress(
      String supplierId, String addressId) async {
    try {
      await _api.delete<dynamic>(
        '/suppliers/$supplierId/addresses/$addressId',
      );
      return const SuppliersSuccess(null);
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }
  // ── Payments ──────────────────────────────────────────────

  Future<SuppliersResult<SupplierPaymentListResponse>> getPayments(
      String supplierId, {int page = 1, int limit = 20}) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers/$supplierId/payments',
        queryParameters: {'page': page, 'limit': limit},
      );
      return SuppliersSuccess(
          SupplierPaymentListResponse.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierPayment>> createPayment(
      String supplierId, CreateSupplierPaymentRequest request) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/suppliers/$supplierId/payments',
        data: request.toJson(),
      );
      return SuppliersSuccess(
          SupplierPayment.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<void>> deletePayment(
      String supplierId, String paymentId) async {
    try {
      await _api.delete<dynamic>(
        '/suppliers/$supplierId/payments/$paymentId',
      );
      return const SuppliersSuccess(null);
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  // ── Finance Summary ────────────────────────────────────────

  Future<SuppliersResult<SupplierFinanceSummary>> getFinanceSummary(
      String supplierId) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers/$supplierId/finance/summary',
      );
      return SuppliersSuccess(
          SupplierFinanceSummary.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  // ── Supplier Purchase Analytics ─────────────────────

  Future<SuppliersResult<SupplierPurchaseSummary>> getPurchaseSummary(
      String supplierId, {String? dateFrom, String? dateTo}) async {
    try {
      final params = <String, dynamic>{};
      if (dateFrom != null && dateFrom.isNotEmpty) params['dateFrom'] = dateFrom;
      if (dateTo != null && dateTo.isNotEmpty) params['dateTo'] = dateTo;
      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers/$supplierId/analytics/purchase-summary',
        queryParameters: params.isNotEmpty ? params : null,
      );
      return SuppliersSuccess(
          SupplierPurchaseSummary.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<ProductPurchaseListResponse>> getProductPurchases(
      String supplierId, {
      String? dateFrom,
      String? dateTo,
      int page = 1,
      int limit = 20,
      String? search,
      String sortBy = 'totalPurchaseSpend',
      String sortOrder = 'desc'}) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
        'sortBy': sortBy,
        'sortOrder': sortOrder,
      };
      if (dateFrom != null && dateFrom.isNotEmpty) params['dateFrom'] = dateFrom;
      if (dateTo != null && dateTo.isNotEmpty) params['dateTo'] = dateTo;
      if (search != null && search.isNotEmpty) params['search'] = search;
      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers/$supplierId/analytics/product-purchases',
        queryParameters: params,
      );
      return SuppliersSuccess(
          ProductPurchaseListResponse.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierReliability>> getReliability(
      String supplierId, {String? dateFrom, String? dateTo}) async {
    try {
      final params = <String, dynamic>{};
      if (dateFrom != null && dateFrom.isNotEmpty) params['dateFrom'] = dateFrom;
      if (dateTo != null && dateTo.isNotEmpty) params['dateTo'] = dateTo;
      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers/$supplierId/analytics/reliability',
        queryParameters: params.isNotEmpty ? params : null,
      );
      return SuppliersSuccess(
          SupplierReliability.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierPriceHistory>> getPriceHistory(
      String supplierId, String productId,
      {String? dateFrom, String? dateTo}) async {
    try {
      final params = <String, dynamic>{
        'productId': productId,
      };
      if (dateFrom != null && dateFrom.isNotEmpty) params['dateFrom'] = dateFrom;
      if (dateTo != null && dateTo.isNotEmpty) params['dateTo'] = dateTo;
      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers/$supplierId/analytics/price-history',
        queryParameters: params,
      );
      return SuppliersSuccess(
          SupplierPriceHistory.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierPaymentAging>> getPaymentAging(
      String supplierId) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers/$supplierId/analytics/payment-aging',
      );
      return SuppliersSuccess(
          SupplierPaymentAging.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierReturnSummary>> getReturnSummary(
      String supplierId, {String? dateFrom, String? dateTo}) async {
    try {
      final params = <String, dynamic>{};
      if (dateFrom != null && dateFrom.isNotEmpty) params['dateFrom'] = dateFrom;
      if (dateTo != null && dateTo.isNotEmpty) params['dateTo'] = dateTo;
      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers/$supplierId/analytics/return-summary',
        queryParameters: params.isNotEmpty ? params : null,
      );
      return SuppliersSuccess(
          SupplierReturnSummary.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  // ── Supplier Products ────────────────────────────────

  Future<SuppliersResult<SupplierProductListResponse>> getSupplierProducts(
      String supplierId, {int page = 1, int limit = 20, String? search, bool? isPreferred}) async {
    try {
      final params = <String, dynamic>{'page': page, 'limit': limit};
      if (search != null && search.isNotEmpty) params['search'] = search;
      if (isPreferred != null) params['isPreferred'] = isPreferred.toString();
      final response = await _api.get<Map<String, dynamic>>(
        '/suppliers/$supplierId/products',
        queryParameters: params,
      );
      return SuppliersSuccess(
          SupplierProductListResponse.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierProduct>> createSupplierProduct(
      String supplierId, CreateSupplierProductRequest request) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/suppliers/$supplierId/products',
        data: request.toJson(),
      );
      return SuppliersSuccess(
          SupplierProduct.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<SupplierProduct>> updateSupplierProduct(
      String supplierId, String spId, Map<String, dynamic> data) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/suppliers/$supplierId/products/$spId',
        data: data,
      );
      return SuppliersSuccess(
          SupplierProduct.fromJson(response.data!));
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }

  Future<SuppliersResult<void>> deleteSupplierProduct(
      String supplierId, String spId) async {
    try {
      await _api.delete<dynamic>(
        '/suppliers/$supplierId/products/$spId',
      );
      return const SuppliersSuccess(null);
    } catch (e) {
      return SuppliersFailure(_errorHandler.handle(e));
    }
  }
}

final suppliersRepositoryProvider = Provider<SuppliersRepository>((ref) {
  final api = ref.read(apiClientProvider);
  return SuppliersRepository(api, ref);
});
