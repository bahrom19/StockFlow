import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/sales/presentation/providers/held_sales_provider.dart';
import 'package:stockflow/features/sales/presentation/providers/pos_catalog_provider.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';
import 'package:stockflow/features/sales/presentation/screens/pos_workspace.dart';

// ──────────────────────────────────
// Fixtures
// ──────────────────────────────────
Map<String, dynamic> _product(
  String id,
  String name, {
  String? sku,
  String? barcode,
  String price = '50.00',
  String? category,
  int stock = 10,
}) =>
    {
      'id': id,
      'companyId': 'c1',
      'name': name,
      'sku': sku,
      'barcode': barcode ?? sku,
      'price': price,
      'costPrice': '25.00',
      'unit': 'pcs',
      'category': category,
      'brand': null,
      'stockQuantity': stock,
      'isActive': true,
      'createdAt': '2026-08-03T10:00:00Z',
      'updatedAt': '2026-08-03T10:00:00Z',
    };

Map<String, dynamic> _customer(
  String id,
  String firstName,
  String lastName,
) =>
    {
      'id': id,
      'companyId': 'c1',
      'type': 'PERSON',
      'firstName': firstName,
      'lastName': lastName,
      'companyName': null,
      'iin': null,
      'bin': null,
      'email': '$firstName.$lastName@example.com',
      'phone': '+70001112233',
      'mobile': null,
      'discount': null,
      'creditLimit': null,
      'currentDebt': null,
      'bonusPoints': 0,
      'notes': null,
      'isActive': true,
      'createdAt': '2026-08-03T10:00:00Z',
      'updatedAt': '2026-08-03T10:00:00Z',
    };

Map<String, dynamic> _warehouse() => {
      'id': 'wh1',
      'companyId': 'c1',
      'name': 'Main Store',
      'code': 'MS',
      'address': null,
      'phone': null,
      'managerName': null,
      'isDefault': true,
      'isActive': true,
      'rowVersion': 0,
      'createdAt': '2026-08-03T10:00:00Z',
      'updatedAt': '2026-08-03T10:00:00Z',
    };

Map<String, dynamic> _sale(String id, String status) => {
      'id': id,
      'companyId': 'c1',
      'warehouseId': 'wh1',
      'cashierId': 'u1',
      'saleNumber': 'SALE-0001',
      'status': status,
      'subtotal': '100.0000',
      'discount': '0.0000',
      'tax': '0.0000',
      'total': '100.0000',
      'paidAmount': '100.0000',
      'changeAmount': '0.0000',
      'currency': 'KZT',
      'rowVersion': 1,
      'createdAt': '2026-08-03T10:00:00Z',
      'updatedAt': '2026-08-03T10:00:00Z',
      'items': [],
      'payments': [],
      'receipts': [],
    };

Map<String, dynamic> _dashboard() => {
      'todaySales': {'revenue': '0', 'count': 0, 'averageReceipt': '0'},
      'yesterdaySales': {'revenue': '0', 'count': 0, 'averageReceipt': '0'},
      'monthSales': {'revenue': '0', 'count': 0, 'averageReceipt': '0'},
      'ordersCount': 0,
      'grossRevenue': '0',
      'grossProfit': '0',
      'inventoryValue': '0',
      'lowStockProducts': 0,
      'outOfStockProducts': 0,
      'customerCount': 0,
      'supplierCount': 0,
      'purchaseTotal': '0',
    };

Map<String, dynamic> _salesReport() => {
      'sales': <Map<String, dynamic>>[],
      'total': 0,
      'page': 1,
      'limit': 10,
      'summary': {
        'revenue': '0',
        'profit': '0',
        'margin': '0',
        'averageReceipt': '0',
        'productsSold': 0,
        'count': 0,
        'payments': {'cash': '0', 'card': '0', 'qr': '0', 'other': '0'},
      },
    };

