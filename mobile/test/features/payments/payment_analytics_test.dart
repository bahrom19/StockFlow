import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/payments/domain/payment_models.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

void main() {
  group('PaymentBreakdown (v1.2)', () {
    test('parses all five per-method buckets from JSON', () {
      final json = {
        'cash': '1000.0000',
        'card': '500.0000',
        'qr': '400.0000',
        'bankTransfer': '300.0000',
        'mobileWallet': '200.0000',
        'other': '0.0000',
      };
      final payments = PaymentBreakdown.fromJson(json);

      expect(payments.cash, '1000.0000');
      expect(payments.card, '500.0000');
      expect(payments.qr, '400.0000');
      expect(payments.bankTransfer, '300.0000');
      expect(payments.mobileWallet, '200.0000');
      expect(payments.total, closeTo(2400, 0.001));
    });

    test('defaults missing buckets to zero (backward compatible)', () {
      final json = {
        'cash': '100.0000',
        'card': '50.0000',
        'qr': '0.0000',
      };
      final payments = PaymentBreakdown.fromJson(json);

      expect(payments.bankTransfer, '0.0000');
      expect(payments.mobileWallet, '0.0000');
      expect(payments.total, closeTo(150, 0.001));
    });

    test('invariant: Cash + Card + QR + Bank + Wallet == total', () {
      final payments = PaymentBreakdown(
        cash: '1000.0000',
        card: '500.0000',
        qr: '400.0000',
        bankTransfer: '300.0000',
        mobileWallet: '200.0000',
      );
      expect(payments.total, closeTo(2400, 0.001));
      expect(payments.percentOf(1000), closeTo(41.67, 0.05));
    });
  });

  group('PaymentMethodType enum', () {
    test('MOBILE_WALLET wire value is correct', () {
      expect(PaymentMethodType.mobileWallet.wire, 'MOBILE_WALLET');
      expect(PaymentMethodType.mobileWallet.label, 'Mobile Wallet');
    });

    test('all five v1.2 methods exist with correct wire values', () {
      expect(PaymentMethodType.cash.wire, 'CASH');
      expect(PaymentMethodType.card.wire, 'CARD');
      expect(PaymentMethodType.qr.wire, 'QR');
      expect(PaymentMethodType.bankTransfer.wire, 'BANK_TRANSFER');
      expect(PaymentMethodType.mobileWallet.wire, 'MOBILE_WALLET');
    });
  });

  group('PaymentAnalyticsData', () {
    test('methodsSum equals totalRevenue when invariant holds', () {
      final data = PaymentAnalyticsData(
        period: PaymentPeriod.today,
        from: DateTime(2026, 8, 5),
        to: DateTime(2026, 8, 5, 23, 59, 59),
        totalRevenue: 2400,
        totalTransactions: 8,
        methods: const [
          PaymentMethodStat(
            code: 'CASH',
            label: 'Cash',
            amount: 1000,
            percent: 41.67,
            count: 3,
            averageTicket: 333.33,
          ),
          PaymentMethodStat(
            code: 'CARD',
            label: 'Card',
            amount: 500,
            percent: 20.83,
            count: 2,
            averageTicket: 250,
          ),
          PaymentMethodStat(
            code: 'QR',
            label: 'QR',
            amount: 400,
            percent: 16.67,
            count: 1,
            averageTicket: 400,
          ),
          PaymentMethodStat(
            code: 'BANK_TRANSFER',
            label: 'Bank Transfer',
            amount: 300,
            percent: 12.5,
            count: 1,
            averageTicket: 300,
          ),
          PaymentMethodStat(
            code: 'MOBILE_WALLET',
            label: 'Mobile Wallet',
            amount: 200,
            percent: 8.33,
            count: 1,
            averageTicket: 200,
          ),
        ],
        dailyTrend: const [],
      );

      expect(data.methodsSum, closeTo(2400, 0.001));
      expect(data.invariantOk, isTrue);
      expect(data.methods.length, 5);
    });

    test('invariant flag false when methods differ from revenue', () {
      final data = PaymentAnalyticsData(
        period: PaymentPeriod.week,
        from: DateTime(2026, 7, 30),
        to: DateTime(2026, 8, 5),
        totalRevenue: 1000,
        totalTransactions: 1,
        methods: const [
          PaymentMethodStat(
            code: 'CASH',
            label: 'Cash',
            amount: 900,
            percent: 90,
            count: 1,
            averageTicket: 900,
          ),
        ],
        dailyTrend: const [],
      );

      expect(data.invariantOk, isFalse);
    });
  });
}
