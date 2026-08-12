import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/action_center.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

// ─────────────────────────────────────────────────────────────
// Stage D — widget-level release validation of the Action
// Center list behavior:
//  - default visibility limit (3) + "Show all (N)" toggle;
//  - expanded cap (6) + "+N more" note;
//  - CTA buttons navigate to the existing screens via GoRouter;
//  - All Clear shows no CTA buttons.
// ─────────────────────────────────────────────────────────────

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

class _FakeWarehouseNotifier extends WarehouseListNotifier {
  _FakeWarehouseNotifier(super.ref, WarehouseListState initial) {
    state = initial;
  }
}

/// Stub screen that records the route it was pushed onto (to verify CTA
/// navigation without booting the real feature screens).
class _StubScreen extends StatelessWidget {
  final String label;
  const _StubScreen(this.label);

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: Center(child: Text('stub:$label')));
  }
}

GoRouter _router() {
  final stubRoutes = [
    RouteNames.saleNew,
    RouteNames.products,
    RouteNames.purchasing,
    RouteNames.inventory,
    RouteNames.reports,
    RouteNames.warehouses,
  ];
  return GoRouter(
    initialLocation: RouteNames.dashboard,
    routes: [
      GoRoute(
        path: RouteNames.dashboard,
        builder: (_, __) => const Scaffold(
          body: SingleChildScrollView(child: ActionCenter()),
        ),
      ),
      for (final path in stubRoutes)
        GoRoute(path: path, builder: (_, __) => _StubScreen(path)),
    ],
  );
}

