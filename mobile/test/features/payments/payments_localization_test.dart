import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/payments/domain/payment_models.dart';
import 'package:stockflow/features/payments/presentation/labels.dart';

/// Phase 5B — Payments localization.
///
/// Guard 1 (EN contract): every user-facing Payments string stays
/// byte-for-byte with the pre-localization UI.
/// Guard 2: RU/KK get natural ERP translations — no raw backend enums
/// (CASH/CARD/QR/BANK_TRANSFER/MOBILE_WALLET, PENDING/COMPLETED/...).
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — Payments', () {
    test('analytics header + charts', () {
      expect(en().paymentAnalyticsTitle, 'Payment Analytics');
      expect(en().paymentAnalyticsSubtitle,
          'How customers pay — every method, every day');
      expect(en().paymentDistribution, 'Payment Distribution');
      expect(en().paymentComparison, 'Payment Comparison');
      expect(en().byMetric('Amount'), 'By Amount');
      expect(en().dailyTrendTitle('Today'), 'Daily Trend — Today');
      expect(en().metricAmount, 'Amount');
      expect(en().metricTransactions, 'Transactions');
      expect(en().metricAverageTicket, 'Average Ticket');
      expect(en().txnsAvg('₸5.00', 12), '12 txns · avg ₸5.00');
    });

    test('period + method labels', () {
      expect(en().paymentPeriodToday, 'Today');
      expect(en().paymentPeriodWeek, 'Week');
      expect(en().paymentPeriodMonth, 'Month');
      expect(en().paymentPeriodCustom, 'Custom');
      expect(en().paymentMethodCash, 'Cash');
      expect(en().paymentMethodCard, 'Card');
      expect(en().paymentMethodQr, 'QR');
      expect(en().paymentMethodBankTransfer, 'Bank Transfer');
      expect(en().paymentMethodMobileWallet, 'Mobile Wallet');
      expect(en().paymentMethodBankShort, 'Bank');
      expect(en().paymentMethodWalletShort, 'Wallet');
    });

    test('details table chrome', () {
      expect(en().paymentDetailsTitle, 'Payment Details');
      expect(en().paymentDetailsSubtitle,
          'Every transaction, filterable and exportable');
      expect(en().detailsSearchHint, 'Search by receipt number…');
      expect(en().receipt, 'Receipt');
      expect(en().cashier, 'Cashier');
      expect(en().method, 'Method');
      expect(en().amount, 'Amount');
      expect(en().filteredBy('cash'), 'Filtered by cash');
      expect(en().transactionsCount(1), '1 transaction');
      expect(en().transactionsCount(7), '7 transactions');
      expect(en().noPaymentsFound, 'No payments found');
      expect(en().noPaymentsYetSubtitle,
          'Sales payments will appear here once transactions exist.');
      expect(en().noMethodPaymentsMatch('CASH'),
          'No CASH payments match this search.');
    });

    test('dashboard widget + empty states', () {
      expect(en().todaysPayments, 'Today\u2019s Payments');
      expect(en().paymentDataUnavailable, 'Payment data unavailable');
      expect(en().noPaymentsToday, 'No payments today');
      expect(en().noPaymentsTodaySubtitle,
          'Sales you make today will appear here.');
      expect(en().noPaymentsInPeriod, 'No payments in this period');
      expect(en().noSalesInPeriod, 'No sales in this period');
      expect(en().noDataInPeriod, 'No data in this period');
      expect(en().noPaymentsForPeriod('Today'), 'No payments for Today');
      expect(en().paymentAnalyticsEmptyHint,
          'Complete a sale in the POS to see payment analytics here.');
      expect(en().browsePaymentDetails, 'Browse payment details');
    });

    test('export UI', () {
      expect(en().exportedRowsAsPdf(3), 'Exported 3 rows as PDF');
      expect(en().pdfExportNotSupported,
          'PDF export is not supported here');
      expect(en().pdfExportFailed('boom'), 'PDF export failed: boom');
    });
  });

  group('RU translations — Payments', () {
    test('analytics + charts localize', () {
      expect(ru().paymentAnalyticsTitle, 'Аналитика платежей');
      expect(ru().paymentDistribution, 'Распределение платежей');
      expect(ru().paymentComparison, 'Сравнение способов оплаты');
      expect(ru().metricAmount, 'Сумма');
      expect(ru().metricTransactions, 'Транзакции');
      expect(ru().metricAverageTicket, 'Средний чек');
      expect(ru().dailyTrendTitle('Сегодня'), 'Дневная динамика — Сегодня');
    });

    test('period + method labels localize', () {
      expect(ru().paymentPeriodToday, 'Сегодня');
      expect(ru().paymentPeriodWeek, 'Неделя');
      expect(ru().paymentPeriodMonth, 'Месяц');
      expect(ru().paymentPeriodCustom, 'Произвольный');
      expect(ru().paymentMethodCash, 'Наличные');
      expect(ru().paymentMethodCard, 'Карта');
      expect(ru().paymentMethodQr, 'QR');
      expect(ru().paymentMethodBankTransfer, 'Банковский перевод');
      expect(ru().paymentMethodMobileWallet, 'Мобильный кошелек');
      expect(ru().paymentMethodBankShort, 'Банк');
      expect(ru().paymentMethodWalletShort, 'Кошелек');
    });

    test('details + empty states localize', () {
      expect(ru().paymentDetailsTitle, 'Детали платежей');
      expect(ru().detailsSearchHint, 'Поиск по номеру чека…');
      expect(ru().receipt, 'Чек');
      expect(ru().cashier, 'Кассир');
      expect(ru().method, 'Способ');
      expect(ru().amount, 'Сумма');
      expect(ru().filteredBy('наличные'), 'Фильтр: наличные');
      expect(ru().noPaymentsFound, 'Платежи не найдены');
      expect(ru().noPaymentsToday, 'Сегодня платежей нет');
      expect(ru().todaysPayments, 'Платежи сегодня');
      expect(ru().paymentDataUnavailable, 'Данные о платежах недоступны');
    });
  });

  group('KK translations — Payments', () {
    test('analytics + method labels localize', () {
      expect(kk().paymentAnalyticsTitle, 'Төлем аналитикасы');
      expect(kk().paymentDistribution, 'Төлемдерді бөлу');
      expect(kk().paymentComparison, 'Төлем әдістерін салыстыру');
      expect(kk().metricAmount, 'Сома');
      expect(kk().metricTransactions, 'Транзакциялар');
      expect(kk().metricAverageTicket, 'Орташа чек');
      expect(kk().paymentPeriodToday, 'Бүгін');
      expect(kk().paymentPeriodWeek, 'Апта');
      expect(kk().paymentPeriodMonth, 'Ай');
      expect(kk().paymentMethodCash, 'Қолма-қол');
      expect(kk().paymentMethodCard, 'Карта');
      expect(kk().paymentMethodQr, 'QR');
      expect(kk().paymentMethodBankTransfer, 'Банк аударымы');
      expect(kk().paymentMethodMobileWallet, 'Мобильді әмиян');
      expect(kk().paymentMethodBankShort, 'Банк');
      expect(kk().paymentMethodWalletShort, 'Әмиян');
    });

    test('details + empty states localize', () {
      expect(kk().paymentDetailsTitle, 'Төлем мәліметтері');
      expect(kk().detailsSearchHint, 'Чек нөмірі бойынша іздеу…');
      expect(kk().receipt, 'Чек');
      expect(kk().cashier, 'Кассир');
      expect(kk().method, 'Әдіс');
      expect(kk().amount, 'Сома');
      expect(kk().noPaymentsFound, 'Төлемдер табылмады');
      expect(kk().noPaymentsToday, 'Бүгін төлем жоқ');
      expect(kk().todaysPayments, 'Бүгінгі төлемдер');
    });
  });

  group('UI-layer labels (method / status / period)', () {
    test('unknown method falls back to model label (EN)', () {
      expect(paymentMethodLabel('UNKNOWN_METHOD', en()), 'Other');
      expect(paymentMethodLabel('UNKNOWN_METHOD', ru()), 'Other');
      expect(paymentMethodLabel('UNKNOWN_METHOD', kk()), 'Other');
    });

    test('EN status stays raw byte-for-byte', () {
      expect(paymentStatusLabel('COMPLETED', en()), 'COMPLETED');
      expect(paymentStatusLabel('PARTIALLY_REFUNDED', en()),
          'PARTIALLY REFUNDED');
      expect(paymentStatusLabel('SOME_NEW_STATUS', en()), 'SOME NEW STATUS');
    });

    test('RU/KK statuses localize known values, raw fallback for unknown', () {
      expect(paymentStatusLabel('COMPLETED', ru()), 'Завершённый');
      expect(paymentStatusLabel('REFUNDED', ru()), 'Возвращённый');
      expect(paymentStatusLabel('PENDING', ru()), 'В ожидании');
      expect(paymentStatusLabel('SOME_NEW_STATUS', ru()), 'SOME NEW STATUS');
      expect(paymentStatusLabel('COMPLETED', kk()), 'Аяқталған');
      expect(paymentStatusLabel('SOME_NEW_STATUS', kk()), 'SOME NEW STATUS');
    });

    test('period label helper maps every enum value', () {
      for (final p in PaymentPeriod.values) {
        expect(paymentPeriodLabel(p, en()), isNotEmpty);
        expect(paymentPeriodLabel(p, ru()), isNotEmpty);
        expect(paymentPeriodLabel(p, kk()), isNotEmpty);
      }
    });

    test('no raw backend enums in RU/KK UI labels', () {
      final raw = [
        'CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET',
        'COMPLETED', 'PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED',
      ];
      final ruText = [
        ru().paymentMethodCash, ru().paymentMethodCard,
        ru().paymentMethodBankTransfer, ru().paymentMethodMobileWallet,
        ru().statusCompleted, ru().statusPending, ru().statusRefunded,
        ru().statusPartiallyRefunded,
      ].join(' ');
      final kkText = [
        kk().paymentMethodCash, kk().paymentMethodCard,
        kk().paymentMethodBankTransfer, kk().paymentMethodMobileWallet,
        kk().statusCompleted, kk().statusPending, kk().statusRefunded,
        kk().statusPartiallyRefunded,
      ].join(' ');
      for (final e in raw) {
        expect(ruText.contains(e), isFalse, reason: 'raw $e in RU');
        expect(kkText.contains(e), isFalse, reason: 'raw $e in KK');
      }
    });
  });
}
