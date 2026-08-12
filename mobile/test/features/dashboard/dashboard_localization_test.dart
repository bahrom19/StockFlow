import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/recent_sales_list.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/revenue_goal_card.dart';

/// Phase 2 — Dashboard localization.
///
/// Guard 1 (browser/E2E contract): the five KPI labels and the goal summary
/// format must stay byte-for-byte in EN — auth.spec.ts asserts them through
/// document.body.innerText.
/// Guard 2: RU/KK get real plurals for count-bearing strings, not machine
/// stubs.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN E2E/semantics contract — byte-for-byte', () {
    test('five KPI strip labels unchanged', () {
      expect(en().todaysRevenue, "Today's Revenue");
      expect(en().kpiTodaySales, "Today's Sales");
      expect(en().kpiGrossProfit, 'Gross Profit');
      expect(en().kpiInventoryValue, 'Inventory Value');
      expect(en().customers, 'Customers');
    });

    test(r'monthly goal summary keeps the "of $2.0M" fragment', () {
      final text = en().revenueGoalProgress(r'$1.2M', r'$2.0M');
      expect(text, contains('of \$2.0M'));
    });

    test('goal dialog strings match the E2E-driven labels', () {
      expect(en().revenueGoalAmount, 'Goal amount');
      expect(en().setMonthlyGoal, 'Set monthly goal');
      expect(en().save, 'Save');
      expect(en().cancel, 'Cancel');
    });

    test('onboarding progress + hero strings match the browser contract', () {
      expect(en().progressOf(0, 4), '0 of 4');
      expect(en().welcomeToStockFlow, 'Welcome to StockFlow');
      expect(en().noOpenShift, 'No open shift');
      expect(en().cashDrawerUnavailable, 'Cash drawer unavailable');
    });
  });

  group('Plurals', () {
    test('EN low-stock title: singular vs plural', () {
      expect(en().eventLowStockTitle(1), '1 product low on stock');
      expect(en().eventLowStockTitle(3), '3 products low on stock');
    });

    test('EN pending-PO title: singular vs plural', () {
      expect(en().eventPendingPoTitle(1), '1 purchase order awaiting action');
      expect(en().eventPendingPoTitle(2), '2 purchase orders awaiting action');
    });

    test('RU low-stock title: one/few/many', () {
      expect(ru().eventLowStockTitle(1), '1 товар заканчивается');
      expect(ru().eventLowStockTitle(3), '3 товара заканчиваются');
      expect(ru().eventLowStockTitle(5), '5 товаров заканчиваются');
    });

    test('KK low-stock title: one/other', () {
      expect(kk().eventLowStockTitle(1), '1 тауар таусылып жатыр');
      expect(kk().eventLowStockTitle(4), '4 тауар таусылып жатыр');
    });
  });

  group('Localized strings', () {
    test('greeting + snapshot subtitle localize', () {
      expect(en().greetingHello('Alice'), 'Hello, Alice');
      expect(ru().greetingHello('Алиса'), 'Здравствуйте, Алиса');
      expect(en().greetingSubtitle('Wednesday, Aug 12'),
          'Wednesday, Aug 12 · Business snapshot');
      expect(ru().greetingSubtitle('Среда, 12 авг'),
          'Среда, 12 авг · Сводка по бизнесу');
    });

    test('moreNote + progress + all-clear localize', () {
      expect(en().moreNote(1), '+1 more');
      expect(ru().moreNote(1), 'ещё 1');
      expect(en().everythingLooksGood, 'Everything looks good');
      expect(ru().everythingLooksGood, 'Всё в порядке');
    });

    test('KPI card subtitles and cash drawer labels localize', () {
      expect(en().kpiYesterdayCount(10), '10 yesterday');
      expect(ru().kpiYesterdayCount(10), 'вчера 10');
      expect(en().cashInDrawer, 'Cash in drawer');
      expect(ru().cashInDrawer, 'Наличные в кассе');
    });

    test('action-center category badges localize (rendered uppercase)', () {
      expect(en().categoryCritical, 'Critical');
      expect(en().categoryAttention, 'Attention');
      expect(en().categoryOpportunity, 'Opportunity');
      expect(ru().categoryCritical, 'Критично');
      expect(ru().categoryAttention, 'Внимание');
      expect(ru().categoryOpportunity, 'Возможность');
      expect(kk().categoryCritical, 'Критикалды');
      expect(kk().categoryAttention, 'Назар аудару');
      expect(kk().categoryOpportunity, 'Мүмкіндік');
    });

    test('sale status chips localize, incl. PARTIALLY_REFUNDED', () {
      expect(en().statusPartiallyRefunded, 'Partially refunded');
      expect(ru().statusPartiallyRefunded, 'Частично возвращён');
      expect(kk().statusPartiallyRefunded, 'Жартылай қайтарылған');
    });

    test('RU/KK pending-PO reason/action use localized status words, no raw enums',
        () {
      final reason = ru().eventPendingPoReason;
      expect(reason, contains('В ожидании'));
      expect(reason, contains('Заказано'));
      expect(reason, isNot(contains('PENDING')));
      expect(reason, isNot(contains('ORDERED')));
      final action = ru().eventPendingPoAction;
      expect(action, contains('ожидающие заказы'));
      expect(action, isNot(contains('PENDING')));
      final kkReason = kk().eventPendingPoReason;
      expect(kkReason, contains('Күтуде'));
      expect(kkReason, isNot(contains('PENDING')));
      expect(kkReason, isNot(contains('ORDERED')));
    });
  });

  group('RecentSalesList status chip renders localized status', () {
    RecentSale sale(String status) => RecentSale(
          id: 's1',
          saleNumber: 'SALE-001',
          createdAt: '2026-08-12T10:00:00Z',
          status: status,
          total: '1000.0000',
          paidAmount: '1000.0000',
        );

    Future<void> pump(WidgetTester tester, Locale locale, String status) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: RecentSalesList(sales: [sale(status)]),
            ),
          ),
        ),
      );
    }

    testWidgets('EN: PARTIALLY_REFUNDED renders "Partially refunded"',
        (tester) async {
      await pump(tester, const Locale('en'), 'PARTIALLY_REFUNDED');
      expect(find.text('Partially refunded'), findsOneWidget);
    });

    testWidgets('RU: PARTIALLY_REFUNDED renders «Частично возвращён»',
        (tester) async {
      await pump(tester, const Locale('ru'), 'PARTIALLY_REFUNDED');
      expect(find.text('Частично возвращён'), findsOneWidget);
    });
  });

  group('RevenueGoalCard widget renders EN and RU', () {
    DashboardSummary summary() => const DashboardSummary(
          todaySales: DaySales(revenue: '469000.0000', count: 12),
          yesterdaySales: DaySales(revenue: '400000.0000', count: 10),
          monthSales: DaySales(revenue: '1240000.0000', count: 128),
          ordersCount: 220,
          grossRevenue: '469000.0000',
          grossProfit: '140000.0000',
          inventoryValue: '1200000.0000',
          lowStockProducts: 0,
          outOfStockProducts: 0,
          customerCount: 45,
          supplierCount: 8,
          purchaseTotal: '0.0000',
        );

    Future<void> pump(WidgetTester tester, Locale locale) async {
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(body: RevenueGoalCard(summary: summary())),
          ),
        ),
      );
      await tester.pump(); // let the goal load() microtask finish
    }

    testWidgets('EN: Today\'s Revenue + Set monthly goal', (tester) async {
      await pump(tester, const Locale('en'));
      expect(find.text("Today's Revenue"), findsOneWidget);
      expect(find.text('Set monthly goal'), findsOneWidget);
    });

    testWidgets('RU: Выручка сегодня + Задать цель месяца', (tester) async {
      await pump(tester, const Locale('ru'));
      expect(find.text('Выручка сегодня'), findsOneWidget);
      expect(find.text('Задать цель месяца'), findsOneWidget);
    });
  });
}
