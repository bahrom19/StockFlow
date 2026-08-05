import 'package:flutter/material.dart';

/// Per-method brand metadata (label, color, icon). Shared by the analytics
/// screens, the details table and the dashboard widget.
class PaymentMethodMeta {
  final String code;
  final String label;
  final Color color;
  final IconData icon;
  const PaymentMethodMeta(this.code, this.label, this.color, this.icon);

  static const List<PaymentMethodMeta> all = [
    PaymentMethodMeta('CASH', 'Cash', Color(0xFF0F9D58), Icons.payments_outlined),
    PaymentMethodMeta('CARD', 'Card', Color(0xFF1A73E8), Icons.credit_card),
    PaymentMethodMeta('QR', 'QR', Color(0xFF9334E6), Icons.qr_code_2),
    PaymentMethodMeta(
        'BANK_TRANSFER', 'Bank Transfer', Color(0xFFF9A825), Icons.account_balance),
    PaymentMethodMeta(
        'MOBILE_WALLET', 'Mobile Wallet', Color(0xFF00ACC1), Icons.phone_android),
  ];

  static PaymentMethodMeta byCode(String code) => all.firstWhere(
        (m) => m.code == code,
        orElse: () => const PaymentMethodMeta(
            'OTHER', 'Other', Color(0xFF9AA0A6), Icons.payment),
      );
}

/// Selectable analytics period for the Payment Analytics screen.
enum PaymentPeriod {
  today('Today', Icons.today_outlined),
  week('Week', Icons.date_range_outlined),
  month('Month', Icons.calendar_month_outlined),
  custom('Custom', Icons.calendar_today_outlined);

  final String label;
  final IconData icon;
  const PaymentPeriod(this.label, this.icon);
}

/// Per-method statistics shown on the top cards / comparison chart.
class PaymentMethodStat {
  final String code; // CASH | CARD | QR | BANK_TRANSFER | MOBILE_WALLET
  final String label;
  final double amount;
  final double percent; // % of total revenue (backend-net amounts)
  final int count; // transaction count for this method
  final double averageTicket; // amount / count

  const PaymentMethodStat({
    required this.code,
    required this.label,
    required this.amount,
    required this.percent,
    required this.count,
    required this.averageTicket,
  });
}

/// One day of the daily trend series.
class PaymentDayPoint {
  final DateTime date;
  final Map<String, double> byMethod;

  const PaymentDayPoint({required this.date, required this.byMethod});

  double get dayTotal =>
      byMethod.values.fold(0.0, (sum, v) => sum + v);
}

/// Immutable result of the analytics aggregation.
class PaymentAnalyticsData {
  final PaymentPeriod period;
  final DateTime from;
  final DateTime to;
  final double totalRevenue;
  final int totalTransactions;
  final List<PaymentMethodStat> methods; // sorted by amount desc
  final List<PaymentDayPoint> dailyTrend;

  const PaymentAnalyticsData({
    required this.period,
    required this.from,
    required this.to,
    required this.totalRevenue,
    required this.totalTransactions,
    required this.methods,
    required this.dailyTrend,
  });

  /// Sum of the five per-method buckets — must equal [totalRevenue]
  /// (invariant: Cash + Card + QR + Bank + Wallet == Total Sales).
  double get methodsSum =>
      methods.fold(0.0, (sum, m) => sum + m.amount);

  bool get invariantOk => (methodsSum - totalRevenue).abs() < 0.005;
}
