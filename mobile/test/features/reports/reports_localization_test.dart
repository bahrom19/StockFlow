import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

/// Phase 5A — Reports localization.
///
/// Guard 1 (EN contract): every user-facing Reports string must stay
/// byte-for-byte with the pre-localization UI — no E2E spec asserts these
/// today, but the EN display is the product contract.
/// Guard 2: RU/KK get natural ERP translations, not machine stubs.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — Reports screen', () {
    test('header + tooltips', () {
      expect(en().reportsTitle, 'Reports');
      expect(en().reportsSubtitle, 'Business performance at a glance');
      expect(en().exportPdf, 'Export PDF');
      expect(en().refresh, 'Refresh');
    });

    test('export snackbars', () {
      expect(en().reportExportedAsPdf, 'Report exported as PDF');
      expect(en().pdfExportFailed('boom'),
          'PDF export failed: boom');
    });

    test('recent sales table chrome (columns + empty state)', () {
      expect(en().recentSales, 'Recent Sales');
      expect(en().number, 'Number');
      expect(en().date, 'Date');
      expect(en().status, 'Status');
      expect(en().total, 'Total');
      expect(en().paid, 'Paid');
      expect(en().noSalesYet, 'No sales yet');
      expect(en().recentSalesEmptySubtitle,
          'Recent sales will appear here');
    });

    test('KPI card labels', () {
      expect(en().kpiTodayRevenue, 'Today Revenue');
      expect(en().kpiYesterday, 'Yesterday');
      expect(en().kpiMonthRevenue, 'Month Revenue');
      expect(en().kpiGrossProfit, 'Gross Profit');
      expect(en().kpiInventoryValue, 'Inventory Value');
      expect(en().kpiOrders, 'Orders');
    });
  });

  group('RU translations', () {
    test('header + table chrome localize', () {
      expect(ru().reportsTitle, 'Отчёты');
      expect(ru().reportsSubtitle, 'Бизнес-показатели с первого взгляда');
      expect(ru().exportPdf, 'Экспорт PDF');
      expect(ru().reportExportedAsPdf, 'Отчет экспортирован в PDF');
      expect(ru().pdfExportFailed('ошибка'),
          'Ошибка экспорта PDF: ошибка');
      expect(ru().recentSales, 'Последние продажи');
      expect(ru().number, 'Номер');
      expect(ru().total, 'Итого');
      expect(ru().paid, 'Оплачено');
      expect(ru().noSalesYet, 'Продаж пока нет');
      expect(ru().recentSalesEmptySubtitle, 'Последние продажи появятся здесь');
    });

    test('KPI card labels localize', () {
      expect(ru().kpiTodayRevenue, 'Выручка сегодня');
      expect(ru().kpiYesterday, 'Вчера');
      expect(ru().kpiMonthRevenue, 'Выручка за месяц');
      expect(ru().kpiGrossProfit, 'Валовая прибыль');
      expect(ru().kpiInventoryValue, 'Стоимость запасов');
      expect(ru().kpiOrders, 'Заказы');
    });
  });

  group('KK translations', () {
    test('header + table chrome localize', () {
      expect(kk().reportsTitle, 'Есептер');
      expect(kk().reportsSubtitle, 'Бизнес көрсеткіштері бір қарағанда');
      expect(kk().exportPdf, 'PDF экспорты');
      expect(kk().reportExportedAsPdf, 'Есеп PDF-ке экспортталды');
      expect(kk().pdfExportFailed('қате'),
          'PDF экспорты қатесі: қате');
      expect(kk().recentSales, 'Соңғы сатылымдар');
      expect(kk().number, 'Нөмір');
      expect(kk().total, 'Барлығы');
      expect(kk().paid, 'Төленді');
      expect(kk().noSalesYet, 'Әзірге сатылым жоқ');
      expect(kk().recentSalesEmptySubtitle,
          'Соңғы сатылымдар осында пайда болады');
    });

    test('KPI card labels localize', () {
      expect(kk().kpiTodayRevenue, 'Бүгінгі табыс');
      expect(kk().kpiYesterday, 'Кеше');
      expect(kk().kpiMonthRevenue, 'Айлық табыс');
      expect(kk().kpiGrossProfit, 'Жалпы пайда');
      expect(kk().kpiInventoryValue, 'Қор құны');
      expect(kk().kpiOrders, 'Тапсырыстар');
    });
  });
}
