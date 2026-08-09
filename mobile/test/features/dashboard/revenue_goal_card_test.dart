import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/monthly_goal_provider.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/revenue_goal_card.dart';

// ─────────────────────────────────────────────────────────────
// Stage E — Revenue + Monthly Goal.
//
// Pure helpers (progress/clamp/percent) + widget behaviour:
//  - goal unset → no bar, "Set monthly goal" prompt + edit button
//  - goal set   → LinearProgressIndicator + "X of Y" + Z%
//  - overachievement → fill clamped to 1.0, "Goal reached"
//  - trend: yesterday<=0 → "—" (no invented percentage)
//  - dialog: validation (>0), save persists to SharedPreferences
//  - provider: goal survives a "restart" (fresh container re-loads)
// ─────────────────────────────────────────────────────────────

DashboardSummary _summary({
  String todayRevenue = '469000.0000',
  int todayCount = 12,
  String yesterdayRevenue = '400000.0000',
  int yesterdayCount = 10,
  String monthRevenue = '1240000.0000',
  int monthCount = 128,
}) {
  return DashboardSummary(
    todaySales: DaySales(revenue: todayRevenue, count: todayCount),
    yesterdaySales:
        DaySales(revenue: yesterdayRevenue, count: yesterdayCount),
    monthSales: DaySales(revenue: monthRevenue, count: monthCount),
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
}

Widget _wrap(DashboardSummary summary) {
  return ProviderScope(
    child: MaterialApp(
      home: Scaffold(body: RevenueGoalCard(summary: summary)),
    ),
  );
}

/// Pre-seeds the local goal so the notifier's load() finds it.
Future<void> _seedGoal(double? goal) async {
  SharedPreferences.setMockInitialValues(
    goal != null && goal > 0 ? {MonthlyGoalNotifier.storageKey: goal} : {},
  );
}

void main() {
  group('monthlyGoal helpers (pure)', () {
    test('progress is null when no valid goal', () {
      // Omitted goal (default null) exercises the no-goal path.
      expect(monthlyGoalProgress(monthRevenue: 100), isNull);
      expect(monthlyGoalProgress(monthRevenue: 100, goal: 0), isNull);
      expect(monthlyGoalProgress(monthRevenue: 100, goal: -5), isNull);
    });

    test('progress is the raw ratio (may exceed 1)', () {
      expect(
        monthlyGoalProgress(monthRevenue: 1240000, goal: 2000000),
        closeTo(0.62, 0.0001),
      );
      expect(
        monthlyGoalProgress(monthRevenue: 2500000, goal: 2000000),
        closeTo(1.25, 0.0001),
      );
    });

    test('fill is clamped to 0..1', () {
      expect(monthlyGoalFill(monthRevenue: 2500000, goal: 2000000), 1.0);
      expect(
        monthlyGoalFill(monthRevenue: 1240000, goal: 2000000),
        closeTo(0.62, 0.0001),
      );
      expect(
        monthlyGoalFill(monthRevenue: 100, goal: 2000000),
        closeTo(0.00005, 1e-6),
      );
      // Omitted goal (default null) exercises the no-goal path.
      expect(monthlyGoalFill(monthRevenue: 100), 0.0);
    });

    test('percent rounds and may exceed 100', () {
      expect(monthlyGoalPercent(monthRevenue: 1240000, goal: 2000000), '62%');
      expect(monthlyGoalPercent(monthRevenue: 2500000, goal: 2000000), '125%');
      expect(monthlyGoalPercent(monthRevenue: 100, goal: 2000000), '0%');
      expect(monthlyGoalPercent(monthRevenue: 100), '');
    });
  });

  group('MonthlyGoalNotifier', () {
    test('setGoal persists; a fresh container re-loads it (restart)', () async {
      SharedPreferences.setMockInitialValues({});
      final c1 = ProviderContainer();
      addTearDown(c1.dispose);
      final notifier = c1.read(monthlyGoalProvider.notifier);
      await notifier.setGoal(2000000);
      expect(c1.read(monthlyGoalProvider), 2000000.0);

      // Fresh container = "app restart" → load() reads the persisted value.
      final c2 = ProviderContainer();
      addTearDown(c2.dispose);
      await c2.read(monthlyGoalProvider.notifier).load();
      expect(c2.read(monthlyGoalProvider), 2000000.0);
    });

    test('setGoal normalizes decimals and clears on null/<=0', () async {
      SharedPreferences.setMockInitialValues({});
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(monthlyGoalProvider.notifier);

      await notifier.setGoal(2500.5);
      expect(container.read(monthlyGoalProvider), 2500.5);

      await notifier.setGoal(null);
      expect(container.read(monthlyGoalProvider), isNull);

      await notifier.setGoal(-5);
      expect(container.read(monthlyGoalProvider), isNull);
    });
  });

  group('RevenueGoalCard widget', () {
    testWidgets('goal unset → no progress bar, prompt + edit button',
        (tester) async {
      await _seedGoal(null);
      await tester.pumpWidget(_wrap(_summary()));
      await tester.pump(); // let load() microtask finish

      expect(find.text("Today's Revenue"), findsOneWidget);
      expect(find.text('\$469,000.00'), findsOneWidget);
      expect(find.text('Set monthly goal'), findsOneWidget);
      expect(find.byKey(const Key('monthly_goal_edit')), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);
    });

    testWidgets('goal set → progress bar + X of Y · Z%', (tester) async {
      await _seedGoal(2000000);
      await tester.pumpWidget(_wrap(_summary()));
      await tester.pump();

      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(find.text('62%'), findsOneWidget);
      // monthSales 1 240 000 → $1.2M of $2.0M · 128 sales
      expect(find.textContaining('of \$2.0M'), findsOneWidget);
      expect(find.textContaining('128 sales'), findsOneWidget);
      expect(find.text('Set monthly goal'), findsNothing);
    });

    testWidgets('overachievement → fill clamped, "Goal reached"',
        (tester) async {
      await _seedGoal(1000000);
      await tester.pumpWidget(
        _wrap(_summary(monthRevenue: '2500000.0000')),
      );
      await tester.pump();

      final indicator = tester.widget<LinearProgressIndicator>(
        find.byType(LinearProgressIndicator),
      );
      expect(indicator.value, 1.0);
      expect(find.text('Goal reached'), findsOneWidget);
    });

    testWidgets('trend: yesterday<=0 → neutral dash, no percentage',
        (tester) async {
      await _seedGoal(null);
      await tester.pumpWidget(
        _wrap(_summary(yesterdayRevenue: '0.0000', yesterdayCount: 0)),
      );
      await tester.pump();

      expect(find.text('—'), findsOneWidget);
      expect(find.textContaining('vs yesterday'), findsNothing);
    });

    testWidgets('trend: positive delta → percentage chip', (tester) async {
      await _seedGoal(null);
      await tester.pumpWidget(_wrap(_summary()));
      await tester.pump();

      // (469000 - 400000) / 400000 = +17.25%
      expect(find.text('17.3%'), findsOneWidget);
    });

    testWidgets('dialog: invalid goal shows error, valid saves and shows bar',
        (tester) async {
      await _seedGoal(null);
      await tester.pumpWidget(_wrap(_summary()));
      await tester.pump();

      // Open the goal dialog.
      await tester.tap(find.byKey(const Key('monthly_goal_edit')));
      await tester.pumpAndSettle();
      expect(find.text('Monthly Goal'), findsOneWidget);

      // Invalid: zero → validation error.
      await tester.enterText(
        find.byKey(const Key('monthly_goal_field')),
        '0',
      );
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(find.text('Enter an amount greater than zero'), findsOneWidget);
      expect(find.text('Monthly Goal'), findsOneWidget); // dialog stays open

      // Valid: 2 000 000 → saved, dialog closed, bar rendered.
      await tester.enterText(
        find.byKey(const Key('monthly_goal_field')),
        '2000000',
      );
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      expect(find.text('Monthly Goal'), findsNothing);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getDouble(MonthlyGoalNotifier.storageKey), 2000000.0);
    });

    testWidgets('dialog: cancel keeps the goal unchanged', (tester) async {
      await _seedGoal(null);
      await tester.pumpWidget(_wrap(_summary()));
      await tester.pump();

      await tester.tap(find.byKey(const Key('monthly_goal_edit')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(find.text('Monthly Goal'), findsNothing);
      expect(find.byType(LinearProgressIndicator), findsNothing);
      expect(find.text('Set monthly goal'), findsOneWidget);
    });

    testWidgets('dialog prefills the current goal when already set',
        (tester) async {
      await _seedGoal(2000000);
      await tester.pumpWidget(_wrap(_summary()));
      await tester.pump();

      await tester.tap(find.byKey(const Key('monthly_goal_edit')));
      await tester.pumpAndSettle();

      // The field opens pre-filled with the stored goal (normalized, no
      // decimals) — editing it later does not require retyping from scratch.
      final field = tester.widget<TextField>(
        find.byKey(const Key('monthly_goal_field')),
      );
      expect(field.controller!.text, '2000000');
    });
  });
}
