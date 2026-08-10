import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsAction;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/onboarding_hero.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';

// ── Minimal notifier fakes (same pattern as action_center_widget_test) ──
class _FakeDashboardNotifier extends DashboardNotifier {
  _FakeDashboardNotifier(super.ref, DashboardUiState initial) {
    state = initial;
  }
}

class _FakeCashShiftNotifier extends CashShiftNotifier {
  _FakeCashShiftNotifier(super.ref, ShiftState initial) {
    state = initial;
  }
}

void main() {
  DashboardSummary summary({
    String inventoryValue = '0',
    int lowStock = 0,
    int outOfStock = 0,
    int customers = 0,
    int orders = 0,
    int todayCount = 0,
  }) {
    return DashboardSummary(
      todaySales: DaySales(revenue: '0', count: todayCount),
      yesterdaySales: const DaySales(revenue: '0', count: 0),
      monthSales: const DaySales(revenue: '0', count: 0),
      ordersCount: orders,
      grossRevenue: '0',
      grossProfit: '0',
      inventoryValue: inventoryValue,
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
      customerCount: customers,
      supplierCount: 0,
      purchaseTotal: '0',
    );
  }

  group('buildOnboardingSteps', () {
    test('brand-new company → 0 of 4 (no invented completion)', () {
      final steps = buildOnboardingSteps(
        summary: summary(),
        shiftState: const ShiftLoaded(),
      );

      expect(steps.length, 4);
      expect(steps.where((s) => s.done), isEmpty);
    });

    test('"Add products" done when stock value exists', () {
      final steps = buildOnboardingSteps(
        summary: summary(inventoryValue: '15000'),
        shiftState: const ShiftLoaded(),
      );

      expect(steps[0].done, isTrue);
      expect(steps[1].done, isFalse);
    });

    test('"Add products" done when low/out-of-stock positions are tracked', () {
      final steps = buildOnboardingSteps(
        summary: summary(lowStock: 3),
        shiftState: const ShiftLoaded(),
      );

      expect(steps[0].done, isTrue);
    });

    test('"Register customers" done when a customer exists', () {
      final steps = buildOnboardingSteps(
        summary: summary(customers: 2),
        shiftState: const ShiftLoaded(),
      );

      expect(steps[1].done, isTrue);
    });

    test('"Open a cash shift" done only when a shift is actually open', () {
      final open = buildOnboardingSteps(
        summary: summary(),
        shiftState: ShiftLoaded(current: _openShift()),
      );
      final closed = buildOnboardingSteps(
        summary: summary(),
        shiftState: const ShiftLoaded(),
      );

      expect(open[2].done, isTrue);
      expect(closed[2].done, isFalse);
    });

    test('"Complete first sale" done when any sale exists', () {
      final byOrders = buildOnboardingSteps(
        summary: summary(orders: 1),
        shiftState: const ShiftLoaded(),
      );
      final byToday = buildOnboardingSteps(
        summary: summary(todayCount: 3),
        shiftState: const ShiftLoaded(),
      );

      expect(byOrders[3].done, isTrue);
      expect(byToday[3].done, isTrue);
    });

    test('mixed state → exactly the real steps are done', () {
      final steps = buildOnboardingSteps(
        summary: summary(inventoryValue: '900', customers: 1),
        shiftState: ShiftLoaded(current: _openShift()),
      );

      expect(steps[0].done, isTrue); // products
      expect(steps[1].done, isTrue); // customers
      expect(steps[2].done, isTrue); // shift
      expect(steps[3].done, isFalse); // no sale yet
    });
  });

  group('OnboardingHero widget', () {
    Future<void> pumpHero(
      WidgetTester tester, {
      required DashboardUiState dashState,
      required ShiftState shiftState,
    }) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            dashboardProvider
                .overrideWith((ref) => _FakeDashboardNotifier(ref, dashState)),
            cashShiftProvider
                .overrideWith((ref) => _FakeCashShiftNotifier(ref, shiftState)),
          ],
          child: const MaterialApp(
            home: Scaffold(body: SingleChildScrollView(child: OnboardingHero())),
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('brand-new company → "0 of 4" and all steps actionable',
        (tester) async {
      await pumpHero(
        tester,
        dashState: DashboardData(summary: summary()),
        shiftState: const ShiftLoaded(),
      );

      expect(find.text('0 of 4'), findsOneWidget);
      expect(find.text('Get started'), findsNWidgets(4));
      expect(find.text('Done'), findsNothing);
      expect(find.text('Completed'), findsNothing);
    });

    testWidgets('partial progress → "2 of 4" with Done states', (tester) async {
      // Products + customers done; no shift, no sale yet → exactly 2 of 4.
      await pumpHero(
        tester,
        dashState: DashboardData(
          summary: summary(inventoryValue: '5000', customers: 1),
        ),
        shiftState: const ShiftLoaded(),
      );

      expect(find.text('2 of 4'), findsOneWidget);
      expect(find.text('Done'), findsNWidgets(2));
      expect(find.text('Get started'), findsNWidgets(2));
    });

    testWidgets('shift open + products → "2 of 4" (sale/customers pending)',
        (tester) async {
      await pumpHero(
        tester,
        dashState: DashboardData(
          summary: summary(inventoryValue: '5000'),
        ),
        shiftState: ShiftLoaded(current: _openShift()),
      );

      expect(find.text('2 of 4'), findsOneWidget);
      expect(find.text('Done'), findsNWidgets(2));
      expect(find.text('Get started'), findsNWidgets(2));
    });

    testWidgets('loading dashboard → skeleton, no false "0 of 4"',
        (tester) async {
      await pumpHero(
        tester,
        dashState: const DashboardLoading(),
        shiftState: const ShiftLoading(),
      );

      expect(find.text('0 of 4'), findsNothing);
      expect(find.text('Welcome to StockFlow'), findsNothing);
      expect(find.byType(LinearProgressIndicator), findsNothing);
    });

    // ── Semantics boundary (2dac3ea pattern, P3) ────────────────
    // The header wraps its title + subtitle Column in a label-less
    // Semantics(container: true) so Flutter Web serializes them as
    // textContent (document.body.innerText) instead of hoisting them into
    // the header Row's group aria-label. Each step CTA stays a separate
    // interactive node.
    testWidgets('header title is its own leaf, step CTA stays tappable',
        (tester) async {
      await pumpHero(
        tester,
        dashState: DashboardData(summary: summary()),
        shiftState: const ShiftLoaded(),
      );

      final handle = tester.ensureSemantics();

      // The header title must carry its own label on a NON-interactive node
      // (not swallowed into a group aria-label by the interactive sections).
      final titleData = tester
          .getSemantics(find.text('Welcome to StockFlow'))
          .getSemanticsData();
      expect(titleData.label, contains('Welcome to StockFlow'));
      expect(titleData.hasAction(SemanticsAction.tap), isFalse);

      // The subtitle is part of the same merged leaf.
      final subData = tester
          .getSemantics(find.textContaining('Set up your store'))
          .getSemanticsData();
      expect(subData.label, contains('Set up your store'));

      // Step CTAs remain separate tappable nodes.
      final ctaData = tester
          .getSemantics(find.text('Get started').first)
          .getSemanticsData();
      expect(ctaData.hasAction(SemanticsAction.tap), isTrue);

      // The progress pill "0 of 4" is its own leaf (no tap action).
      final pillData = tester
          .getSemantics(find.text('0 of 4'))
          .getSemanticsData();
      expect(pillData.label, contains('0 of 4'));
      expect(pillData.hasAction(SemanticsAction.tap), isFalse);

      handle.dispose();
    });
  });
}

CashShift _openShift() {
  return CashShift(
    id: 'shift-1',
    companyId: 'c1',
    warehouseId: 'w1',
    cashierId: 'u1',
    status: 'OPEN',
    openedAt: DateTime.now(),
    expectedClosing: '100.0000',
    totalSales: '100.0000',
  );
}