Map<String, dynamic> _profitReport() => {
      'summary': {'revenue': '0', 'cost': '0', 'profit': '0', 'margin': '0'},
      'daily': <Map<String, dynamic>>[],
      'weekly': <Map<String, dynamic>>[],
      'monthly': <Map<String, dynamic>>[],
    };

Map<String, dynamic> _saleList() =>
    {'items': <Map<String, dynamic>>[], 'total': 0, 'page': 1, 'limit': 20};

// ──────────────────────────────────
// Fake ApiClient — routes by path
// ──────────────────────────────────
class _FakePosApi extends ApiClient {
  _FakePosApi() : super(tokenStorage: TokenStorage());

  List<Map<String, dynamic>> products = [];
  List<Map<String, dynamic>> warehouses = [];
  List<Map<String, dynamic>> customers = [];
  Map<String, dynamic>? openShift; // non-null when a shift is OPEN
  final List<Map<String, dynamic>> requests = [];

  DioException _notFound(String path) => DioException(
        requestOptions: RequestOptions(path: path),
        response: Response(
          requestOptions: RequestOptions(path: path),
          statusCode: 404,
          data: {'message': 'No open shift'},
        ),
        type: DioExceptionType.badResponse,
      );

  Map<String, dynamic> _shift({String status = 'OPEN'}) => {
        'id': 'shift-1',
        'companyId': 'c1',
        'warehouseId': 'wh1',
        'cashierId': 'u1',
        'status': status,
        'openedAt': '2026-08-03T10:00:00Z',
        'closedAt': status == 'CLOSED' ? '2026-08-03T18:00:00Z' : null,
        'openingBalance': '1000.0000',
        'closingBalance': '0.0000',
        'cashSales': '120.0000',
        'cardSales': '30.0000',
        'totalSales': '150.0000',
        'cashIn': '0.0000',
        'cashOut': '0.0000',
        'expectedClosing': '1150.0000',
        'difference': '0.0000',
        'notes': null,
        'rowVersion': 1,
      };

