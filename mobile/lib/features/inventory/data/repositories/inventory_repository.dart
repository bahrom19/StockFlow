import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';

sealed class InvResult<T> {
  const InvResult();
}

class InvSuccess<T> extends InvResult<T> {
  final T data;
  const InvSuccess(this.data);
}

class InvFailure<T> extends InvResult<T> {
  final Failure error;
  const InvFailure(this.error);
}

/// InventoryRepository — real API calls against /inventory/ endpoints.
class InventoryRepository {
  final Ref _ref;
  final AppLogger _logger = AppLogger('InvRepo');
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('ErrHandler'));

  InventoryRepository(this._ref);

  // ── Stock ────────────────────────────────────────

  Future<InvResult<StockListResponse>> getStock({
    int page = 1,
    int limit = 50,
    String? search,
    String? warehouseId,
    String? category,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final params = <String, dynamic>{
        'page': page.toString(),
        'limit': limit.toString(),
      };
      if (search != null && search.isNotEmpty) params['search'] = search;
      if (warehouseId != null) params['warehouseId'] = warehouseId;
      if (category != null) params['category'] = category;

      final response = await client.get(
        '${ApiEndpoints.inventory}/stock',
        queryParameters: params,
      );
      final data = response.data as Map<String, dynamic>;
      return InvSuccess(StockListResponse.fromJson(data));
    } catch (e) {
      _logger.error('Stock list failed', e);
      return InvFailure(_errorHandler.handle(e));
    }
  }

  Future<InvResult<List<StockItem>>> getStockByProduct(
    String productId,
  ) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        '${ApiEndpoints.inventory}/stock/$productId',
      );
      final data = response.data as List<dynamic>;
      final items = data.map((e) => StockItem.fromJson(e as Map<String, dynamic>)).toList();
      return InvSuccess(items);
    } catch (e) {
      _logger.error('Product stock failed', e);
      return InvFailure(_errorHandler.handle(e));
    }
  }

  // ── Movements ────────────────────────────────────

  Future<InvResult<List<StockMovement>>> getMovements({
    String? productId,
    String? warehouseId,
    int limit = 50,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final params = <String, dynamic>{};
      if (productId != null) params['productId'] = productId;
      if (warehouseId != null) params['warehouseId'] = warehouseId;
      if (limit != 50) params['limit'] = limit.toString();

      final response = await client.get(
        '${ApiEndpoints.inventory}/stock/movements',
        queryParameters: params.isNotEmpty ? params : null,
      );
      final data = response.data as List<dynamic>;
      final items = data.map((e) => StockMovement.fromJson(e as Map<String, dynamic>)).toList();
      return InvSuccess(items);
    } catch (e) {
      _logger.error('Movements failed', e);
      return InvFailure(_errorHandler.handle(e));
    }
  }

  // ── Adjustment ──────────────────────────────────

  Future<InvResult<StockMovement>> adjustStock(AdjustStockDto dto) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.post(
        '${ApiEndpoints.inventory}/stock/adjust',
        data: dto.toJson(),
      );
      final data = response.data as Map<String, dynamic>;
      return InvSuccess(StockMovement.fromJson(data));
    } catch (e) {
      _logger.error('Adjustment failed', e);
      return InvFailure(_errorHandler.handle(e));
    }
  }

  // ── Transfer ────────────────────────────────────

  Future<InvResult<List<StockMovement>>> transferStock(
    TransferStockDto dto,
  ) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.post(
        '${ApiEndpoints.inventory}/stock/transfer',
        data: dto.toJson(),
      );
      final data = response.data as List<dynamic>;
      final items = data.map((e) => StockMovement.fromJson(e as Map<String, dynamic>)).toList();
      return InvSuccess(items);
    } catch (e) {
      _logger.error('Transfer failed', e);
      return InvFailure(_errorHandler.handle(e));
    }
  }

  // ── Warehouses ──────────────────────────────────

  Future<InvResult<List<Warehouse>>> getWarehouses() async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get('${ApiEndpoints.inventory}/warehouses');
      final data = response.data as List<dynamic>;
      final items = data.map((e) => Warehouse.fromJson(e as Map<String, dynamic>)).toList();
      return InvSuccess(items);
    } catch (e) {
      _logger.error('Warehouses failed', e);
      return InvFailure(_errorHandler.handle(e));
    }
  }
}

final inventoryRepositoryProvider = Provider<InventoryRepository>((ref) {
  return InventoryRepository(ref);
});
