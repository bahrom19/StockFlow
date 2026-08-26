import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/action_center.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/quick_actions.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/screens/products_list_screen.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

// ── Minimal notifier fakes: fixed states without hitting the API ──

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

/// In-memory products repository serving one canned page — enough for the
/// small catalogs used in navigation tests.
class _StubProductsRepository extends ProductsRepository {
  _StubProductsRepository(super.ref, this.catalog);

  final List<Product> catalog;

  @override
  Future<ProductsResult<ProductListResponse>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    String? sortBy,
    String? sortOrder,
  }) async {
    return ProductsSuccess(
      ProductListResponse(
        items: catalog,
        total: catalog.length,
        page: page,
        limit: limit,
      ),
    );
  }
}

/// Stub screen recording the route it was pushed onto.
class _StubScreen extends StatelessWidget {
  final String label;
  const _StubScreen(this.label);

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: Center(child: Text('stub:$label')));
  }
}

Product product(String name, int stock) => Product.fromJson({
      'id': 'id-$name',
      'companyId': 'c1',
      'name': name,
      'price': '10.0000',
      'stockQuantity': stock,
      'isActive': true,
      'createdAt': '2026-08-01T00:00:00.000Z',
      'updatedAt': '2026-08-01T00:00:00.000Z',
    });

GoRouter _testRouter({
  required Widget home,
  required List<Product> productCatalog,
}) {
  return GoRouter(
    initialLocation: RouteNames.dashboard,
    routes: [
      GoRoute(path: RouteNames.dashboard, builder: (_, __) => home),
      GoRoute(
        path: RouteNames.products,
        builder: (_, state) => ProductsListScreen(
          initialStockFilter: ProductStockFilter.fromQueryParam(
            state.uri.queryParameters[ProductStockFilter.queryParameterKey],
          ),
        ),
      ),
      GoRoute(
        path: RouteNames.inventory,
        builder: (_, __) => const _StubScreen(RouteNames.inventory),
      ),
    ],
  );
}

AppLocalizations _l10nOf(String code) => lookupAppLocalizations(Locale(code));

DashboardSummary summary({int lowStock = 0, int outOfStock = 0}) {
  return DashboardSummary(
    todaySales: const DaySales(revenue: '3000.0000', count: 12),
    yesterdaySales: const DaySales(revenue: '2000.0000', count: 9),
    monthSales: const DaySales(revenue: '90000.0000', count: 220),
    ordersCount: 220,
    grossRevenue: '90000.0000',
    grossProfit: '27000.0000',
    inventoryValue: '120000.0000',
    lowStockProducts: lowStock,
    outOfStockProducts: outOfStock,
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
    openedAt: DateTime.now().subtract(const Duration(hours: 2)),
    expectedClosing: '5000.0000',
    totalSales: '5000.0000',
  );
}

Future<void> pumpApp(
  WidgetTester tester, {
  required Widget home,
  required DashboardSummary dashSummary,
  required List<Product> productCatalog,
}) async {
  // Desktop-width surface so EntityTable renders the DataTable + footer.
  tester.view.physicalSize = const Size(1400, 1000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dashboardProvider.overrideWith(
          (ref) =>
              _FakeDashboardNotifier(ref, DashboardData(summary: dashSummary)),
        ),
        cashShiftProvider.overrideWith(
          (ref) => _FakeCashShiftNotifier(
            ref,
            ShiftLoaded(current: openShiftZeroDiff()),
          ),
        ),
        warehouseListProvider.overrideWith(
          (ref) => _FakeWarehouseNotifier(
            ref,
            const WarehouseListLoaded(warehouses: []),
          ),
        ),
        productsRepositoryProvider.overrideWith(
          (ref) => _StubProductsRepository(ref, productCatalog),
        ),
      ],
      child: MaterialApp.router(
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: _testRouter(home: home, productCatalog: productCatalog),
      ),
    ),
  );
  await tester.pump();
}

ChoiceChip chipOf(WidgetTester tester, String label) =>
    tester.widget<ChoiceChip>(
      find
          .ancestor(of: find.text(label), matching: find.byType(ChoiceChip))
          .first,
    );

