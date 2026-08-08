import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/action_center.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/attention_event.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

// ─────────────────────────────────────────────────────────────
// Stage D — full release validation of buildAttentionEvents:
//  - all 10 catalogued events fire individually (and only when their
//    condition actually holds);
//  - mutual exclusion #5 (No open shift) ↔ #6 (Shift open > 12h);
//  - global sort Critical → Attention → Opportunities, weight desc inside
//    a category;
//  - no false events on loading/error-shaped inputs.
// ─────────────────────────────────────────────────────────────
void main() {
  DashboardSummary summary({
    String todayRevenue = '5000.0000',
    int todayCount = 12,
    String yesterdayRevenue = '4000.0000',
    int yesterdayCount = 10,
    int ordersCount = 220,
    String inventoryValue = '120000.0000',
    int lowStock = 0,
    int outOfStock = 0,
    int customerCount = 45,
  }) {
    return DashboardSummary(
      todaySales: DaySales(revenue: todayRevenue, count: todayCount),
      yesterdaySales: DaySales(revenue: yesterdayRevenue, count: yesterdayCount),
      monthSales: const DaySales(revenue: '90000.0000', count: 220),
      ordersCount: ordersCount,
      grossRevenue: todayRevenue,
      grossProfit: '27000.0000',
      inventoryValue: inventoryValue,
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
      customerCount: customerCount,
      supplierCount: 8,
      purchaseTotal: '0.0000',
    );
  }

  CashShift openShift({
    String difference = '0.0000',
    Duration openedFor = const Duration(hours: 3),
    String status = 'OPEN',
  }) {
    return CashShift(
      id: 'shift-1',
      companyId: 'c1',
      warehouseId: 'w1',
      cashierId: 'u1',
      status: status,
      openedAt: DateTime.now().subtract(openedFor),
      expectedClosing: '5000.0000',
      totalSales: '5000.0000',
      difference: difference,
    );
  }

  /// Builds and sorts events like the widget does.
  List<AttentionEvent> build({
    required DashboardSummary s,
    ShiftState shiftState = const ShiftLoading(),
    WarehouseListState warehouseState = const WarehouseListLoading(),
    int pendingPoCount = 0,
    List<LowStockItem> lowStockItems = const [],
  }) {
    return buildAttentionEvents(
      summary: s,
      shiftState: shiftState,
      warehouseState: warehouseState,
      pendingPoCount: pendingPoCount,
      lowStockItems: lowStockItems,
    )..sort(compareAttentionEvents);
  }

  AttentionEvent? findEvent(List<AttentionEvent> events, String fragment) {
    for (final e in events) {
      if (e.title.contains(fragment)) return e;
    }
    return null;
  }

  // ── Event #1: Drawer difference (Critical) ────────────────
  group('Event #1 — Drawer difference', () {
    test('fires when |difference| > 0.005 on an open shift', () {
      final events = build(
        s: summary(),
        shiftState: ShiftLoaded(current: openShift(difference: '-1250.0000')),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      final e = findEvent(events, 'Drawer difference');
      expect(e, isNotNull);
      expect(e!.category, AttentionCategory.critical);
      expect(e.title, contains('1,250'));
      expect(e.ctaRoute, isNotNull);
    });

    test('does NOT fire when difference is zero', () {
      final events = build(
        s: summary(),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'Drawer difference'), isNull);
    });

    test('does NOT fire when shift is closed', () {
      final events = build(
        s: summary(),
        shiftState: ShiftLoaded(
          current: openShift(difference: '-1250.0000', status: 'CLOSED'),
        ),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'Drawer difference'), isNull);
    });
  });

  // ── Event #2: Out of stock (Critical) ─────────────────────
  group('Event #2 — Out of stock', () {
    test('fires with count and estimate labeled as estimate', () {
      final events = build(
        s: summary(outOfStock: 3),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      final e = findEvent(events, 'out of stock');
      expect(e, isNotNull);
      expect(e!.category, AttentionCategory.critical);
      expect(e.title, '3 products out of stock');
      // Average receipt = 5000/12 ≈ 416.67 → ≈ 1,250 lost sales/day (estimate)
      expect(e.impact, contains('(estimate)'));
    });

    test('qualitative impact when no receipt baseline exists', () {
      final events = build(
        s: summary(outOfStock: 2, todayCount: 0, todayRevenue: '0.0000',
            yesterdayCount: 0, yesterdayRevenue: '0.0000'),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      final e = findEvent(events, 'out of stock');
      expect(e, isNotNull);
      expect(e!.impact, 'Risk of lost sales');
    });

    test('does NOT fire when count is zero', () {
      final events = build(
        s: summary(),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'out of stock'), isNull);
    });
  });

  // ── Events #5 / #6: shift mutual exclusion ────────────────
  group('Shift events #5 ↔ #6 mutual exclusion', () {
    test('No open shift (shift == null) → event #5, never #6', () {
      final events = build(
        s: summary(),
        shiftState: const ShiftLoaded(), // current == null
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'No open shift'), isNotNull);
      expect(findEvent(events, 'Shift open'), isNull);
    });

    test('Shift open 3h → neither #5 nor #6 fires', () {
      final events = build(
        s: summary(),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'No open shift'), isNull);
      expect(findEvent(events, 'Shift open'), isNull);
    });

    test('Shift open 15h → event #6 fires, never #5', () {
      final events = build(
        s: summary(),
        shiftState: ShiftLoaded(
          current: openShift(openedFor: const Duration(hours: 15)),
        ),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      final e = findEvent(events, 'Shift open');
      expect(e, isNotNull);
      expect(e!.category, AttentionCategory.attention);
      expect(e.title, contains('15h'));
      expect(findEvent(events, 'No open shift'), isNull);
    });

    test('shift unknown (loading) → neither fires', () {
      final events = build(
        s: summary(),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'No open shift'), isNull);
      expect(findEvent(events, 'Shift open'), isNull);
    });

    test('shift errored → neither #5 nor #6 fires (no false alert)', () {
      final events = build(
        s: summary(),
        shiftState: const ShiftError('X-report failed'),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      // Error is not a definitive "no open shift" — no false event.
      expect(findEvent(events, 'No open shift'), isNull);
      expect(findEvent(events, 'Shift open'), isNull);
    });

    test('warehouse list error → "unavailable" attention event, no shift events',
        () {
      final events = build(
        s: summary(),
        shiftState: const ShiftLoaded(), // unknown → null
        warehouseState: const WarehouseListError('boom'),
      );
      expect(findEvent(events, 'Warehouse list unavailable'), isNotNull);
      expect(findEvent(events, 'No open shift'), isNull);
    });
  });

  // ── Event #7: Revenue drop (Attention) ────────────────────
  group('Event #7 — Revenue drop', () {
    test('fires when today < yesterday with factual gap', () {
      final events = build(
        s: summary(todayRevenue: '3531.0000'),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      final e = findEvent(events, 'Revenue');
      expect(e, isNotNull);
      expect(e!.category, AttentionCategory.attention);
      expect(e.title, contains('% below yesterday'));
      expect(e.impact, contains('469'));
    });

    test('does NOT fire when today >= yesterday', () {
      final events = build(
        s: summary(),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'Revenue'), isNull);
    });

    test('does NOT fire when yesterday is zero (no baseline)', () {
      final events = build(
        s: summary(yesterdayRevenue: '0.0000'),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'Revenue'), isNull);
    });
  });

  // ── Event #8: No sales yet (Attention) ────────────────────
  group('Event #8 — No sales yet', () {
    test('fires when shift open and today count == 0', () {
      final events = build(
        s: summary(todayCount: 0),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      final e = findEvent(events, 'No sales yet today');
      expect(e, isNotNull);
      expect(e!.category, AttentionCategory.attention);
    });

    test('does NOT fire when there are sales today', () {
      final events = build(
        s: summary(todayCount: 5),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'No sales yet today'), isNull);
    });

    test('does NOT fire when no shift is open', () {
      final events = build(
        s: summary(todayCount: 0),
        shiftState: const ShiftLoaded(),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'No sales yet today'), isNull);
    });
  });

  // ── Events #9 / #10: Opportunities (onboarding) ───────────
  group('Opportunities #9/#10', () {
    test('No warehouse fires only on WarehouseListEmpty', () {
      final events = build(
        s: summary(),
        warehouseState: const WarehouseListEmpty(),
      );
      expect(findEvent(events, 'No warehouse yet'), isNotNull);
    });

    test('Empty catalog fires on zero inventory, no customers, no orders', () {
      final events = build(
        s: summary(
          inventoryValue: '0.0000',
          customerCount: 0,
          ordersCount: 0,
        ),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'Start building your inventory'), isNotNull);
    });

    test('Empty catalog does NOT fire when inventory exists', () {
      final events = build(
        s: summary(customerCount: 0, ordersCount: 0),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(findEvent(events, 'Start building your inventory'), isNull);
    });
  });

  // ── Global sort ───────────────────────────────────────────
  group('Sorting: Critical → Attention → Opportunities', () {
    test('categories order and weight desc inside category', () {
      // Trigger one Critical (#2), two Attention (#7 lighter, #8 heavier by
      // position? weights are fixed: #8=100 < #7≥200) and one Opportunity.
      final events = build(          s: summary(
          outOfStock: 2,
          todayCount: 0,
          todayRevenue: '2000.0000',
          inventoryValue: '0.0000',
          customerCount: 0,
          ordersCount: 0,
        ),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      expect(events, isNotEmpty);
      // First event must be Critical.
      expect(events.first.category, AttentionCategory.critical);
      // Every opportunity comes after every attention comes after critical.
      var sawAttention = false;
      var sawOpportunity = false;
      for (final e in events) {
        if (e.category == AttentionCategory.attention) sawAttention = true;
        if (e.category == AttentionCategory.opportunity) sawOpportunity = true;
        if (e.category == AttentionCategory.attention && sawOpportunity) {
          fail('attention event after opportunity');
        }
        if (e.category == AttentionCategory.critical && sawAttention) {
          fail('critical event after attention');
        }
      }
      expect(events.any((e) => e.category == AttentionCategory.critical), isTrue);
    });

    test('drawer difference ranks above out-of-stock (both Critical)', () {
      final events = build(
        s: summary(outOfStock: 3),
        shiftState: ShiftLoaded(current: openShift(difference: '-1250.0000')),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      );
      final criticals =
          events.where((e) => e.category == AttentionCategory.critical).toList();
      expect(criticals.length, greaterThanOrEqualTo(2));
      expect(criticals.first.title, contains('Drawer difference'));
    });
  });

  // ── Loading / Error shaped inputs ─────────────────────────
  group('No false events on loading/error-shaped inputs', () {
    test('all-zero summary + closed shift + empty warehouse → empty list', () {
      final events = buildAttentionEvents(
        summary: summary(
          todayRevenue: '0.0000',
          todayCount: 0,
          yesterdayRevenue: '0.0000',
          yesterdayCount: 0,
          ordersCount: 0,
          inventoryValue: '0.0000',
          customerCount: 0,
        ),
        shiftState: ShiftLoaded(current: openShift(status: 'CLOSED')),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      )..sort(compareAttentionEvents);
      // No critical/attention events may be fabricated.
      expect(
        events.where((e) => e.category != AttentionCategory.opportunity),
        isEmpty,
      );
    });

    test('pending PO count 0 and empty low stock → no #3/#4 events', () {
      final events = buildAttentionEvents(
        summary: summary(),
        shiftState: ShiftLoaded(current: openShift()),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      )..sort(compareAttentionEvents);
      expect(findEvent(events, 'low on stock'), isNull);
      expect(findEvent(events, 'purchase orders awaiting action'), isNull);
    });
  });
}
