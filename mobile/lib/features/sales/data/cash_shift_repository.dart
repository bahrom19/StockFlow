import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';

sealed class ShiftResult<T> {
  const ShiftResult();
}

class ShiftSuccess<T> extends ShiftResult<T> {
  final T data;
  const ShiftSuccess(this.data);
}

class ShiftFailure<T> extends ShiftResult<T> {
  final Failure error;
  const ShiftFailure(this.error);
}

/// CashShiftRepository — real API calls against /sales/cash-shifts endpoints.
class CashShiftRepository {
  final Ref _ref;
  final AppLogger _logger = AppLogger('ShiftRepo');
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('ErrHandler'));

  CashShiftRepository(this._ref);

  Future<ShiftResult<CashShift>> openShift(OpenShiftRequest request) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.post<Map<String, dynamic>>(
        ApiEndpoints.cashShiftOpen,
        data: request.toJson(),
      );
      return ShiftSuccess(CashShift.fromJson(response.data!));
    } catch (e) {
      _logger.error('Open shift failed', e);
      return ShiftFailure(_errorHandler.handle(e));
    }
  }

  Future<ShiftResult<CashShift>> closeShift({
    required String warehouseId,
    required CloseShiftRequest request,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.post<Map<String, dynamic>>(
        ApiEndpoints.cashShiftClose,
        queryParameters: {'warehouseId': warehouseId},
        data: request.toJson(),
      );
      return ShiftSuccess(CashShift.fromJson(response.data!));
    } catch (e) {
      _logger.error('Close shift failed', e);
      return ShiftFailure(_errorHandler.handle(e));
    }
  }

  Future<ShiftResult<CashShift>> cashIn({
    required String warehouseId,
    required CashInOutRequest request,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.post<Map<String, dynamic>>(
        ApiEndpoints.cashShiftCashIn,
        queryParameters: {'warehouseId': warehouseId},
        data: request.toJson(),
      );
      return ShiftSuccess(CashShift.fromJson(response.data!));
    } catch (e) {
      _logger.error('Cash in failed', e);
      return ShiftFailure(_errorHandler.handle(e));
    }
  }

  Future<ShiftResult<CashShift>> cashOut({
    required String warehouseId,
    required CashInOutRequest request,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.post<Map<String, dynamic>>(
        ApiEndpoints.cashShiftCashOut,
        queryParameters: {'warehouseId': warehouseId},
        data: request.toJson(),
      );
      return ShiftSuccess(CashShift.fromJson(response.data!));
    } catch (e) {
      _logger.error('Cash out failed', e);
      return ShiftFailure(_errorHandler.handle(e));
    }
  }

  Future<ShiftResult<CashShift>> getXReport({required String warehouseId}) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get<Map<String, dynamic>>(
        ApiEndpoints.cashShiftXReport,
        queryParameters: {'warehouseId': warehouseId},
      );
      return ShiftSuccess(CashShift.fromJson(response.data!));
    } catch (e) {
      _logger.error('X report failed', e);
      return ShiftFailure(_errorHandler.handle(e));
    }
  }

  Future<ShiftResult<CashShift>> getZReport(String id) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response =
          await client.get<Map<String, dynamic>>('${ApiEndpoints.cashShifts}/z-report/$id');
      return ShiftSuccess(CashShift.fromJson(response.data!));
    } catch (e) {
      _logger.error('Z report failed', e);
      return ShiftFailure(_errorHandler.handle(e));
    }
  }

  Future<ShiftResult<CashShiftListResponse>> listShifts({
    String? warehouseId,
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final params = <String, dynamic>{
        'page': page.toString(),
        'limit': limit.toString(),
      };
      if (warehouseId != null) params['warehouseId'] = warehouseId;
      if (status != null) params['status'] = status;
      final response = await client.get<Map<String, dynamic>>(
        ApiEndpoints.cashShifts,
        queryParameters: params,
      );
      return ShiftSuccess(CashShiftListResponse.fromJson(response.data!));
    } catch (e) {
      _logger.error('List shifts failed', e);
      return ShiftFailure(_errorHandler.handle(e));
    }
  }
}

final cashShiftRepositoryProvider = Provider<CashShiftRepository>((ref) {
  return CashShiftRepository(ref);
});
