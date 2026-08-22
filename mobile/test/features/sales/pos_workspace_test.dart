import 'dart:convert';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsAction;
import 'package:flutter/services.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/core/currency/money.dart';
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
        unitPrice: const Money(minorUnits: 1000, currency: 'KZT'),
        costPrice: const Money(minorUnits: 500, currency: 'KZT'),
      ));
      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'A',
        productSku: 'S1',
        quantity: 2,
        unitPrice: const Money(minorUnits: 1000, currency: 'KZT'),
        costPrice: const Money(minorUnits: 500, currency: 'KZT'),
      ));

      final state = container.read(cartProvider);
      expect(state.items.length, 1);
      expect(state.itemCount, 3);
      expect(state.subtotal, Money.fromMinorUnits(3000, 'KZT'));
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
        unitPrice: const Money(minorUnits: 1000, currency: 'KZT'),
        costPrice: const Money(minorUnits: 500, currency: 'KZT'),
      ));
      notifier.updateQuantity('p1', 5);
      expect(container.read(cartProvider).itemCount, 5);

      notifier.updateDiscount(
        'p1',
        const Money(minorUnits: 500, currency: 'KZT'),
      );
      expect(
        container.read(cartProvider).totalDiscount,
        Money.fromMinorUnits(500, 'KZT'),
      );
      expect(
        container.read(cartProvider).total,
        Money.fromMinorUnits(4500, 'KZT'),
      );

      notifier.removeItem('p1');
      expect(container.read(cartProvider).items, isEmpty);

      notifier.addItem(const CartItem(
        productId: 'p2',
        productName: 'B',
        productSku: 'S2',
        quantity: 1,
        unitPrice: const Money(minorUnits: 300, currency: 'KZT'),
        costPrice: const Money(minorUnits: 100, currency: 'KZT'),
      ));
      notifier.clear();
      expect(container.read(cartProvider).items, isEmpty);
      expect(container.read(cartProvider).total, Money.zero('KZT'));
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
        unitPrice: const Money(minorUnits: -500, currency: 'KZT'),
        costPrice: const Money(minorUnits: 500, currency: 'KZT'),
      ));
      expect(notifier.validate(), isNotNull);

      notifier.updateQuantity('p1', 2);
      notifier.updateDiscount(
        'p1',
        const Money(minorUnits: 100, currency: 'KZT'),
      );
      notifier.removeItem('p1');
      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'A',
        productSku: 'S1',
        quantity: 1,
        unitPrice: const Money(minorUnits: 500, currency: 'KZT'),
        costPrice: const Money(minorUnits: 500, currency: 'KZT'),
      ));
      expect(notifier.validate(), isNull);
    });

    test('cross-currency item is rejected and the cart stays unchanged',
        () async {
      SharedPreferences.setMockInitialValues({});
      // Do not leak the mock prefs into later tests in this file.
      addTearDown(() => SharedPreferences.setMockInitialValues({}));
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(cartProvider.notifier);

      // Operating currency mirrors the provider default (KZT).
      expect(container.read(currencyProvider), 'KZT');
      expect(container.read(cartProvider).currency, 'KZT');

      // A RUB item must be rejected on the KZT cart — no silent conversion.
      expect(
        () => notifier.addItem(const CartItem(
          productId: 'p1',
          productName: 'RUB item',
          productSku: 'R1',
          quantity: 1,
          unitPrice: Money(minorUnits: 1000, currency: 'RUB'),
          costPrice: Money(minorUnits: 500, currency: 'RUB'),
        )),
        throwsArgumentError,
        reason: 'mixed-currency carts are not supported',
      );

      // The rejected add must not mutate the cart.
      final state = container.read(cartProvider);
      expect(state.currency, 'KZT');
      expect(state.items, isEmpty);
      expect(state.total, Money.zero('KZT'));
    });

    test('after switching the provider to RUB the cart operates in RUB',
        () async {
      SharedPreferences.setMockInitialValues({});
      // The provider persists the switch to the mock store — reset it so the
      // leaked 'RUB' cannot cascade into later tests in this file.
      addTearDown(() => SharedPreferences.setMockInitialValues({}));
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await container.read(currencyProvider.notifier).setCurrency('RUB');
      final notifier = container.read(cartProvider.notifier);
      notifier.clear(); // new cart inherits the provider currency.
      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'RUB item',
        productSku: 'R1',
        quantity: 2,
        unitPrice: Money(minorUnits: 1000, currency: 'RUB'),
        costPrice: Money(minorUnits: 500, currency: 'RUB'),
      ));

      final state = container.read(cartProvider);
      expect(state.currency, 'RUB');
      expect(state.items.single.unitPrice.currency, 'RUB');
      expect(state.items.single.costPrice.currency, 'RUB');
      expect(state.total, Money.fromMinorUnits(2000, 'RUB'));
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
          .where(
              (r) => r['method'] == 'GET' && r['path'] == ApiEndpoints.products)
          .length;

      // Three rapid keystrokes within the debounce window.
      notifier.search('e');
      notifier.search('es');
      notifier.search('esp');
      await Future<void>.delayed(const Duration(milliseconds: 350));

      final requestsAfter = fake.requests
          .where(
              (r) => r['method'] == 'GET' && r['path'] == ApiEndpoints.products)
          .length;
      // Only ONE fetch fired despite three keystrokes.
      expect(requestsAfter - requestsBefore, 1);
      expect(container.read(posCatalogProvider).products.length, 1);
      expect(
          container.read(posCatalogProvider).products.first.name, 'Espresso');
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

    // Regression: searching when the query matches zero products used to
    // crash with `Invalid argument(s): 0` because int.clamp(0, -1) was
    // called on an empty merged list (merged.length - 1 == -1).
    test('searchNow with empty result does not crash', () async {
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

      // A search that matches nothing → merged list is empty.
      await notifier.searchNow('ZZZ-NO-MATCH');

      final state = container.read(posCatalogProvider);
      expect(state.products, isEmpty);
      expect(state.selectedIndex, 0);
      expect(state.selected, isNull);
    });

    // Regression: navigating after an empty result must not throw.
    test('moveSelection after empty result does not crash', () async {
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP'),
        ];
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWith((ref) => fake),
      ]);
      addTearDown(container.dispose);

      final notifier = container.read(posCatalogProvider.notifier);
      await notifier.init();
      await notifier.searchNow('ZZZ-NO-MATCH');

      // Must not throw even though products is empty.
      expect(() => notifier.moveSelection(1), returnsNormally);
      expect(() => notifier.moveSelection(-1), returnsNormally);

      final state = container.read(posCatalogProvider);
      expect(state.products, isEmpty);
      expect(state.selected, isNull);
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
          locale: Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
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

      final postPaths = fake.requests
          .where((r) => r['method'] == 'POST')
          .map((r) => r['path'])
          .toList();
      expect(postPaths, contains(ApiEndpoints.sales));
      expect(postPaths.any((p) => p.endsWith('/complete')), isTrue);

      final getPaths = fake.requests
          .where((r) => r['method'] == 'GET')
          .map((r) => r['path'])
          .toList();
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
      final postPaths = fake.requests
          .where((r) => r['method'] == 'POST')
          .map((r) => r['path'])
          .toList();
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

    // Regression: the receipt dialog's print action must run the print flow
    // and degrade gracefully where native printing is not implemented yet —
    // the service stub fails fast by design and the workspace shows a
    // localized "Print failed" snackbar instead of an unhandled exception.
    // On web builds the same tap opens the browser print dialog.
    testWidgets('receipt print action runs flow and degrades gracefully',
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
      await tester.enterText(
        find.byKey(const Key('pos_cash_field')),
        '100.00',
      );
      await tester.pump();

      await tester.sendKeyEvent(LogicalKeyboardKey.f9);
      await tester.pumpAndSettle();
      expect(find.text('Sale completed'), findsOneWidget);

      // Tap the receipt dialog's print button. On the test VM the facade
      // resolves to the native stub; the error must be caught and surfaced
      // as a snackbar — never escape to the zone.
      await tester.tap(find.text('Print'));
      await tester.pump(); // start the snackbar animation
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.textContaining('Print failed'), findsOneWidget);
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

    // Regression: the cart quantity field used to be a hard-coded
    // SizedBox(width: 34). A TextField needs ~16px of decorator padding on
    // top of the text itself, so 3-digit quantities ("100") were visually
    // clipped. The field now hugs its content (min 34 / max 64) and the
    // whole row must stay overflow-free at every supported POS width.
    testWidgets('cart quantity stays fully visible for large values',
        (tester) async {
      addTearDown(tester.view.reset);
      SharedPreferences.setMockInitialValues({});
      addTearDown(() => SharedPreferences.setMockInitialValues({}));
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Milk 1L', sku: 'MLK', price: '500.00'),
        ]
        ..warehouses = [_warehouse()];

      for (final width in <double>[768, 1024, 1440]) {
        // Simulate each supported desktop terminal size.
        tester.view.physicalSize = Size(width, 900);
        tester.view.devicePixelRatio = 1.0;

        await tester.pumpWidget(buildWorkspace(fake));
        await tester.pumpAndSettle();

        // Add the product to the cart.
        await tester.tap(find.text('Milk 1L').first);
        await tester.pumpAndSettle();

        // Type a 3-digit quantity straight into the field.
        await tester.enterText(find.byKey(const Key('pos_qty_field')), '100');
        await tester.testTextInput.receiveAction(TextInputAction.done);
        await tester.pumpAndSettle();

        // Quantity applied end-to-end — header count reflects it.
        expect(find.text('Cart (100 items)'), findsOneWidget);

        // The rendered field is wide enough for its content; the old fixed
        // 34px box fails this check.
        final qtyBox = tester.renderObject<RenderBox>(
          find.byKey(const Key('pos_qty_field')),
        );
        expect(qtyBox.size.width, greaterThanOrEqualTo(36));
        expect(qtyBox.size.width, lessThanOrEqualTo(64));

        // The +/- steppers remain reachable and still update the quantity.
        await tester.tap(find.byIcon(Icons.add_circle_outline));
        await tester.pumpAndSettle();
        expect(find.text('Cart (101 items)'), findsOneWidget);

        await tester.tap(find.byIcon(Icons.remove_circle_outline));
        await tester.pumpAndSettle();
        expect(find.text('Cart (100 items)'), findsOneWidget);
      }

      // Close the simulated keyboard and drop focus so the following tests
      // start from a pristine surface (no lingering viewInsets).
      FocusManager.instance.primaryFocus?.unfocus();
      tester.testTextInput.hide();
      await tester.pumpAndSettle();
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

    testWidgets(
        'resuming a RUB held sale restores the RUB operating + cart currency',
        (tester) async {
      useDesktopSurface(tester);
      SharedPreferences.setMockInitialValues({});
      // resume() writes the held currency ('RUB') to the mock store via the
      // provider — reset it so later tests start from a clean slate.
      addTearDown(() => SharedPreferences.setMockInitialValues({}));
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      final container =
          ProviderScope.containerOf(tester.element(find.byType(PosWorkspace)));

      // Pre-seed a held sale that was created while the operating currency was
      // RUB (e.g. the register operated in RUB earlier in the day).
      await container.read(currencyProvider.notifier).setCurrency('RUB');
      await container.read(heldSalesProvider.notifier).hold(
            const CartState(
              currency: 'RUB',
              items: [
                CartItem(
                  productId: 'p1',
                  productName: 'Espresso',
                  productSku: 'ESP',
                  quantity: 2,
                  unitPrice: Money(minorUnits: 10000, currency: 'RUB'),
                  costPrice: Money(minorUnits: 5000, currency: 'RUB'),
                ),
              ],
            ),
            label: 'RUB hold',
          );

      // The current operating currency is back to KZT.
      await container.read(currencyProvider.notifier).setCurrency('KZT');
      expect(container.read(currencyProvider), 'KZT');

      // Resume the held sale (Ctrl+H) and pick it from the dialog.
      await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
      await tester.sendKeyEvent(LogicalKeyboardKey.keyH);
      await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
      await tester.pumpAndSettle();

      expect(find.text('Resume held sale'), findsOneWidget);
      await tester.tap(find.textContaining('RUB hold').first);
      await tester.pumpAndSettle();

      // Operating currency restored to the held sale's currency.
      expect(container.read(currencyProvider), 'RUB');

      // Cart currency and item amounts are all RUB.
      final state = container.read(cartProvider);
      expect(state.currency, 'RUB');
      expect(state.items, hasLength(1));
      expect(state.items.single.unitPrice.currency, 'RUB');
      expect(state.items.single.costPrice.currency, 'RUB');
      expect(state.total, Money.fromMinorUnits(20000, 'RUB'));
      expect(find.textContaining('2 items'), findsWidgets);
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
  // PosWorkspace semantics boundary tests
  // ──────────────────────────────────
  // Regression guard for Flutter Web semantics flattening: non-interactive
  // text that sits next to a CTA inside the workspace used to be merged into
  // a role="group" aria-label (invisible to document.body.innerText). Each
  // wrapped block must stay its own text leaf WITHOUT a tap action, while
  // every CTA remains an independently tappable semantics node.
  group('PosWorkspace semantics boundaries', () {
    Widget buildWorkspace(_FakePosApi fake) {
      return ProviderScope(
        overrides: [apiClientProvider.overrideWith((ref) => fake)],
        child: const MaterialApp(
          locale: Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: PosWorkspace()),
        ),
      );
    }

    void useDesktopSurface(WidgetTester tester) {
      tester.view.physicalSize = const Size(1440, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
    }

    testWidgets('toolbar texts are separate non-tappable leaves',
        (tester) async {
      useDesktopSurface(tester);
      final handle = tester.ensureSemantics();
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      // Each wrapped toolbar block is its own NON-tappable text leaf.
      final titleData =
          tester.getSemantics(find.text('Cashier Terminal')).getSemanticsData();
      expect(titleData.label, contains('Cashier Terminal'));
      expect(titleData.hasAction(SemanticsAction.tap), isFalse);

      final hintsData = tester
          .getSemantics(find.textContaining('F2 search'))
          .getSemanticsData();
      expect(hintsData.label, contains('F2 search'));
      expect(hintsData.hasAction(SemanticsAction.tap), isFalse);

      final itemsData = tester
          .getSemantics(find.textContaining('items ·'))
          .getSemanticsData();
      expect(itemsData.label, contains('items ·'));
      expect(itemsData.hasAction(SemanticsAction.tap), isFalse);

      handle.dispose();
    });

    testWidgets('catalog footer is a leaf; Load more CTA stays tappable',
        (tester) async {
      useDesktopSurface(tester);
      final handle = tester.ensureSemantics();
      final fake = _FakePosApi()
        ..products = [
          for (var i = 0; i < 35; i++)
            _product('p$i', 'Product $i', sku: 'S$i', price: '10.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      // Footer text is a separate non-tappable leaf.
      final footerData = tester
          .getSemantics(find.textContaining('Enter to add'))
          .getSemanticsData();
      expect(footerData.label, contains('Enter to add'));
      expect(footerData.hasAction(SemanticsAction.tap), isFalse);

      // Load more remains an independently tappable CTA.
      final loadMoreData =
          tester.getSemantics(find.text('Load more')).getSemanticsData();
      expect(loadMoreData.label, contains('Load more'));
      expect(loadMoreData.hasAction(SemanticsAction.tap), isTrue);

      handle.dispose();
    });

    testWidgets(
        'cart header, totals and payment summary are leaves; CTAs stay tappable',
        (tester) async {
      useDesktopSurface(tester);
      final handle = tester.ensureSemantics();
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso', sku: 'ESP', price: '100.00'),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspace(fake));
      await tester.pumpAndSettle();

      // Add the product so totals + payment sections render.
      await tester.tap(find.text('Espresso'));
      await tester.pumpAndSettle();

      final cartData =
          tester.getSemantics(find.text('Cart (1 items)')).getSemanticsData();
      expect(cartData.label, contains('Cart (1 items)'));
      expect(cartData.hasAction(SemanticsAction.tap), isFalse);

      for (final label in ['Subtotal', 'Tax', 'Total', 'Payment', 'Paid']) {
        final data = tester.getSemantics(find.text(label)).getSemanticsData();
        expect(data.label, contains(label),
            reason: '$label must keep its text label');
        expect(data.hasAction(SemanticsAction.tap), isFalse,
            reason: '$label must be a non-tappable text leaf');
      }

      // CTA buttons remain independently tappable semantics nodes.
      final clearData =
          tester.getSemantics(find.text('Clear')).getSemanticsData();
      expect(clearData.hasAction(SemanticsAction.tap), isTrue);

      final openShiftData =
          tester.getSemantics(find.text('Open Shift')).getSemanticsData();
      expect(openShiftData.hasAction(SemanticsAction.tap), isTrue);

      handle.dispose();
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
            unitPrice: const Money(minorUnits: 1000, currency: 'KZT'),
            costPrice: const Money(minorUnits: 500, currency: 'KZT'),
          ),
        ],
        customerId: 'c1',
        customerName: 'Anna',
      );

      await notifier.hold(cart, label: 'Test hold');
      expect(container.read(heldSalesProvider).held.length, 1);
      expect(
        container.read(heldSalesProvider).held.first.total,
        Money.fromMinorUnits(2000, 'KZT'),
      );

      // Real persistence: the payload must exist in SharedPreferences.
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('held_sales_v1');
      expect(raw, isNotNull,
          reason: 'hold must persist the payload to storage');
      final stored = jsonDecode(raw!) as List<dynamic>;
      expect(stored, hasLength(1));
      expect((stored.first as Map<String, dynamic>)['label'], 'Test hold');

      final resumed = await notifier.resume(
        container.read(heldSalesProvider).held.first.id,
      );
      expect(resumed, isNotNull);
      expect(resumed!.items.length, 1);
      expect(resumed.customerName, 'Anna');
      expect(container.read(heldSalesProvider).held, isEmpty);

      // Resuming must also update storage.
      final after = jsonDecode((await SharedPreferences.getInstance())
          .getString('held_sales_v1')!) as List<dynamic>;
      expect(after, isEmpty,
          reason: 'resume must remove the sale from storage');
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

  // ──────────────────────────────────
  // PosWorkspace localization (Phase 3C) — real user-facing strings in RU/KK
  // ──────────────────────────────────
  group('PosWorkspace localization (RU/KK)', () {
    Widget buildWorkspaceLocale(_FakePosApi fake, Locale locale) {
      return ProviderScope(
        overrides: [apiClientProvider.overrideWith((ref) => fake)],
        child: MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: PosWorkspace()),
        ),
      );
    }

    void useDesktopSurface(WidgetTester tester) {
      tester.view.physicalSize = const Size(1440, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
    }

    testWidgets('RU renders localized POS chrome and CTAs stay tappable',
        (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso',
              sku: 'ESP', price: '100.00', category: 'Drinks', stock: 50),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspaceLocale(fake, const Locale('ru')));
      await tester.pumpAndSettle();

      // Toolbar + hints + empty cart + shift strip are localized.
      expect(find.text('Кассовый терминал'), findsOneWidget);
      expect(find.textContaining('F2 поиск'), findsOneWidget);
      expect(find.text('Корзина (0)'), findsOneWidget);
      expect(find.text('Нет открытой смены'), findsOneWidget);

      // Open-shift CTA is tappable and opens the localized dialog.
      await tester.tap(find.text('Открыть смену'));
      await tester.pumpAndSettle();
      expect(find.text('Открыть кассовую смену'), findsOneWidget);
      await tester.tap(find.text('Отмена'));
      await tester.pumpAndSettle();

      // Add a product → localized cart header, totals and payment section.
      await tester.tap(find.text('Espresso'));
      await tester.pumpAndSettle();
      expect(find.text('Корзина (1)'), findsOneWidget);
      expect(find.text('Подытог'), findsOneWidget);
      expect(find.text('Итого'), findsWidgets);
      expect(find.text('Оплата'), findsOneWidget);
      expect(find.text('Оплачено'), findsOneWidget);
      expect(find.textContaining('F9 завершить'), findsWidgets);

      // Enter exact cash so the Complete button enables, then complete.
      await tester.enterText(
        find.byKey(const Key('pos_cash_field')),
        '100.00',
      );
      await tester.pump();
      expect(find.textContaining('Завершить продажу'), findsOneWidget);
      await tester.tap(find.byKey(const Key('pos_complete_button')));
      await tester.pumpAndSettle();
      expect(find.text('Продажа завершена'), findsOneWidget);
      await tester.tap(find.text('Новая продажа'));
      await tester.pumpAndSettle();
    });

    testWidgets(
        'KK renders localized POS chrome with a tappable open-shift CTA',
        (tester) async {
      useDesktopSurface(tester);
      final fake = _FakePosApi()
        ..products = [
          _product('p1', 'Espresso',
              sku: 'ESP', price: '100.00', category: 'Drinks', stock: 50),
        ]
        ..warehouses = [_warehouse()];

      await tester.pumpWidget(buildWorkspaceLocale(fake, const Locale('kk')));
      await tester.pumpAndSettle();

      expect(find.text('Кассалық терминал'), findsOneWidget);
      expect(find.textContaining('F2 іздеу'), findsOneWidget);
      expect(find.text('Себет (0)'), findsOneWidget);
      expect(find.text('Ашық ауысым жоқ'), findsOneWidget);

      await tester.tap(find.text('Ауысымды ашу'));
      await tester.pumpAndSettle();
      expect(find.text('Кассалық ауысымды ашу'), findsOneWidget);
      await tester.tap(find.text('Болдырмау'));
      await tester.pumpAndSettle();
    });
  });
}
