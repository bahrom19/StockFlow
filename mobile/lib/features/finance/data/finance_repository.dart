import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/finance/domain/finance_models.dart';

sealed class FinanceResult<T> {
  const FinanceResult();
}

class FinanceSuccess<T> extends FinanceResult<T> {
  final T data;
  const FinanceSuccess(this.data);
}

class FinanceFailure<T> extends FinanceResult<T> {
  final Failure error;
  const FinanceFailure(this.error);
}

/// FinanceRepository — trial balance and ledger queries.
class FinanceRepository {
  final ApiClient _api;
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('FinanceRepo'));

  FinanceRepository(this._api);

  Future<FinanceResult<TrialBalanceResponse>> getTrialBalance({
    String? asOfDate,
    String? accountType,
  }) async {
    try {
      final params = <String, dynamic>{};
      if (asOfDate != null) params['asOfDate'] = asOfDate;
      if (accountType != null) params['accountType'] = accountType;

      final response = await _api.get<Map<String, dynamic>>(
        '/finance/ledger/trial-balance',
        queryParameters: params.isNotEmpty ? params : null,
      );
      return FinanceSuccess(TrialBalanceResponse.fromJson(response.data!));
    } catch (e) {
      return FinanceFailure(_errorHandler.handle(e));
    }
  }
}

final financeRepositoryProvider = Provider<FinanceRepository>((ref) {
  final api = ref.read(apiClientProvider);
  return FinanceRepository(api);
});
