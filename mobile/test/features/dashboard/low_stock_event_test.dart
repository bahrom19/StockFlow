import 'package:flutter/widgets.dart' show Locale;
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/action_center.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/attention_event.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

AppLocalizations _l10n() => lookupAppLocalizations(const Locale('en'));

void main() {
  LowStockItem item({
    String name = 'Product',
    String sku = 'SKU-0',
    int stock = 1,
    int min = 5,
    String warehouse = 'Main',
    String status = 'LOW_STOCK',
  }) {
    return LowStockItem(
      productId: 'id-$sku',
      productName: name,
      sku: sku,
      currentStock: stock,
      minQuantity: min,
      warehouseId: 'wh-1',
      warehouseName: warehouse,
      status: status,
    );
  }

  group('LowStockItem', () {
    test('should parse from JSON', () {
      final i = LowStockItem.fromJson({
        'productId': 'p1',
        'productName': 'Laptop Stand',
        'sku': 'SKU-001',
        'currentStock': 2,
        'minQuantity': 5,
        'warehouseId': 'wh1',
        'warehouseName': 'Main Store',
        'status': 'LOW_STOCK',
      });

      expect(i.productName, 'Laptop Stand');
      expect(i.currentStock, 2);
      expect(i.deficit, 3); // 5 − 2
      expect(i.isLowStock, isTrue);
    });

    test('deficit is computed as minQuantity − currentStock', () {
      expect(item(stock: 5).deficit, 0);
      expect(item(min: 10).deficit, 9);
      expect(item(stock: 4, min: 3).deficit, -1);
    });

    test('OUT_OF_STOCK is not low stock', () {
      final i = item(stock: 0, status: 'OUT_OF_STOCK');
      expect(i.isLowStock, isFalse);
    });
  });

  group('sortLowStockByDeficit', () {
    test('sorts by largest deficit first (deterministic)', () {
      final items = [
        item(name: 'B', sku: 'S2', stock: 2, warehouse: 'W1'), // deficit 3
        item(name: 'A', sku: 'S1', min: 10, warehouse: 'W2'), // deficit 9
        item(name: 'C', sku: 'S3', stock: 4, warehouse: 'W3'), // deficit 1
      ];

      final sorted = sortLowStockByDeficit(items);

      expect(sorted[0].sku, 'S1'); // deficit 9
      expect(sorted[1].sku, 'S2'); // deficit 3
      expect(sorted[2].sku, 'S3'); // deficit 1
    });

    test('ties broken by product name (asc), then SKU (asc)', () {
      final items = [
        item(name: 'Zeta', sku: 'S2', stock: 2),
        item(name: 'Alpha', sku: 'S1', stock: 2),
        item(name: 'Alpha', sku: 'S0', stock: 2),
      ];

      final sorted = sortLowStockByDeficit(items);

      expect(sorted[0].sku, 'S0'); // same deficit+name → SKU asc
      expect(sorted[1].sku, 'S1');
      expect(sorted[2].sku, 'S2'); // same deficit → name asc
    });

    test('excludes OUT_OF_STOCK items', () {
      final items = [
        item(name: 'Out', sku: 'S9', stock: 0, status: 'OUT_OF_STOCK'),
        item(name: 'Low', sku: 'S1', stock: 2),
      ];

      final sorted = sortLowStockByDeficit(items);

      expect(sorted.map((i) => i.sku), ['S1']);
    });

    test('empty input → empty output', () {
      expect(sortLowStockByDeficit(const []), isEmpty);
    });
  });

  group('lowStockDetailLines', () {
    test('limits to top-3', () {
      final items = [
        item(name: 'A', sku: 'S1', min: 10, warehouse: 'W1'),
        item(name: 'B', sku: 'S2', stock: 2, warehouse: 'W2'),
        item(name: 'C', sku: 'S3', stock: 3, warehouse: 'W3'),
        item(name: 'D', sku: 'S4', stock: 4, warehouse: 'W4'),
      ];

      final lines = lowStockDetailLines(items);

      expect(lines.length, 3);
      expect(lines[0], contains('A'));
      expect(lines[0], contains('S1'));
      expect(lines[0], contains('1/10'));
      expect(lines[0], contains('W1'));
    });

    test('empty list → empty lines (no invented items)', () {
      expect(lowStockDetailLines(const []), isEmpty);
    });
  });

  group('lowStockMoreNote', () {
    test('null when the low-stock set fits in the shown top items', () {
      final items = [
        item(name: 'A', sku: 'S1', min: 10, warehouse: 'W1'),
        item(name: 'B', sku: 'S2', stock: 2, warehouse: 'W2'),
        item(name: 'C', sku: 'S3', stock: 3, warehouse: 'W3'),
      ];

      expect(lowStockMoreNote(items, l10n: _l10n()), isNull);
    });

    test('null on empty input (not loaded)', () {
      expect(lowStockMoreNote(const [], l10n: _l10n()), isNull);
    });

    test('4 low-stock items → +1 more', () {
      final items = [
        item(name: 'A', sku: 'S1', min: 10, warehouse: 'W1'),
        item(name: 'B', sku: 'S2', stock: 2, warehouse: 'W2'),
        item(name: 'C', sku: 'S3', stock: 3, warehouse: 'W3'),
        item(name: 'D', sku: 'S4', stock: 4, warehouse: 'W4'),
      ];

      expect(lowStockMoreNote(items, l10n: _l10n()), '+1 more');
    });

    test('6 low-stock items → +3 more', () {
      final items = List.generate(6, (i) => item(sku: 'S$i', stock: i));
      expect(lowStockMoreNote(items, l10n: _l10n()), '+3 more');
    });

    test('OUT_OF_STOCK items do not count towards the footer', () {
      final items = [
        item(name: 'A', sku: 'S1', min: 10, warehouse: 'W1'),
        item(name: 'B', sku: 'S2', stock: 2, warehouse: 'W2'),
        item(name: 'C', sku: 'S3', stock: 3, warehouse: 'W3'),
        item(name: 'Out', sku: 'S9', stock: 0, status: 'OUT_OF_STOCK'),
      ];

      // Only 3 LOW_STOCK items → footer is null despite 4 rows in input.
      expect(lowStockMoreNote(items, l10n: _l10n()), isNull);
    });
  });

  group('buildAttentionEvents — event #3 (low stock)', () {
    DashboardSummary summary({
      int lowStock = 0,
      int outOfStock = 0,
      int ordersCount = 0,
      int customerCount = 0,
      String inventoryValue = '0',
      String todayRevenue = '0',
      int todayCount = 0,
      String yesterdayRevenue = '0',
    }) {
      return DashboardSummary(
        todaySales: DaySales(revenue: todayRevenue, count: todayCount),
        yesterdaySales: DaySales(revenue: yesterdayRevenue, count: 0),
        monthSales: const DaySales(revenue: '0', count: 0),
        ordersCount: ordersCount,
        grossRevenue: '0',
        grossProfit: '0',
        inventoryValue: inventoryValue,
        lowStockProducts: lowStock,
        outOfStockProducts: outOfStock,
        customerCount: customerCount,
        supplierCount: 0,
        purchaseTotal: '0',
      );
    }

    List<AttentionEvent> build({
      DashboardSummary? s,
      List<LowStockItem> lowStockItems = const [],
    }) {
      return buildAttentionEvents(
        l10n: _l10n(),
        summary: s ?? summary(),
        shiftState: const ShiftLoaded(),
        warehouseState: const WarehouseListLoaded(warehouses: []),
        lowStockItems: lowStockItems,
      )..sort(compareAttentionEvents);
    }

    AttentionEvent? lowStockEvent(List<AttentionEvent> events) {
      for (final e in events) {
        if (e.title.contains('low on stock')) return e;
      }
      return null;
    }

    test('shows top-3 detail sorted by deficit', () {
      final events = build(
        s: summary(lowStock: 3),
        lowStockItems: [
          item(name: 'B', sku: 'S2', stock: 2, warehouse: 'W1'), // deficit 3
          item(name: 'A', sku: 'S1', min: 10, warehouse: 'W2'), // deficit 9
          item(name: 'C', sku: 'S3', stock: 4, warehouse: 'W3'), // deficit 1
        ],
      );

      final event = lowStockEvent(events);
      expect(event, isNotNull);
      expect(event!.details, isNotNull);
      expect(event.details!.length, 3);
      // Largest deficit first.
      expect(event.details![0], contains('A'));
      expect(event.details![0], contains('S1'));
      expect(event.details![1], contains('B'));
      expect(event.details![2], contains('C'));
      // CTA → inventory screen.
      expect(event.ctaLabel, 'Review stock');
      expect(event.ctaRoute, isNotNull);
    });

    test('0 products → no event', () {
      final events = build();
      expect(lowStockEvent(events), isNull);
    });

    test('Loading/Error (no items loaded) → event without detail lines', () {
      // lowStockProducts > 0 from the summary, but the item list is empty
      // (loading or failed) — the event stays but must not invent items.
      final events = build(s: summary(lowStock: 2));
      final event = lowStockEvent(events);
      expect(event, isNotNull);
      expect(event!.details, isEmpty);
      expect(event.detailsMore, isNull);
      expect(event.title, '2 products low on stock');
    });

    test('more than 3 low-stock items → +N more footer', () {
      final events = build(
        s: summary(lowStock: 5),
        lowStockItems: List.generate(5, (i) => item(sku: 'S$i', stock: i)),
      );

      final event = lowStockEvent(events);
      expect(event, isNotNull);
      expect(event!.details!.length, 3); // top-3 stays the main content
      expect(event.detailsMore, '+2 more');
    });

    test('exactly 3 low-stock items → no footer', () {
      final events = build(
        s: summary(lowStock: 3),
        lowStockItems: List.generate(3, (i) => item(sku: 'S$i', stock: i)),
      );

      final event = lowStockEvent(events);
      expect(event, isNotNull);
      expect(event!.detailsMore, isNull);
    });

    test('impact estimate for out-of-stock is labelled and honest', () {
      // With a receipt baseline → estimate labelled.
      final withAvg = build(
        s: summary(
          outOfStock: 3,
          todayRevenue: '1500',
          todayCount: 10, // avg receipt 150
        ),
      );
      final outEvent = withAvg
          .where((e) => e.title.contains('out of stock'))
          .first;
      expect(outEvent.impact, contains('(estimate)'));
      expect(outEvent.impact, contains('450')); // 3 × 150

      // Without a receipt baseline → qualitative only, no invented $X.
      final noAvg = build(s: summary(outOfStock: 3));
      final outEvent2 = noAvg
          .where((e) => e.title.contains('out of stock'))
          .first;
      expect(outEvent2.impact, 'Risk of lost sales');
      expect(outEvent2.impact, isNot(contains('currency')));
    });

    test('actual impact values are not distorted', () {
      // Revenue behind yesterday is the exact difference.
      final events = build(
        s: summary(
          todayRevenue: '1000',
          todayCount: 5,
          yesterdayRevenue: '5000',
        ),
      );
      final rev = events
          .where((e) => e.title.contains('below yesterday'))
          .first;
      expect(rev.impact, contains('4,000.00')); // 5000 − 1000, exact
    });
  });
}
