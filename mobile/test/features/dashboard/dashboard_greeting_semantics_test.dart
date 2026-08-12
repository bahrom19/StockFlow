import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsAction;
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

// ── Minimal notifier fakes: fixed state, no API (load methods are no-ops
//    because DashboardScreen.initState calls them). ──

class _FakeDashboardNotifier extends DashboardNotifier {
  _FakeDashboardNotifier(super.ref, DashboardUiState initial) {
    state = initial;
  }

  @override
  Future<void> loadDashboard() async {} // state pre-seeded — no API
  @override
  Future<void> refresh() async {} // no-op — nothing to re-fetch
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

void main() {
  // Empty company → onboarding mode (no ActionCenter 30s ticker), so the only
  // periodic timer in the tree is CashDrawerHero's 20s refresh (cancelled by
  // unmounting below).
  const emptySummary = DashboardSummary(
    todaySales: DaySales(revenue: '0.0000', count: 0),
    yesterdaySales: DaySales(revenue: '0.0000', count: 0),
    monthSales: DaySales(revenue: '0.0000', count: 0),
    ordersCount: 0,
    grossRevenue: '0.0000',
    grossProfit: '0.0000',
    inventoryValue: '0.0000',
    lowStockProducts: 0,
    outOfStockProducts: 0,
    customerCount: 0,
    supplierCount: 0,
    purchaseTotal: '0.0000',
  );

  testWidgets('greeting text is a separate semantics leaf from Refresh',
      (tester) async {
    final container = ProviderContainer(overrides: [
      dashboardProvider.overrideWith(
        (ref) => _FakeDashboardNotifier(
          ref,
          const DashboardData(summary: emptySummary),
        ),
      ),
      cashShiftProvider.overrideWith(
        (ref) => _FakeCashShiftNotifier(
          ref,
          const ShiftLoaded(),
        ),
      ),
      warehouseListProvider.overrideWith(
        (ref) => _FakeWarehouseNotifier(
          ref,
          const WarehouseListLoaded(warehouses: []),
        ),
      ),
      currentUserProvider.overrideWithValue(
        const CurrentUser(
          id: 'u1',
          email: 'alice@stockflow.test',
          firstName: 'Alice',
          lastName: 'Smith',
          companyId: 'c1',
        ),
      ),
    ]);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const DashboardScreen(),
        ),
      ),
    );
    await tester.pump();

    final handle = tester.ensureSemantics();

    // Greeting text must be its own NON-interactive semantics leaf carrying
    // the label (the ddd97fb rule — Flutter Web then serializes it as
    // textContent instead of hoisting it into the row's group aria-label).
    final greetingData = tester
        .getSemantics(find.textContaining('Hello, Alice'))
        .getSemanticsData();
    expect(greetingData.label, contains('Hello, Alice'));
    expect(greetingData.hasAction(SemanticsAction.tap), isFalse);

    // The Refresh button remains a separate, tappable semantics node.
    final refreshData =
        tester.getSemantics(find.byIcon(Icons.refresh)).getSemanticsData();
    expect(refreshData.hasAction(SemanticsAction.tap), isTrue);

    handle.dispose();
    // Unmount to cancel CashDrawerHero's 20s timer (a pending periodic
    // timer would fail the test at teardown).
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
  });
}
