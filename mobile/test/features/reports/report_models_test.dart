import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/reports/domain/report_models.dart';
import 'package:stockflow/features/reports/presentation/providers/reports_providers.dart';

void main() {
  group('TopProductsResponse', () {
    test('parses valid JSON with items', () {
      final json = {
        'items': [
          {
            'productId': 'p1',
            'productName': 'Widget',
            'sku': 'W001',
            'quantitySold': 42,
            'revenue': '8400.0000',
            'profit': '2100.0000',
            'margin': '25.0',
          },
        ],
        'total': 1,
      };
      final result = TopProductsResponse.fromJson(json);
      expect(result.items.length, 1);
      expect(result.items.first.productName, 'Widget');
      expect(result.items.first.quantitySold, 42);
      expect(result.total, 1);
    });

    test('parses empty items', () {
      final json = {'items': <dynamic>[], 'total': 0};
      final result = TopProductsResponse.fromJson(json);
      expect(result.items, isEmpty);
      expect(result.total, 0);
    });

    test('handles missing optional fields with defaults', () {
      final json = {
        'items': [
          {
            'productId': 'p1',
            'productName': 'Widget',
            'revenue': '100',
            'profit': '50',
            'margin': '50',
          },
        ],
        'total': 1,
      };
      final result = TopProductsResponse.fromJson(json);
      expect(result.items.first.sku, '');
      expect(result.items.first.quantitySold, 0);
    });
  });

  group('InventoryValuationResponse', () {
    test('parses valid JSON', () {
      final json = {
        'items': [
          {
            'productId': 'p1',
            'productName': 'Widget',
            'sku': 'W001',
            'quantity': 100,
            'averageCost': '15.50',
            'inventoryValue': '1550.00',
          },
        ],
        'totalValue': '1550.00',
        'total': 1,
        'page': 1,
        'limit': 50,
      };
      final result = InventoryValuationResponse.fromJson(json);
      expect(result.items.length, 1);
      expect(result.totalValue, '1550.00');
      expect(result.total, 1);
    });

    test('parses empty response', () {
      final json = {
        'items': <dynamic>[],
        'totalValue': '0',
        'total': 0,
        'page': 1,
        'limit': 50,
      };
      final result = InventoryValuationResponse.fromJson(json);
      expect(result.items, isEmpty);
    });
  });

  group('CustomerReportResponse', () {
    test('parses valid JSON', () {
      final json = {
        'items': [
          {
            'customerId': 'c1',
            'name': 'John Doe',
            'email': 'john@example.com',
            'phone': '+77001234567',
            'orders': 5,
            'revenue': '25000.0000',
            'averageReceipt': '5000.0000',
            'lastPurchase': '2026-01-15T10:00:00.000Z',
          },
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
      };
      final result = CustomerReportResponse.fromJson(json);
      expect(result.items.length, 1);
      expect(result.items.first.name, 'John Doe');
      expect(result.items.first.orders, 5);
    });

    test('handles null fields', () {
      final json = {
        'items': [
          {
            'customerId': 'c1',
            'name': 'John',
          },
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
      };
      final result = CustomerReportResponse.fromJson(json);
      expect(result.items.first.email, isNull);
      expect(result.items.first.phone, isNull);
      expect(result.items.first.lastPurchase, isNull);
      expect(result.items.first.orders, 0);
    });
  });

  group('SupplierReportResponse', () {
    test('parses valid JSON', () {
      final json = {
        'items': [
          {
            'supplierId': 's1',
            'companyName': 'Acme Corp',
            'email': 'info@acme.com',
            'phone': '+77009876543',
            'purchaseOrders': 3,
            'purchaseTotal': '75000.0000',
            'lastPurchase': '2026-02-01T12:00:00.000Z',
          },
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
      };
      final result = SupplierReportResponse.fromJson(json);
      expect(result.items.length, 1);
      expect(result.items.first.companyName, 'Acme Corp');
      expect(result.items.first.purchaseOrders, 3);
    });
  });

  group('CashShiftReportResponse', () {
    test('parses valid JSON', () {
      final json = {
        'items': [
          {
            'id': 'cs1',
            'status': 'CLOSED',
            'openedAt': '2026-01-15T09:00:00.000Z',
            'closedAt': '2026-01-15T18:00:00.000Z',
            'warehouseName': 'Main Store',
            'cashierName': 'Alice',
            'openingBalance': '50000.0000',
            'closingBalance': '125000.0000',
            'cashSales': '75000.0000',
            'cardSales': '30000.0000',
            'qrSales': '10000.0000',
            'bankTransferSales': '0.0000',
            'mobileWalletSales': '0.0000',
            'totalSales': '115000.0000',
            'cashIn': '5000.0000',
            'cashOut': '0.0000',
            'expectedClosing': '130000.0000',
            'difference': '-5000.0000',
            'notes': null,
          },
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
      };
      final result = CashShiftReportResponse.fromJson(json);
      expect(result.items.length, 1);
      final shift = result.items.first;
      expect(shift.id, 'cs1');
      expect(shift.status, 'CLOSED');
      expect(shift.isOpen, false);
      expect(shift.totalSalesAmount, 115000.0);
      expect(shift.differenceAmount, -5000.0);
    });

    test('open shift has isOpen = true', () {
      final json = {
        'items': [
          {
            'id': 'cs2',
            'status': 'OPEN',
            'openedAt': '2026-01-15T09:00:00.000Z',
            'closedAt': null,
            'warehouseName': 'Main',
            'cashierName': 'Bob',
            'openingBalance': '0',
            'closingBalance': '0',
            'totalSales': '0',
            'expectedClosing': '0',
            'difference': '0',
          },
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
      };
      final result = CashShiftReportResponse.fromJson(json);
      expect(result.items.first.isOpen, true);
    });
  });

  group('ReportState', () {
    test('ReportLoading has empty message', () {
      const state = ReportLoading<String>();
      expect(state.message, '');
    });

    test('ReportError stores message', () {
      const state = ReportError<String>('Something failed');
      expect(state.message, 'Something failed');
    });

    test('ReportData copyWith preserves data', () {
      final original = ReportData<String>('hello');
      final copied = original.copyWith(isRefreshing: true);
      expect(copied.data, 'hello');
      expect(copied.isRefreshing, true);
    });

    test('ReportData copyWith preserves isRefreshing when not specified', () {
      final original = ReportData<String>('hello', isRefreshing: true);
      final copied = original.copyWith();
      expect(copied.isRefreshing, true);
    });

    test('ReportData copyWith can reset isRefreshing', () {
      final original = ReportData<String>('hello', isRefreshing: true);
      final copied = original.copyWith(isRefreshing: false);
      expect(copied.isRefreshing, false);
    });

    test('ReportEmpty has empty message', () {
      const state = ReportEmpty<String>();
      expect(state.message, '');
    });
  });
}
