import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';

void main() {
  group('DashboardSummary', () {
    test('should parse from JSON correctly', () {
      final json = {
        'todaySales': {
          'revenue': '1500.0000',
          'count': 12,
          'averageReceipt': '125.0000',
        },
        'yesterdaySales': {
          'revenue': '1200.0000',
          'count': 10,
        },
        'monthSales': {
          'revenue': '45000.0000',
          'count': 340,
        },
        'ordersCount': 450,
        'grossRevenue': '95000.0000',
        'grossProfit': '28500.0000',
        'inventoryValue': '125000.0000',
        'lowStockProducts': 5,
        'outOfStockProducts': 2,
        'customerCount': 89,
        'supplierCount': 23,
        'purchaseTotal': '32000.0000',
      };

      final summary = DashboardSummary.fromJson(json);

      expect(summary.todaySales.revenue, '1500.0000');
      expect(summary.todaySales.count, 12);
      expect(summary.todaySales.averageReceipt, '125.0000');
      expect(summary.yesterdaySales.revenue, '1200.0000');
      expect(summary.monthSales.count, 340);
      expect(summary.ordersCount, 450);
      expect(summary.grossRevenue, '95000.0000');
      expect(summary.grossProfit, '28500.0000');
      expect(summary.inventoryValue, '125000.0000');
      expect(summary.lowStockProducts, 5);
      expect(summary.outOfStockProducts, 2);
      expect(summary.customerCount, 89);
      expect(summary.supplierCount, 23);
      expect(summary.purchaseTotal, '32000.0000');
    });

    test('should handle zero values', () {
      final json = {
        'todaySales': {'revenue': '0.0000', 'count': 0},
        'yesterdaySales': {'revenue': '0.0000', 'count': 0},
        'monthSales': {'revenue': '0.0000', 'count': 0},
        'ordersCount': 0,
        'grossRevenue': '0.0000',
        'grossProfit': '0.0000',
        'inventoryValue': '0.0000',
        'lowStockProducts': 0,
        'outOfStockProducts': 0,
        'customerCount': 0,
        'supplierCount': 0,
        'purchaseTotal': '0.0000',
      };

      final summary = DashboardSummary.fromJson(json);
      expect(summary.todaySales.revenue, '0.0000');
      expect(summary.ordersCount, 0);
    });
  });

  group('RecentSale', () {
    test('should parse from JSON correctly', () {
      final json = {
        'id': 'sale-1',
        'saleNumber': 'SALE-001',
        'createdAt': '2026-07-27T10:30:00Z',
        'status': 'COMPLETED',
        'total': '250.0000',
        'paidAmount': '250.0000',
      };

      final sale = RecentSale.fromJson(json);

      expect(sale.id, 'sale-1');
      expect(sale.saleNumber, 'SALE-001');
      expect(sale.status, 'COMPLETED');
      expect(sale.total, '250.0000');
    });
  });

  group('ProfitReport', () {
    test('should parse from JSON with daily data', () {
      final json = {
        'summary': {
          'revenue': '95000.0000',
          'cost': '66500.0000',
          'profit': '28500.0000',
          'margin': '30.0000',
        },
        'daily': [
          {
            'date': '2026-07-20',
            'revenue': '3200.0000',
            'cost': '2240.0000',
            'profit': '960.0000',
            'margin': '30.0000',
          },
          {
            'date': '2026-07-21',
            'revenue': '4100.0000',
            'cost': '2870.0000',
            'profit': '1230.0000',
            'margin': '30.0000',
          },
        ],
        'weekly': [],
        'monthly': [],
      };

      final report = ProfitReport.fromJson(json);

      expect(report.summary.revenue, '95000.0000');
      expect(report.summary.profit, '28500.0000');
      expect(report.daily.length, 2);
      expect(report.daily[0].date, '2026-07-20');
      expect(report.daily[0].revenue, '3200.0000');
    });
  });

  group('ChartDataPoint', () {
    test('should create chart data point', () {
      final point = ChartDataPoint(
        label: '07-20',
        revenue: 3200.0,
        profit: 960.0,
      );

      expect(point.label, '07-20');
      expect(point.revenue, 3200.0);
      expect(point.profit, 960.0);
    });
  });

  group('DaySales', () {
    test('should handle missing averageReceipt', () {
      final json = {
        'revenue': '1500.0000',
        'count': 12,
      };

      final daySales = DaySales.fromJson(json);
      expect(daySales.revenue, '1500.0000');
      expect(daySales.count, 12);
      expect(daySales.averageReceipt, null);
    });
  });
}
