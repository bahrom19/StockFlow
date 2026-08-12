import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsAction;
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/action_center.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

// ── Minimal notifier fakes: expose a fixed state without hitting the API ──

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

void main() {
  DashboardSummary healthySummary() {
    return const DashboardSummary(
      todaySales: DaySales(revenue: '5000.0000', count: 12),
      yesterdaySales: DaySales(revenue: '4000.0000', count: 10),
      monthSales: DaySales(revenue: '90000.0000', count: 220),
      ordersCount: 220,
      grossRevenue: '90000.0000',
      grossProfit: '27000.0000',
      inventoryValue: '120000.0000',
      lowStockProducts: 0,
      outOfStockProducts: 0,
      customerCount: 45,
      supplierCount: 8,
      purchaseTotal: '0.0000',
    );
  }

  CashShift openShiftZeroDiff() {
    return CashShift(
      id: 'shift-1',
      companyId: 'c1',
      warehouseId: 'w1',
      cashierId: 'u1',
      status: 'OPEN',
      openedAt: DateTime.now().subtract(const Duration(hours: 3)),
      expectedClosing: '5000.0000',
      totalSales: '5000.0000',
    );
  }

  Future<void> pumpActionCenter(
    WidgetTester tester, {
    required DashboardUiState dashState,
    required ShiftState shiftState,
    required WarehouseListState warehouseState,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dashboardProvider
              .overrideWith((ref) => _FakeDashboardNotifier(ref, dashState)),
          cashShiftProvider
              .overrideWith((ref) => _FakeCashShiftNotifier(ref, shiftState)),
          warehouseListProvider.overrideWith(
            (ref) => _FakeWarehouseNotifier(ref, warehouseState),
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

  testWidgets('All Clear: no urgent events → Everything looks good',
      (tester) async {
    await pumpActionCenter(
      tester,
      dashState: DashboardData(summary: healthySummary()),
      shiftState: ShiftLoaded(current: openShiftZeroDiff()),
      warehouseState: const WarehouseListLoaded(warehouses: []),
    );

    expect(find.text('Requires Attention'), findsOneWidget);
    expect(find.text('Everything looks good'), findsOneWidget);
    expect(find.text('No urgent actions.'), findsOneWidget);
    expect(find.textContaining('Last checked'), findsOneWidget);

    // Unmount to dispose the periodic "Last checked" timer.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('All Clear: opportunities toggle is offered when present',
      (tester) async {
    await pumpActionCenter(
      tester,
      dashState: DashboardData(summary: healthySummary()),
      shiftState: ShiftLoaded(current: openShiftZeroDiff()),
      warehouseState: const WarehouseListEmpty(),
    );

    expect(find.text('Everything looks good'), findsOneWidget);
    expect(find.textContaining('Show opportunities'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('Low stock event renders top-3 detail lines', (tester) async {
    final items = [
      const LowStockItem(
        productId: 'p1',
        productName: 'Laptop Stand',
        sku: 'SKU-L-005',
        currentStock: 2,
        minQuantity: 5,
        warehouseId: 'w1',
        warehouseName: 'Main Store',
        status: 'LOW_STOCK',
      ),
      const LowStockItem(
        productId: 'p2',
        productName: 'USB-C Cable 1m',
        sku: 'SKU-C-001',
        currentStock: 3,
        minQuantity: 8,
        warehouseId: 'w1',
        warehouseName: 'Main Store',
        status: 'LOW_STOCK',
      ),
    ];
    final summary = healthySummary().copyWith(lowStockProducts: 2);

    await pumpActionCenter(
      tester,
      dashState: DashboardData(summary: summary, lowStockItems: items),
      shiftState: ShiftLoaded(current: openShiftZeroDiff()),
      warehouseState: const WarehouseListLoaded(warehouses: []),
    );

    expect(find.text('2 products low on stock'), findsOneWidget);
    expect(find.textContaining('Laptop Stand'), findsOneWidget);
    expect(find.textContaining('SKU-L-005'), findsOneWidget);
    expect(find.textContaining('2/5'), findsOneWidget);
    expect(find.textContaining('Main Store'), findsNWidgets(2));

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('Loading dashboard → skeleton (no false events)', (tester) async {
    await pumpActionCenter(
      tester,
      dashState: const DashboardLoading(),
      shiftState: const ShiftLoading(),
      warehouseState: const WarehouseListLoading(),
    );

    // While loading, no events and no All Clear may be shown.
    expect(find.text('Everything looks good'), findsNothing);
    expect(find.text('Requires Attention'), findsNothing);
    expect(find.textContaining('low on stock'), findsNothing);
    expect(find.textContaining('out of stock'), findsNothing);

    await tester.pumpWidget(const SizedBox());
  });

  // ── Lifecycle of the 30s "Last checked" ticker (Stage D finalization) ──
  // The ticker is created ONLY in initState (never re-created on rebuild),
  // guarded by `mounted` and cancelled in dispose(). In widget tests the
  // fake clock advances Timers but DateTime.now() stays real, so we assert
  // lifecycle facts instead of label text transitions:
  //  1. the ticker fires without error (mounted-guard works);
  //  2. firing the ticker does NOT rebuild the whole Action Center or
  //     trigger a refresh — events remain unchanged;
  //  3. no pending Timer is left after dispose (a leaked periodic timer
  //     fails the test with "A Timer is still pending" at teardown);
  //  4. no post-dispose setState (guarded by mounted).
  testWidgets('Last checked ticker fires safely and is cancelled on dispose',
      (tester) async {
    await pumpActionCenter(
      tester,
      dashState: DashboardData(summary: healthySummary()),
      shiftState: ShiftLoaded(current: openShiftZeroDiff()),
      warehouseState: const WarehouseListLoaded(warehouses: []),
    );

    expect(find.textContaining('Last checked'), findsOneWidget);

    // Fire the 30s periodic ticker several times — the callback runs
    // `if (mounted) setState`, so a missing mounted-guard would throw here.
    await tester.pump(const Duration(seconds: 31));
    await tester.pump(const Duration(seconds: 60));
    await tester.pump(const Duration(seconds: 60));

    // The ticker only repaints its own label — the Action Center content
    // (All Clear, no events) is untouched; no refresh was triggered. The
    // "Requires Attention" header is always present (it is the block title,
    // not an event); the All Clear body proves no event rows appeared.
    expect(find.textContaining('Last checked'), findsOneWidget);
    expect(find.text('Everything looks good'), findsOneWidget);
    expect(find.text('No urgent actions.'), findsOneWidget);

    // Dispose the tree. If dispose() had not cancelled the periodic timer,
    // the framework reports a pending-timer failure at test teardown.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 90));
    // No exception → timer cancelled, no post-dispose setState.
  });

  // ── Semantics boundary (f72701d pattern, P1 audit) ─────────────────
  // _AttentionEventRow wraps the event text in a label-less
  // Semantics(container: true) so Flutter Web serializes it as textContent
  // (visible to document.body.innerText) instead of hoisting the whole row
  // into role="group" aria-label because of the interactive CTA button.
  testWidgets('event text is a separate semantics leaf from the CTA',
      (tester) async {
    final items = [
      const LowStockItem(
        productId: 'p1',
        productName: 'Laptop Stand',
        sku: 'SKU-L-005',
        currentStock: 2,
        minQuantity: 5,
        warehouseId: 'w1',
        warehouseName: 'Main Store',
        status: 'LOW_STOCK',
      ),
    ];
    final summary = healthySummary().copyWith(lowStockProducts: 1);

    await pumpActionCenter(
      tester,
      dashState: DashboardData(summary: summary, lowStockItems: items),
      shiftState: ShiftLoaded(current: openShiftZeroDiff()),
      warehouseState: const WarehouseListLoaded(warehouses: []),
    );

    final handle = tester.ensureSemantics();

    // Event title must be its own semantics node carrying the label text.
    final titleData = tester
        .getSemantics(find.text('1 product low on stock')).getSemanticsData();
    expect(titleData.label, contains('1 product low on stock'));

    // The CTA must remain a separate, tappable semantics node — the text was
    // NOT swallowed into the button's label (the f72701d baseline rule).
    final ctaData =
        tester.getSemantics(find.text('Review stock')).getSemanticsData();
    expect(ctaData.hasAction(SemanticsAction.tap), isTrue);

    // The title leaf itself is not the button: it carries no tap action, so
    // the row did not collapse into a single labeled interactive node.
    expect(titleData.hasAction(SemanticsAction.tap), isFalse);

    handle.dispose();
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('ticker is not duplicated across rebuilds', (tester) async {
    await pumpActionCenter(
      tester,
      dashState: DashboardData(summary: healthySummary()),
      shiftState: ShiftLoaded(current: openShiftZeroDiff()),
      warehouseState: const WarehouseListLoaded(warehouses: []),
    );

    // Simulate parent rebuilds — initState runs once per State, so the same
    // single periodic timer instance keeps ticking (no accumulation).
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }

    // Fire past multiple 30s periods; the label still renders exactly once.
    await tester.pump(const Duration(seconds: 65));
    expect(find.textContaining('Last checked'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 90));
  });
}