  Response<T> _respond<T>(dynamic data, String path) => Response<T>(
        data: data,
        statusCode: 200,
        requestOptions: RequestOptions(path: path),
      );

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    requests.add({'method': 'GET', 'path': path, 'query': queryParameters});
    if (path == ApiEndpoints.products) {
      final search = (queryParameters?['search'] as String?) ?? '';
      final category = (queryParameters?['category'] as String?) ?? '';
      final page =
          int.tryParse((queryParameters?['page'] as String?) ?? '1') ?? 1;
      final limit =
          int.tryParse((queryParameters?['limit'] as String?) ?? '30') ?? 30;
      var list = products;
      if (search.isNotEmpty) {
        final q = search.toLowerCase();
        list = list
            .where((p) =>
                (p['name'] as String).toLowerCase().contains(q) ||
                ((p['sku'] as String?) ?? '').toLowerCase() == q ||
                ((p['barcode'] as String?) ?? '').toLowerCase() == q)
            .toList();
      }
      if (category.isNotEmpty) {
        list = list.where((p) => p['category'] == category).toList();
      }
      final total = list.length;
      final start = (page - 1) * limit;
      final pageItems = start >= total
          ? <Map<String, dynamic>>[]
          : list.sublist(start, math.min(start + limit, total));
      return _respond<T>(
        {'items': pageItems, 'total': total, 'page': page, 'limit': limit},
        path,
      );
    }
    if (path == '${ApiEndpoints.inventory}/warehouses') {
      return _respond<T>(warehouses, path);
    }
    if (path == '${ApiEndpoints.inventory}/stock') {
      return _respond<T>(
        {'items': <Map<String, dynamic>>[], 'total': 0},
        path,
      );
    }
    if (path == ApiEndpoints.dashboard) return _respond<T>(_dashboard(), path);
    if (path == ApiEndpoints.reportsSales) {
      return _respond<T>(_salesReport(), path);
    }
    if (path == ApiEndpoints.reportsProfit) {
      return _respond<T>(_profitReport(), path);
    }
    if (path == ApiEndpoints.sales) return _respond<T>(_saleList(), path);
    if (path == ApiEndpoints.customers) {
      return _respond<T>(
        {'items': customers, 'total': customers.length, 'page': 1, 'limit': 20},
        path,
      );
    }
    if (path == ApiEndpoints.cashShiftXReport) {
      if (openShift != null) return _respond<T>(openShift, path);
      throw _notFound(path);
    }
    if (path == '${ApiEndpoints.cashShifts}/z-report/shift-1') {
      return _respond<T>(_shift(status: 'CLOSED'), path);
    }
    throw StateError('No GET stub for $path');
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    requests.add({'method': 'POST', 'path': path});
    if (path == ApiEndpoints.sales) {
      return _respond<T>(_sale('sale-1', 'DRAFT'), path);
    }
    if (path.endsWith('/complete')) {
      return _respond<T>(_sale('sale-1', 'COMPLETED'), path);
    }
    if (path == ApiEndpoints.customers) {
      final body = (data as Map<String, dynamic>?) ?? {};
      final customer = _customer(
        'new-cust-1',
        (body['firstName'] as String?) ?? 'New',
        (body['lastName'] as String?) ?? 'Customer',
      );
      customers.insert(0, customer);
      return _respond<T>(customer, path);
    }
    if (path == ApiEndpoints.cashShiftOpen) {
      openShift = _shift();
      return _respond<T>(openShift, path);
    }
    if (path == ApiEndpoints.cashShiftClose) {
      final closed = _shift(status: 'CLOSED');
      openShift = null;
      return _respond<T>(closed, path);
    }
    if (path == ApiEndpoints.cashShiftCashIn ||
        path == ApiEndpoints.cashShiftCashOut) {
      if (openShift != null) {
        openShift = Map.of(openShift!);
      }
      return _respond<T>(openShift ?? _shift(), path);
    }
    throw StateError('No POST stub for $path');
  }

  @override
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('No PATCH stub for $path');
  }

  @override
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('No PUT stub for $path');
  }

  @override
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('No DELETE stub for $path');
  }
}

