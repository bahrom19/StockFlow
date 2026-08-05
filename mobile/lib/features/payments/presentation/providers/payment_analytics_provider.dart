import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/payments/data/payments_repository.dart';
import 'package:stockflow/features/payments/domain/payment_models.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

// ──────────────────────────────────
// State
// ──────────────────────────────────
sealed class PaymentAnalyticsState {
  const PaymentAnalyticsState();
}

class PaymentAnalyticsLoading extends PaymentAnalyticsState {
  const PaymentAnalyticsLoading();
}

class PaymentAnalyticsError extends PaymentAnalyticsState {
  final String message;
  const PaymentAnalyticsError(this.message);
}

class PaymentAnalyticsLoaded extends PaymentAnalyticsState {
  final PaymentAnalyticsData data;

  const PaymentAnalyticsLoaded(this.data);
}

// ──────────────────────────────────
// Notifier
// ──────────────────────────────────
class PaymentAnalyticsNotifier extends StateNotifier<PaymentAnalyticsState> {
  final Ref _ref;
  PaymentPeriod _period = PaymentPeriod.month;
  DateTime _customFrom = DateTime.now().subtract(const Duration(days: 30));
  DateTime _customTo = DateTime.now();
  int _generation = 0; // discards stale responses on rapid period switches

  PaymentAnalyticsNotifier(this._ref)
      : super(const PaymentAnalyticsLoading());

  PaymentPeriod get period => _period;
  DateTime get customFrom => _customFrom;
  DateTime get customTo => _customTo;

  Future<void> load({PaymentPeriod? period}) async {
    if (period != null) _period = period;
    state = const PaymentAnalyticsLoading();
    await _fetch();
  }

  Future<void> refresh() => _fetch();

  void setPeriod(PaymentPeriod period) {
    if (period == _period) return;
    _period = period;
    state = const PaymentAnalyticsLoading();
    _fetch();
  }

  void setCustomRange(DateTime from, DateTime to) {
    _period = PaymentPeriod.custom;
    _customFrom = from;
    _customTo = to;
    state = const PaymentAnalyticsLoading();
    _fetch();
  }

  (DateTime, DateTime) _range() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final end = today.add(const Duration(days: 1)).subtract(const Duration(seconds: 1));
    switch (_period) {
      case PaymentPeriod.today:
        return (today, end);
      case PaymentPeriod.week:
        return (today.subtract(const Duration(days: 6)), end);
      case PaymentPeriod.month:
        return (today.subtract(const Duration(days: 29)), end);
      case PaymentPeriod.custom:
        final from = DateTime(_customFrom.year, _customFrom.month, _customFrom.day);
        final to = DateTime(_customTo.year, _customTo.month, _customTo.day)
            .add(const Duration(days: 1))
            .subtract(const Duration(seconds: 1));
        return (from, to);
    }
  }

  Future<void> _fetch() async {
    final gen = ++_generation;
    final (from, to) = _range();
    final repo = _ref.read(paymentsRepositoryProvider);

    // Amounts (report summary) and the daily per-method source (sale list)
    // are fetched in parallel — two requests per load, not seven.
    final results = await Future.wait([
      repo.getSalesReport(from: from, to: to),
      repo.getSalesForTrend(from: from, to: to, maxPages: 25),
    ]);

    // A newer period switch already ran — discard this stale response.
    if (gen != _generation) return;

    final report = results[0];
    if (report is PaymentsFailure<SalesReport>) {
      state = PaymentAnalyticsError(report.error.message);
      return;
    }
    if (report is! PaymentsSuccess<SalesReport>) return;
    final summary = report.data.summary;
    final payments = summary.payments;

    final amounts = <String, double>{
      'CASH': double.tryParse(payments.cash) ?? 0,
      'CARD': double.tryParse(payments.card) ?? 0,
      'QR': double.tryParse(payments.qr) ?? 0,
      'BANK_TRANSFER': double.tryParse(payments.bankTransfer) ?? 0,
      'MOBILE_WALLET': double.tryParse(payments.mobileWallet) ?? 0,
    };
    final revenue = double.tryParse(summary.revenue) ?? 0;

    // Counts + daily trend derived from the SAME sale-list fetch:
    // per-sale CASH is netted by changeAmount (mirrors the v1.2 report fix,
    // floored at zero for card-paid change so the chart never goes negative).
    final counts = <String, int>{
      for (final meta in PaymentMethodMeta.all) meta.code: 0,
    };
    final byDay = <String, Map<String, double>>{};
    final trendResult = results[1];
    if (trendResult is PaymentsSuccess<List<Sale>>) {
      for (final sale in trendResult.data) {
        if (sale.status != 'COMPLETED' &&
            sale.status != 'PARTIALLY_REFUNDED') {
          continue;
        }
        final dayKey = sale.createdAt.toIso8601String().substring(0, 10);
        final day = byDay.putIfAbsent(dayKey, () => {});
        var cashForSale = 0.0;
        for (final p in sale.payments) {
          final amt = double.tryParse(p.amount) ?? 0;
          if (p.method == 'CASH') {
            cashForSale += amt;
          } else {
            day[p.method] = (day[p.method] ?? 0) + amt;
            if (amt > 0) counts[p.method] = (counts[p.method] ?? 0) + 1;
          }
        }
        final change = double.tryParse(sale.changeAmount) ?? 0;
        final netCash = (cashForSale - change).clamp(0.0, double.infinity);
        day['CASH'] = (day['CASH'] ?? 0) + netCash;
        if (cashForSale > 0) counts['CASH'] = (counts['CASH'] ?? 0) + 1;
      }
    }

    final dailyTrend = <PaymentDayPoint>[
      for (final dayKey in (byDay.keys.toList()..sort()))
        PaymentDayPoint(
          date: DateTime.parse(dayKey),
          byMethod: byDay[dayKey]!,
        ),
    ];

    final stats = <PaymentMethodStat>[
      for (final meta in PaymentMethodMeta.all)
        PaymentMethodStat(
          code: meta.code,
          label: meta.label,
          amount: amounts[meta.code] ?? 0,
          percent: revenue <= 0 ? 0 : ((amounts[meta.code] ?? 0) / revenue) * 100,
          count: counts[meta.code] ?? 0,
          averageTicket: (counts[meta.code] ?? 0) > 0
              ? (amounts[meta.code] ?? 0) / (counts[meta.code] ?? 1)
              : 0,
        ),
    ]..sort((a, b) => b.amount.compareTo(a.amount));

    state = PaymentAnalyticsLoaded(PaymentAnalyticsData(
      period: _period,
      from: from,
      to: to,
      totalRevenue: revenue,
      totalTransactions: summary.count,
      methods: stats,
      dailyTrend: dailyTrend,
    ));
  }
}

// ──────────────────────────────────
// Provider
// ──────────────────────────────────
final paymentAnalyticsProvider =
    StateNotifierProvider<PaymentAnalyticsNotifier, PaymentAnalyticsState>(
  (ref) => PaymentAnalyticsNotifier(ref),
);