void main() {
  group('attention event routing (pure)', () {
    test('low-stock alert → /products?stock=low ("Проверить остатки")', () {
      final events = buildAttentionEvents(
        l10n: _l10nOf('en'),
        summary: summary(lowStock: 2),
        shiftState: const ShiftLoaded(),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );

      final event = events.singleWhere((e) => e.title.contains('low on stock'));
      expect(event.ctaLabel, 'Review stock');
      expect(event.ctaRoute, RouteNames.products);
      expect(event.ctaQueryParameters, containsPair('stock', 'low'));
      expect(event.ctaUri.toString(), '/products?stock=low');
    });

    test('out-of-stock alert → /products?stock=out', () {
      final events = buildAttentionEvents(
        l10n: _l10nOf('en'),
        summary: summary(outOfStock: 2),
        shiftState: const ShiftLoaded(),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );

      final event =
          events.singleWhere((e) => e.title.contains('out of stock'));
      expect(event.ctaRoute, RouteNames.products);
      expect(event.ctaQueryParameters, containsPair('stock', 'out'));
      expect(event.ctaUri.toString(), '/products?stock=out');
    });

    test('no attention CTA points at the generic Inventory screen anymore',
        () {
      final events = buildAttentionEvents(
        l10n: _l10nOf('en'),
        summary: summary(lowStock: 2, outOfStock: 2),
        shiftState: const ShiftLoaded(),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );

      // Regression guard for the original bug: stock alerts must never send
      // users to the per-warehouse Inventory list again.
      expect(
        events.where((e) => e.ctaRoute == RouteNames.inventory),
        isEmpty,
      );
    });
  });

  group('Test 1: low-stock alert → Проверить остатки → Products (low)', () {
    testWidgets('routes to Products with the low-stock filter applied',
        (tester) async {
      final catalog = [
        product('Alert Item', 3), // the product behind the alert
        product('Threshold Five', 5), // exactly at the threshold → still low
        product('Healthy Item', 50),
      ];
      await pumpApp(
        tester,
        home: const Scaffold(
          body: SingleChildScrollView(child: ActionCenter()),
        ),
        dashSummary: summary(lowStock: 1),
        productCatalog: catalog,
      );

      // Alert row is visible with its CTA.
      expect(find.textContaining('low on stock'), findsOneWidget);
      await tester.tap(find.text('Review stock'));
      await tester.pumpAndSettle();

      // Correct route + screen.
      expect(find.text('stub:/products'), findsNothing);
      expect(find.byType(ProductsListScreen), findsOneWidget);
      expect(find.text('Products'), findsWidgets);

      // The "Низкий остаток" chip is rendered and selected.
      final chip = chipOf(tester, 'Low stock');
      expect(chip.selected, isTrue);

      // Only low-stock products are listed; healthy ones are filtered out.
      expect(find.text('Alert Item'), findsOneWidget);
      expect(find.text('Threshold Five'), findsOneWidget);
      expect(find.text('Healthy Item'), findsNothing);
    });
  });

  group('Test 2: out-of-stock alert → Restock → Products (out)', () {
    testWidgets('routes to Products with the out-of-stock filter applied',
        (tester) async {
      final catalog = [
        product('Sold Out Item', 0), // the product behind the alert
        product('Another Sold Out', 0),
        product('Stocked Item', 8),
      ];
      await pumpApp(
        tester,
        home: const Scaffold(
          body: SingleChildScrollView(child: ActionCenter()),
        ),
        dashSummary: summary(outOfStock: 1),
        productCatalog: catalog,
      );

      expect(find.textContaining('out of stock'), findsOneWidget);
      await tester.tap(find.text('Restock'));
      await tester.pumpAndSettle();

      expect(find.byType(ProductsListScreen), findsOneWidget);

      // The "Нет в наличии" chip is rendered and selected.
      final chip = chipOf(tester, 'Out of stock');
      expect(chip.selected, isTrue);
      // The low-stock chip stays unselected.
      expect(chipOf(tester, 'Low stock').selected, isFalse);

      // Zero-quantity rows are listed; stocked ones are filtered out.
      expect(find.text('Sold Out Item'), findsOneWidget);
      expect(find.text('Another Sold Out'), findsOneWidget);
      expect(find.text('Stocked Item'), findsNothing);
    });
  });

  group('Test 3: ordinary Inventory navigation is untouched', () {
    testWidgets('Dashboard → Остатки quick action still opens Inventory',
        (tester) async {
      await pumpApp(
        tester,
        home: const Scaffold(
          body: SingleChildScrollView(child: QuickActionsStrip()),
        ),
        dashSummary: summary(lowStock: 1, outOfStock: 1),
        productCatalog: [product('Anything', 4)],
      );

      // The "Остатки" tile keeps pointing at the plain inventory route.
      await tester.tap(find.text('Inventory'));
      await tester.pumpAndSettle();

      expect(
        find.text('stub:${RouteNames.inventory}'),
        findsOneWidget,
      );
      expect(find.byType(ProductsListScreen), findsNothing);
    });
  });

  group('Test 4: filter chips are localized RU / KK / EN', () {
    test('EN', () {
      final l = _l10nOf('en');
      expect(l.filterLowStock, 'Low stock');
      expect(l.filterOutOfStock, 'Out of stock');
    });

    test('RU', () {
      final l = _l10nOf('ru');
      expect(l.filterLowStock, 'Низкий остаток');
      expect(l.filterOutOfStock, 'Нет в наличии');
    });

    test('KK', () {
      final l = _l10nOf('kk');
      expect(l.filterLowStock, 'Аз қалдық');
      expect(l.filterOutOfStock, 'Таусылды');
    });
  });





}



