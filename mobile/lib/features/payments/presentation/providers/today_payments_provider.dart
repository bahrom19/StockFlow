import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/payments/data/payments_repository.dart';

// ──────────────────────────────────
// Today's Payments — lightweight provider for the dashboard card.
// One request: GET /reports/sales?dateFrom=today&dateTo=today
// ──────────────────────────────────
sealed class TodayPaymentsState {
  const TodayPaymentsState();
}

class TodayPaymentsLoading extends TodayPaymentsState {
  const TodayPaymentsLoading();
}

class TodayPaymentsError extends TodayPaymentsState {
  const TodayPaymentsError();
}

class TodayPaymentsLoaded extends TodayPaymentsState {
  final PaymentBreakdown payments;
  const TodayPaymentsLoaded(this.payments);
}

final todayPaymentsProvider =
    FutureProvider.autoDispose<TodayPaymentsState>((ref) async {
  final repo = ref.read(paymentsRepositoryProvider);
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final end = today
      .add(const Duration(days: 1))
      .subtract(const Duration(seconds: 1));

  final result = await repo.getSalesReport(from: today, to: end);
  if (result is PaymentsSuccess<SalesReport>) {
    final payments = result.data.summary.payments;
    return TodayPaymentsLoaded(payments);
  }
  return const TodayPaymentsError();
});