void main() {
  DashboardSummary summary({
    String todayRevenue = '3000.0000',
    int todayCount = 0,
    String yesterdayRevenue = '6000.0000',
    int yesterdayCount = 9,
    int lowStock = 3,
    int outOfStock = 3,
  }) {
    return DashboardSummary(
      todaySales: DaySales(revenue: todayRevenue, count: todayCount),
      yesterdaySales: DaySales(revenue: yesterdayRevenue, count: yesterdayCount),
      monthSales: const DaySales(revenue: '90000.0000', count: 220),
      ordersCount: 220,
      grossRevenue: todayRevenue,
      grossProfit: '900.0000',
      inventoryValue: '120000.0000',
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
      customerCount: 45,
      supplierCount: 8,
      purchaseTotal: '0.0000',
    );
  }

  CashShift openShift({
    String difference = '-1250.0000',
    Duration openedFor = const Duration(hours: 2),
  }) {
    return CashShift(
      id: 'shift-1',
      companyId: 'c1',
      warehouseId: 'w1',
      cashierId: 'u1',
      status: 'OPEN',
      openedAt: DateTime.now().subtract(openedFor),
      expectedClosing: '5000.0000',
      totalSales: '5000.0000',
      difference: difference,
    );
  }

  /// Busy dashboard: drawer difference (C) + out of stock (C) + low stock (A)
  /// + revenue drop (A) + no sales yet (A) + pending PO (A) = 6 urgent.
  DashboardData busyData({int pendingPoCount = 2}) {
    return DashboardData(
      summary: summary(),
      purchasingSummary: PurchasingSummary(
        totalOrders: pendingPoCount,
        totalValue: '0',
        byStatus: {'PENDING': pendingPoCount},
      ),
    );
  }

  Future<void> pumpPlain(
    WidgetTester tester,
    DashboardUiState dashState, {
    ShiftState? shiftState,
    WarehouseListState? warehouseState,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dashboardProvider
              .overrideWith((ref) => _FakeDashboardNotifier(ref, dashState)),
          cashShiftProvider.overrideWith(
            (ref) => _FakeCashShiftNotifier(
              ref,
              shiftState ?? const ShiftLoaded(),
            ),
          ),
          warehouseListProvider.overrideWith(
            (ref) => _FakeWarehouseNotifier(
              ref,
              warehouseState ?? const WarehouseListLoaded(warehouses: []),
            ),
          ),
        ],
        child: MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(
            body: SingleChildScrollView(child: ActionCenter()),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  Future<void> pumpWithRouter(
    WidgetTester tester,
    DashboardUiState dashState, {
    ShiftState? shiftState,
    WarehouseListState? warehouseState,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dashboardProvider
              .overrideWith((ref) => _FakeDashboardNotifier(ref, dashState)),
          cashShiftProvider.overrideWith(
            (ref) => _FakeCashShiftNotifier(
              ref,
              shiftState ?? const ShiftLoaded(),
            ),
          ),
          warehouseListProvider.overrideWith(
            (ref) => _FakeWarehouseNotifier(
              ref,
              warehouseState ?? const WarehouseListLoaded(warehouses: []),
            ),
          ),
        ],
        child: MaterialApp.router(
          routerConfig: _router(),
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
        ),
      ),
    );
    await tester.pump();
  }

  group('Show all / limits', () {
    testWidgets('default shows 3 urgent rows + "Show all (3)" toggle',
        (tester) async {
      await pumpPlain(
        tester,
        busyData(),
        shiftState: ShiftLoaded(current: openShift()),
      );

      // 6 urgent events: only 3 rows visible by default.
      expect(find.text('Requires Attention'), findsOneWidget);
      expect(find.textContaining('Show all (3)'), findsOneWidget);
      expect(find.text('Everything looks good'), findsNothing);

      // The "Last checked" ticker is running — unmount to dispose it.
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('Show all expands to the 6-event cap', (tester) async {
      await pumpPlain(
        tester,
        busyData(),
        shiftState: ShiftLoaded(current: openShift()),
      );

      await tester.tap(find.textContaining('Show all (3)'));
      await tester.pump();

      // All 6 urgent events now visible.
      expect(find.textContaining('Show all'), findsNothing);
      expect(find.textContaining('Drawer difference'), findsOneWidget);
      expect(find.textContaining('out of stock'), findsOneWidget);
      expect(find.textContaining('low on stock'), findsOneWidget);
      expect(find.textContaining('purchase orders awaiting action'),
          findsOneWidget);
      expect(find.textContaining('below yesterday'), findsOneWidget);
      expect(find.textContaining('No sales yet today'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('events beyond the 6 cap are folded into "+N more"',
        (tester) async {
      // 7 urgent events: add a long shift (>12h) on top of the 6.
      await pumpPlain(
        tester,
        busyData(),
        shiftState: ShiftLoaded(
          current: openShift(openedFor: const Duration(hours: 15)),
        ),
      );

      // 7 urgent → default 3, so the toggle says "Show all (4)".
      await tester.tap(find.textContaining('Show all (4)'));
      await tester.pump();

      // Expanded list caps at 6 → the 7th is folded into "+1 more".
      expect(find.text('+1 more'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('no Show all toggle when ≤3 urgent events', (tester) async {
      await pumpPlain(
        tester,
        DashboardData(summary: summary(outOfStock: 0, lowStock: 0)),
        shiftState: ShiftLoaded(current: openShift()),
      );

      // Only drawer difference (C) + revenue drop (A) = 2 urgent.
      expect(find.textContaining('Show all'), findsNothing);
      expect(find.textContaining('Drawer difference'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });
  });

  group('CTA navigation', () {
    testWidgets('Restock CTA → Products', (tester) async {
      await pumpWithRouter(
        tester,
        busyData(),
        shiftState: ShiftLoaded(current: openShift()),
      );

      // Criticals sort first: drawer difference, out of stock → "Restock" is
      // in the first 3 visible rows.
      await tester.tap(find.text('Restock'));
      await tester.pumpAndSettle();
      expect(find.text('stub:${RouteNames.products}'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('View orders CTA → Purchasing (after Show all)', (tester) async {
      await pumpWithRouter(
        tester,
        busyData(),
        shiftState: ShiftLoaded(current: openShift()),
      );

      // Pending PO is 4th — expand first.
      await tester.tap(find.textContaining('Show all (3)'));
      await tester.pump();
      await tester.tap(find.text('View orders'));
      await tester.pumpAndSettle();
      expect(find.text('stub:${RouteNames.purchasing}'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('All Clear has no CTA buttons', (tester) async {
      // Healthy day: revenue up, no difference, no stock issues.
      final healthy = DashboardData(
        summary: summary(
          todayRevenue: '6000.0000',
          todayCount: 12,
          yesterdayRevenue: '4000.0000',
          yesterdayCount: 10,
          lowStock: 0,
          outOfStock: 0,
        ),
      );
      await pumpPlain(
        tester,
        healthy,
        shiftState: ShiftLoaded(current: openShift(difference: '0.0000')),
      );

      expect(find.text('Everything looks good'), findsOneWidget);
      expect(find.text('No urgent actions.'), findsOneWidget);
      expect(find.byType(FilledButton), findsNothing);

      await tester.pumpWidget(const SizedBox());
    });
  });
}
