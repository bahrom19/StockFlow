import 'package:flutter/widgets.dart' show Locale;
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/action_center.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/attention_event.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

void main() {
  group('PurchasingSummary', () {
    test('should parse summary JSON with byStatus', () {
      final summary = PurchasingSummary.fromJson({
        'totalOrders': 12,
        'totalValue': '34500.0000',
        'byStatus': {
          'DRAFT': 3,
          'PENDING': 2,
          'APPROVED': 1,
          'ORDERED': 4,
          'PARTIALLY_RECEIVED': 1,
          'RECEIVED': 1,
          'CANCELLED': 0,
        },
      });

      expect(summary.totalOrders, 12);
      expect(summary.totalValue, '34500.0000');
      expect(summary.byStatus['PENDING'], 2);
      // Strictly PENDING + ORDERED (approved decision — APPROVED and
      // PARTIALLY_RECEIVED are NOT counted).
      expect(summary.pendingPoCount, 6);
    });

    test('should handle empty byStatus (default)', () {
      final summary = PurchasingSummary.fromJson({
        'totalOrders': 0,
        'totalValue': '0.0000',
      });

      expect(summary.byStatus, isEmpty);
      expect(summary.pendingPoCount, 0);
    });

    test('should handle missing status keys as zero', () {
      final summary = PurchasingSummary.fromJson({
        'totalOrders': 0,
        'totalValue': '0.0000',
        'byStatus': {'RECEIVED': 5},
      });

      expect(summary.pendingPoCount, 0);
    });
  });

  group('buildAttentionEvents — event #4 (pending POs)', () {
    DashboardSummary summary({
      int lowStock = 0,
      int outOfStock = 0,
      int ordersCount = 0,
      int customerCount = 0,
      String inventoryValue = '0',
    }) {
      return DashboardSummary(
        todaySales: const DaySales(revenue: '0', count: 0),
        yesterdaySales: const DaySales(revenue: '0', count: 0),
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
      int pendingPoCount = 0,
    }) {
      return buildAttentionEvents(
        l10n: lookupAppLocalizations(const Locale('en')),
        summary: s ?? summary(),
        shiftState: const ShiftLoaded(),
        warehouseState: const WarehouseListLoaded(warehouses: []),
        pendingPoCount: pendingPoCount,
      )..sort(compareAttentionEvents);
    }

    AttentionEvent? pendingPoEvent(List<AttentionEvent> events) {
      for (final e in events) {
        if (e.title.contains('awaiting action')) return e;
      }
      return null;
    }

    test('PENDING > 0 → event appears', () {
      final events = build(pendingPoCount: 2);
      final event = pendingPoEvent(events);
      expect(event, isNotNull);
      expect(event!.title, '2 purchase orders awaiting action');
      expect(event.reason, contains('PENDING'));
      expect(event.reason, contains('ORDERED'));
      expect(event.ctaLabel, 'View orders');
      expect(event.ctaRoute, isNotNull);
    });

    test('ORDERED > 0 → event appears', () {
      final events = build(pendingPoCount: 1);
      final event = pendingPoEvent(events);
      expect(event, isNotNull);
      expect(event!.title, '1 purchase order awaiting action');
    });

    test('PENDING + ORDERED → sum is correct', () {
      // 3 PENDING + 4 ORDERED = 7 — mirrors PurchasingSummary.pendingPoCount.
      final s = summary();
      final events = buildAttentionEvents(
        l10n: lookupAppLocalizations(const Locale('en')),
        summary: s,
        shiftState: const ShiftLoaded(),
        warehouseState: const WarehouseListLoaded(warehouses: []),
        pendingPoCount: 7,
      )..sort(compareAttentionEvents);
      expect(pendingPoEvent(events)!.title, '7 purchase orders awaiting action');
    });

    test('both 0 → no event', () {
      final events = build();
      expect(pendingPoEvent(events), isNull);
    });

    test('loading/error (count not known) → no event', () {
      // pendingPoCount defaults to 0 when the purchasing summary is null
      // (loading or failed) — per spec no false "0 orders" event.
      final events = build();
      expect(pendingPoEvent(events), isNull);
    });

    test('event vanishes at 0 alongside other attention events', () {
      final s = summary(lowStock: 3);
      final events = buildAttentionEvents(
        l10n: lookupAppLocalizations(const Locale('en')),
        summary: s,
        shiftState: const ShiftLoaded(),
        warehouseState: const WarehouseListLoaded(warehouses: []),
      )..sort(compareAttentionEvents);
      expect(pendingPoEvent(events), isNull);
      // Other events still present.
      expect(events.where((e) => e.title.contains('low on stock')), isNotEmpty);
    });
  });
}