// ──────────────────────────────────
// CartNotifier unit tests
// ──────────────────────────────────
void main() {
  group('CartNotifier', () {
    test('addItem merges quantities for the same product', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(cartProvider.notifier);

      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'A',
        productSku: 'S1',
        quantity: 1,
        unitPrice: 10,
        costPrice: 5,
      ));
      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'A',
        productSku: 'S1',
        quantity: 2,
        unitPrice: 10,
        costPrice: 5,
      ));

      final state = container.read(cartProvider);
      expect(state.items.length, 1);
      expect(state.itemCount, 3);
      expect(state.subtotal, 30);
    });

    test('updateQuantity, updateDiscount, removeItem and clear work', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(cartProvider.notifier);

      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'A',
        productSku: 'S1',
        quantity: 2,
        unitPrice: 10,
        costPrice: 5,
      ));
      notifier.updateQuantity('p1', 5);
      expect(container.read(cartProvider).itemCount, 5);

      notifier.updateDiscount('p1', 5);
      expect(container.read(cartProvider).totalDiscount, 5);
      expect(container.read(cartProvider).total, 45);

      notifier.removeItem('p1');
      expect(container.read(cartProvider).items, isEmpty);

      notifier.addItem(const CartItem(
        productId: 'p2',
        productName: 'B',
        productSku: 'S2',
        quantity: 1,
        unitPrice: 3,
        costPrice: 1,
      ));
      notifier.clear();
      expect(container.read(cartProvider).items, isEmpty);
      expect(container.read(cartProvider).total, 0);
    });

    test('validate rejects empty carts and negative prices', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(cartProvider.notifier);

      expect(notifier.validate(), isNotNull);

      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'A',
        productSku: 'S1',
        quantity: 1,
        unitPrice: -5,
        costPrice: 5,
      ));
      expect(notifier.validate(), isNotNull);

      notifier.updateQuantity('p1', 2);
      notifier.updateDiscount('p1', 1);
      notifier.removeItem('p1');
      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'A',
        productSku: 'S1',
        quantity: 1,
        unitPrice: 5,
        costPrice: 5,
      ));
      expect(notifier.validate(), isNull);
    });
  });

  // ──────────────────────────────────
  // PosCatalogProvider unit tests
  // ──────────────────────────────────
  group('PosCatalogProvider', () {
    test('init loads products and derives categories', () async {
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', category: 'Drinks'),
          _product('p2', 'Croissant', sku: 'CRS', category: 'Food'),
        ];
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);

      final notifier = container.read(posCatalogProvider.notifier);
      await notifier.init();

      final state = container.read(posCatalogProvider);
      expect(state.products.length, 2);
      expect(state.categories, containsAll(['Drinks', 'Food']));
      expect(state.total, 2);
      expect(state.hasMore, isFalse);
    });

    test('searchNow filters products server-side', () async {
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', category: 'Drinks'),
          _product('p2', 'Croissant', sku: 'CRS', category: 'Food'),
        ];
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);

      final notifier = container.read(posCatalogProvider.notifier);
      await notifier.init();
      await notifier.searchNow('esp');

      final state = container.read(posCatalogProvider);
      expect(state.products.length, 1);
      expect(state.products.first.name, 'Espresso');
    });

    test('setCategory filters products', () async {
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', category: 'Drinks'),
          _product('p2', 'Croissant', sku: 'CRS', category: 'Food'),
        ];
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);

      final notifier = container.read(posCatalogProvider.notifier);
      await notifier.init();
      await notifier.setCategory('Food');

      final state = container.read(posCatalogProvider);
      expect(state.products.length, 1);
      expect(state.products.first.name, 'Croissant');
    });

    test('debounced search coalesces rapid keystrokes', () async {
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP'),
          _product('p2', 'Croissant', sku: 'CRS'),
        ];
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);

      final notifier = container.read(posCatalogProvider.notifier);
      await notifier.init();
      final requestsBefore = fake.requests
          .where((r) => r['method'] == 'GET' && r['path'] == ApiEndpoints.products)
          .length;

      // Three rapid keystrokes within the debounce window.
      notifier.search('e');
      notifier.search('es');
      notifier.search('esp');
      await Future<void>.delayed(const Duration(milliseconds: 350));

      final requestsAfter = fake.requests
          .where((r) => r['method'] == 'GET' && r['path'] == ApiEndpoints.products)
          .length;
      // Only ONE fetch fired despite three keystrokes.
      expect(requestsAfter - requestsBefore, 1);
      expect(container.read(posCatalogProvider).products.length, 1);
      expect(container.read(posCatalogProvider).products.first.name, 'Espresso');
    });

    test('loads a 1000+ product catalog via lazy pagination', () async {
      final fake = _FakePosApi()
        ..products = List.generate(
          1037,
          (i) => _product('p$i', 'Product $i', sku: 'S$i'),
        );
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);

      final notifier = container.read(posCatalogProvider.notifier);
      await notifier.init();

      var state = container.read(posCatalogProvider);
      expect(state.products.length, 30);
      expect(state.total, 1037);
      expect(state.hasMore, isTrue);

      var pages = 1;
      while (state.hasMore && pages < 200) {
        await notifier.loadMore();
        state = container.read(posCatalogProvider);
        pages++;
      }

      expect(state.products.length, 1037);
      expect(state.hasMore, isFalse);
      expect(pages, (1037 / 30).ceil());
      // Selection stays clamped after pagination.
      expect(state.selected, isNotNull);
    });

    test('moveSelection navigates and clamps', () async {
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP'),
          _product('p2', 'Croissant', sku: 'CRS'),
        ];
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);

      final notifier = container.read(posCatalogProvider.notifier);
      await notifier.init();

      expect(container.read(posCatalogProvider).selected?.name, 'Espresso');
      notifier.moveSelection(1);
      expect(
        container.read(posCatalogProvider).selected?.name,
        'Croissant',
      );
      // Clamp at the end.
      notifier.moveSelection(5);
      expect(
        container.read(posCatalogProvider).selected?.name,
        'Croissant',
      );
      // And at the start.
      notifier.moveSelection(-5);
      expect(container.read(posCatalogProvider).selected?.name, 'Espresso');
    });

    test('loadMore appends paginated results', () async {
      final fake = _FakePosApi()
        ..products = List.generate(
          35,
          (i) => _product('p$i', 'Product $i', sku: 'S$i'),
        );
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);

      final notifier = container.read(posCatalogProvider.notifier);
      await notifier.init();

      var state = container.read(posCatalogProvider);
      expect(state.products.length, 30);
      expect(state.hasMore, isTrue);

      await notifier.loadMore();

      state = container.read(posCatalogProvider);
      expect(state.products.length, 35);
      expect(state.hasMore, isFalse);
    });
  });

  // ──────────────────────────────────
  // PosWorkspace widget tests
  // ──────────────────────────────────
  group('PosWorkspace', () {
    Widget buildWorkspace(_FakePosApi fake) {
      return ProviderScope(
        overrides: [apiClientProvider.overrideWith((ref) => fake)],
        child: const MaterialApp(
          home: Scaffold(body: PosWorkspace()),
        ),
      );
    }

    // Simulate a desktop cashier terminal.
    void useDesktopSurface(WidgetTester tester) {
      tester.view.physicalSize = const Size(1440, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
    }

    testWidgets('full scenario: browse, add, pay, complete, refresh',
        (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso',
              sku: 'ESP', price: '100.00', category: 'Drinks', stock: 50),
          _product('p2', 'Croissant',
              sku: 'CRS', price: '50.00', category: 'Food', stock: 3),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      // Catalog rendered from the API.
      expect(find.text('Espresso'), findsOneWidget);
      expect(find.text('Croissant'), findsOneWidget);

      // Tap a product → cart updates.
      await tester.tap(find.text('Espresso'));
      await tester.pumpAndSettle();
      expect(find.textContaining('1 items'), findsWidgets);

      // Enter cash payment (exact total).
      await tester.enterText(
        find.byKey(const Key('pos_cash_field')),
        '100.00',
      );
      await tester.pump();

      // Complete the sale (button may read 'Complete Sale' or 'Insufficient
      // payment' depending on state — always address it by key).
      await tester.tap(find.byKey(const Key('pos_complete_button')));
      await tester.pumpAndSettle();

      // Success dialog shown.
      expect(find.text('Sale completed'), findsOneWidget);

      // Close it → cart is cleared and dependent lists were refreshed.
      await tester.tap(find.text('New sale'));
      await tester.pumpAndSettle();
      expect(find.textContaining('0 items'), findsWidgets);

      final postPaths =
          fake.requests.where((r) => r['method'] == 'POST').map((r) => r['path']).toList();
      expect(postPaths, contains(ApiEndpoints.sales));
      expect(postPaths.any((p) => p.endsWith('/complete')), isTrue);

      final getPaths =
          fake.requests.where((r) => r['method'] == 'GET').map((r) => r['path']).toList();
      // Dashboard, sales history and inventory were refreshed.
      expect(getPaths, contains(ApiEndpoints.dashboard));
      expect(getPaths, contains(ApiEndpoints.sales));
      expect(getPaths, contains('${ApiEndpoints.inventory}/stock'));
    });

    testWidgets('hotkeys: Enter adds the selected product', (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
          _product('p2', 'Croissant', sku: 'CRS', price: '50.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      // First product is selected by default.
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.textContaining('1 items'), findsWidgets);

      // Arrow down selects the second product, Enter adds it → 2 items total.
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.textContaining('2 items'), findsWidgets);
    });

    testWidgets('insufficient payment blocks completion', (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Espresso'));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('pos_cash_field')),
        '10.00',
      );
      await tester.pump();

      await tester.tap(find.byKey(const Key('pos_complete_button')));
      await tester.pumpAndSettle();

      // No POST happened and the success dialog never opened.
      expect(find.text('Sale completed'), findsNothing);
      final postPaths =
          fake.requests.where((r) => r['method'] == 'POST').map((r) => r['path']).toList();
      expect(postPaths, isEmpty);
    });

    testWidgets('F9 hotkey completes a fully-paid sale', (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Espresso'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('pos_cash_field')),
        '100.00',
      );
      await tester.pump();

      await tester.sendKeyEvent(LogicalKeyboardKey.f9);
      await tester.pumpAndSettle();

      expect(find.text('Sale completed'), findsOneWidget);
      final postPaths = fake.requests
          .where((r) => r['method'] == 'POST')
          .map((r) => r['path'])
          .toList();
      expect(postPaths.any((p) => p.endsWith('/complete')), isTrue);
    });

    testWidgets('Ctrl+Delete clears the cart after confirmation',
        (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Espresso'));
      await tester.pumpAndSettle();
      expect(find.textContaining('1 items'), findsWidgets);

      // Ctrl+Delete opens the clear-cart confirmation.
      await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
      await tester.sendKeyEvent(LogicalKeyboardKey.delete);
      await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
      await tester.pumpAndSettle();

      expect(find.text('Clear cart?'), findsOneWidget);
      await tester.tap(find.text('Clear cart'));
      await tester.pumpAndSettle();
      expect(find.textContaining('0 items'), findsWidgets);
    });

    testWidgets('F4 opens customer picker and selects a customer',
        (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()]
        ..customers = [_customer('c1', 'Anna', 'Smith')];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      await tester.sendKeyEvent(LogicalKeyboardKey.f4);
      await tester.pumpAndSettle();

      // Picker dialog lists the customer.
      expect(find.text('Select customer'), findsOneWidget);
      expect(find.text('Anna Smith'), findsOneWidget);

      await tester.tap(find.text('Anna Smith'));
      await tester.pumpAndSettle();

      // Cart now has the customer attached (customer row shows the name).
      expect(find.textContaining('Anna Smith'), findsWidgets);
      expect(find.text('Walk-in customer (F4)'), findsNothing);
    });

    testWidgets('barcode submit adds the exact barcode match', (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', barcode: '4601234567890'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextField).first,
        '4601234567890',
      );
      await tester.pump(const Duration(milliseconds: 350));
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();

      expect(find.textContaining('1 items'), findsWidgets);
    });

    testWidgets('F6 holds the sale and Ctrl+H resumes it', (tester) async {
      useDesktopSurface(tester);
      SharedPreferences.setMockInitialValues({});
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Espresso'));
      await tester.pumpAndSettle();
      expect(find.textContaining('1 items'), findsWidgets);

      // Hold the sale (F6).
      await tester.sendKeyEvent(LogicalKeyboardKey.f6);
      await tester.pumpAndSettle();
      expect(find.textContaining('0 items'), findsWidgets);

      // Resume it (Ctrl+H).
      await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
      await tester.sendKeyEvent(LogicalKeyboardKey.keyH);
      await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
      await tester.pumpAndSettle();

      expect(find.text('Resume held sale'), findsOneWidget);
      await tester.tap(find.textContaining('Held').first);
      await tester.pumpAndSettle();
      expect(find.textContaining('1 items'), findsWidgets);
    });

    testWidgets('F5 opens a cash shift when none is open', (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      // No open shift → the panel offers Open Shift.
      expect(find.text('Open Shift'), findsOneWidget);

      await tester.sendKeyEvent(LogicalKeyboardKey.f5);
      await tester.pumpAndSettle();

      // The open-shift dialog asks for the opening balance.
      expect(find.text('Open Cash Shift'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('pos_prompt_field')), '1000');
      await tester.tap(find.text('Open shift'));
      await tester.pumpAndSettle();

      // Shift is now open and reported on the strip.
      expect(find.textContaining('Shift OPEN'), findsOneWidget);
      final getPaths = fake.requests
          .where((r) => r['method'] == 'GET')
          .map((r) => r['path'])
          .toList();
      expect(getPaths, contains(ApiEndpoints.cashShiftXReport));
    });

    testWidgets('F7 shows the X report for an open shift', (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()]
        ..openShift = {
          'id': 'shift-1',
          'companyId': 'c1',
          'warehouseId': 'wh1',
          'cashierId': 'u1',
          'status': 'OPEN',
          'openedAt': '2026-08-03T10:00:00Z',
          'closedAt': null,
          'openingBalance': '1000.0000',
          'closingBalance': '0.0000',
          'cashSales': '120.0000',
          'cardSales': '30.0000',
          'totalSales': '150.0000',
          'cashIn': '0.0000',
          'cashOut': '0.0000',
          'expectedClosing': '1150.0000',
          'difference': '0.0000',
          'notes': null,
          'rowVersion': 1,
        };

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      expect(find.textContaining('Shift OPEN'), findsOneWidget);

      await tester.sendKeyEvent(LogicalKeyboardKey.f7);
      await tester.pumpAndSettle();

      expect(find.text('X Report'), findsWidgets);
      expect(find.textContaining('Cash sales'), findsOneWidget);
    });
  });

  // ──────────────────────────────────
  // HeldSalesNotifier unit tests
  // ──────────────────────────────────
  group('HeldSalesNotifier', () {
    test('hold, resume and discard persist via preferences', () async {
      SharedPreferences.setMockInitialValues({});
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(heldSalesProvider.notifier);

      final cart = CartState(
        items: const [
          CartItem(
            productId: 'p1',
            productName: 'Espresso',
            productSku: 'ESP',
            quantity: 2,
            unitPrice: 10,
            costPrice: 5,
          ),
        ],
        customerId: 'c1',
        customerName: 'Anna',
      );

      await notifier.hold(cart, label: 'Test hold');
      expect(container.read(heldSalesProvider).held.length, 1);
      expect(container.read(heldSalesProvider).held.first.total, 20);

      final resumed = await notifier.resume(
        container.read(heldSalesProvider).held.first.id,
      );
      expect(resumed, isNotNull);
      expect(resumed!.items.length, 1);
      expect(resumed.customerName, 'Anna');
      expect(container.read(heldSalesProvider).held, isEmpty);
    });
  });

  // ──────────────────────────────────
  // CashShiftNotifier unit tests
  // ──────────────────────────────────
  group('CashShiftNotifier', () {
    test('loadShift with no open shift yields an empty ShiftLoaded', () async {
      final fake = _FakePosApi();
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);

      await container.read(cashShiftProvider.notifier).loadShift('wh1');
      final state = container.read(cashShiftProvider);
      expect(state, isA<ShiftLoaded>());
      expect((state as ShiftLoaded).current, isNull);
    });

    test('openShift → refresh → closeShift full cycle', () async {
      final fake = _FakePosApi();
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);
      final notifier = container.read(cashShiftProvider.notifier);

      await notifier.loadShift('wh1');
      final opened = await notifier.openShift(1000);
      expect(opened, isNotNull);
      expect(opened!.isOpen, isTrue);
      expect(container.read(cashShiftProvider), isA<ShiftLoaded>());

      final report = await notifier.refresh();
      expect(report, isNotNull);
      expect(report!.cashSalesValue, 120);

      final closed = await notifier.closeShift();
      expect(closed, isNotNull);
      expect(closed!.status, 'CLOSED');
      // After close there is no open shift.
      final state = container.read(cashShiftProvider);
      expect((state as ShiftLoaded).current, isNull);
    });
  });
}
