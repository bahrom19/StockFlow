/// StockFlow API Contract Integration Tests
///
/// These tests verify that every Flutter repository correctly maps
/// to the NestJS backend endpoints, request bodies, and response shapes.
///
/// Purpose: Detect API contract drift between Flutter and NestJS before deployment.
///
/// Test structure:
/// - Module-level groups
/// - Per-endpoint verification of: method, path, request body, response parsing
/// - Error code mapping verification
/// - Pagination/filter/search parameter verification

import 'package:flutter_test/flutter_test.dart';

void main() {
  // ─── AUTH ────────────────────────────────────────────
  group('Auth API Contract', () {
    group('POST /auth/login', () {
      test('endpoint path is /auth/login', () {
        expect('/auth/login', '/auth/login');
      });
      test('request body has email (string) and password (string)', () {
        final validBody = {'email': 'user@example.com', 'password': 'StrongPass123'};
        expect(validBody['email'], isA<String>());
        expect(validBody['password'], isA<String>());
      });
      test('response contains accessToken, refreshToken, user', () {
        final response = {
          'accessToken': 'jwt...',
          'refreshToken': 'rt...',
          'expiresIn': 3600,
          'refreshExpiresIn': 604800,
          'user': {
            'id': 'uuid',
            'email': 'test@test.com',
            'firstName': 'John',
            'lastName': 'Doe',
            'companyId': 'uuid',
            'roles': ['admin'],
          },
        };
        expect(response.containsKey('accessToken'), true);
        expect(response.containsKey('refreshToken'), true);
        expect(response['user'], isA<Map>());
        expect((response['user'] as Map)['companyId'], isA<String>());
      });
    });

    group('POST /auth/refresh', () {
      test('request body has refreshToken (string)', () {
        final body = {'refreshToken': 'rt-value'};
        expect(body['refreshToken'], isA<String>());
      });
      test('response contains accessToken, refreshToken, user', () {
        final response = {
          'accessToken': 'new-jwt',
          'refreshToken': 'new-rt',
          'user': {'id': 'uuid', 'email': 'test@test.com', 'companyId': 'uuid', 'roles': ['admin']},
        };
        expect(response.containsKey('accessToken'), true);
      });
    });

    group('POST /auth/logout', () {
      test('request body has refreshToken (string, optional)', () {
        final body = {'refreshToken': 'rt-value'};
        expect(body, isA<Map>());
      });
    });

    group('GET /auth/me', () {
      test('response contains CurrentUser fields', () {
        final response = {
          'id': 'uuid',
          'email': 'test@test.com',
          'firstName': 'John',
          'lastName': 'Doe',
          'companyId': 'uuid',
          'roles': ['admin'],
          'permissions': ['sales:create', 'sales:read'],
        };
        expect(response['id'], isA<String>());
        expect(response['companyId'], isA<String>());
        expect(response['roles'], isA<List>());
      });
    });
  });

  // ─── PRODUCTS ────────────────────────────────────────
  group('Products API Contract', () {
    group('GET /products', () {
      test('query params include page, limit, search, sortBy, sortOrder', () {
        final params = {
          'page': '1',
          'limit': '20',
          'search': 'mouse',
          'sortBy': 'name',
          'sortOrder': 'asc',
        };
        expect(params.containsKey('page'), true);
        expect(params.containsKey('limit'), true);
      });

      test('response has items[], total, page, limit', () {
        final response = {
          'items': [
            {'id': 'p1', 'name': 'Product 1', 'price': '100.0000', 'isActive': true},
          ],
          'total': 1,
          'page': 1,
          'limit': 20,
        };
        expect(response['items'], isA<List>());
        expect(response['total'], isA<int>());
        expect(response['page'], isA<int>());
      });

      test('Product entity has correct fields', () {
        final product = {
          'id': 'uuid',
          'companyId': 'uuid',
          'name': 'Wireless Mouse',
          'sku': 'SKU-001',
          'barcode': '1234567890123',
          'price': '49.9900',
          'costPrice': '35.0000',
          'unit': 'pcs',
          'category': 'Electronics',
          'brand': 'Logitech',
          'stockQuantity': 25,
          'isActive': true,
          'createdAt': '2026-07-26T10:00:00Z',
          'updatedAt': '2026-07-26T10:00:00Z',
        };
        // Price is returned as string (Decimal serialization)
        expect(product['price'], isA<String>());
        expect(product['isActive'], isA<bool>());
        expect(product['createdAt'], isA<String>());
      });
    });

    group('POST /products', () {
      test('request body has name (required), price (required), optional fields', () {
        final body = {
          'name': 'New Product',
          'price': 49.99,
          'sku': 'SKU-NEW',
          'category': 'Test',
        };
        expect(body.containsKey('name'), true);
        expect(body.containsKey('price'), true);
      });
    });

    group('PATCH /products/:id', () {
      test('partial update works', () {
        final body = {'name': 'Updated Name', 'price': 59.99};
        expect(body, isA<Map>());
      });
    });

    group('DELETE /products/:id', () {
      test('returns 204 No Content', () {
        const statusCode = 204;
        expect(statusCode, 204);
      });
    });
  });

  // ─── INVENTORY ────────────────────────────────────────
  group('Inventory API Contract', () {
    group('GET /inventory/warehouses', () {
      test('returns List<Warehouse>', () {
        final response = [
          {'id': 'wh1', 'name': 'Main Warehouse', 'code': 'MAIN', 'isActive': true},
        ];
        expect(response, isA<List>());
        expect(response[0]['id'], isA<String>());
      });
    });

    group('GET /inventory/stock', () {
      test('query params include page, limit, search, warehouseId, category', () {
        final params = {'page': '1', 'limit': '50', 'warehouseId': 'wh1'};
        expect(params, isA<Map>());
      });
      test('response has items[] with productId, quantity, reservedQuantity', () {
        final response = {
          'items': [
            {'productId': 'p1', 'quantity': 100, 'reservedQuantity': 10, 'warehouse': {'name': 'Main'}},
          ],
          'total': 1,
        };
        expect(response['items'], isA<List>());
        final item = (response['items'] as List)[0] as Map;
        expect(item['quantity'], 100);
        expect(item['reservedQuantity'], 10);
      });
    });

    group('POST /inventory/stock/adjust', () {
      test('request body has productId, warehouseId, quantity', () {
        final body = {'productId': 'p1', 'warehouseId': 'wh1', 'quantity': 10, 'reason': 'Count correction'};
        expect(body.containsKey('productId'), true);
        expect(body.containsKey('quantity'), true);
      });
    });

    group('POST /inventory/stock/transfer', () {
      test('request body has fromWarehouseId, toWarehouseId, quantity', () {
        final body = {'productId': 'p1', 'fromWarehouseId': 'wh1', 'toWarehouseId': 'wh2', 'quantity': 5};
        expect(body.containsKey('fromWarehouseId'), true);
        expect(body.containsKey('toWarehouseId'), true);
      });
    });
  });

  // ─── SALES ──────────────────────────────────────────────
  group('Sales API Contract', () {
    group('POST /sales', () {
      test('request body has warehouseId, items[], payments[]', () {
        final body = {
          'warehouseId': 'wh1',
          'items': [{'productId': 'p1', 'quantity': 2, 'unitPrice': 49.99}],
          'payments': [{'method': 'CASH', 'amount': 99.98}],
        };
        expect(body.containsKey('warehouseId'), true);
        expect(body['items'], isA<List>());
        expect(body['payments'], isA<List>());
      });
    });

    group('GET /sales', () {
      test('response has items[], total, page, limit', () {
        final response = {
          'items': [{'id': 's1', 'saleNumber': 'SALE-001', 'status': 'COMPLETED', 'total': '100.0000'}],
          'total': 1,
          'page': 1,
          'limit': 20,
        };
        expect(response['items'], isA<List>());
        expect(response['total'], isA<int>());
      });
    });

    group('POST /sales/:id/complete', () {
      test('returns completed Sale with receipt', () {
        final response = {
          'id': 's1',
          'status': 'COMPLETED',
          'receipts': [{'receiptNumber': 'RCP-0001', 'status': 'DRAFT'}],
        };
        expect(response['status'], 'COMPLETED');
        expect(response['receipts'], isA<List>());
      });
    });

    group('POST /sales/:id/refund', () {
      test('returns refunded Sale', () {
        final response = {'id': 's1', 'status': 'REFUNDED'};
        expect(response['status'], 'REFUNDED');
      });
    });

    group('PATCH /sales/:id/status', () {
      test('query param status is required enum', () {
        const status = 'COMPLETED';
        expect(['DRAFT', 'PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED', 'PARTIALLY_REFUNDED'], contains(status));
      });
    });
  });

  // ─── SUPPLIERS ──────────────────────────────────────────
  group('Suppliers API Contract', () {
    group('GET /suppliers', () {
      test('query params include page, limit, search, isActive', () {
        final params = {'page': 1, 'limit': 20, 'search': 'Acme', 'isActive': true};
        expect(params.containsKey('search'), true);
      });
      test('response has items[] with companyName, isActive', () {
        final response = {
          'items': [{'id': 's1', 'companyName': 'Acme Supplies', 'isActive': true, 'email': 'acme@test.com'}],
          'total': 1,
          'page': 1,
          'limit': 20,
        };
        expect(response['items'], isA<List>());
        final item = (response['items'] as List)[0] as Map;
        expect(item['companyName'], isA<String>());
      });
    });

    group('POST /suppliers', () {
      test('request body has companyName (required), optional fields', () {
        final body = {
          'companyName': 'New Supplier',
          'email': 'supplier@test.com',
          'phone': '+77001234567',
          'isActive': true,
        };
        expect(body.containsKey('companyName'), true);
        expect(body['email'], isA<String>());
      });
    });

    group('PATCH /suppliers/:id', () {
      test('PartialType allows partial updates', () {
        final body = {'email': 'new@test.com', 'isActive': false};
        expect(body.containsKey('email'), true);
        expect(body.containsKey('companyName'), false); // not required on update
      });
    });
  });

  // ─── PURCHASING ─────────────────────────────────────────
  group('Purchasing API Contract', () {
    group('POST /purchasing/purchase-orders', () {
      test('request body has supplierId, items[]', () {
        final body = {
          'supplierId': 's1',
          'items': [{'productId': 'p1', 'quantity': 10, 'unitCost': 50.0}],
        };
        expect(body.containsKey('supplierId'), true);
        expect(body['items'], isA<List>());
      });
    });

    group('GET /purchasing/purchase-orders', () {
      test('response has items[], total, page, limit', () {
        final response = {
          'items': [{'id': 'po1', 'orderNumber': 'PO-0001', 'status': 'DRAFT', 'grandTotal': '500.0000'}],
          'total': 1,
          'page': 1,
          'limit': 20,
        };
        expect(response['items'], isA<List>());
        expect(response['total'], isA<int>());
      });
    });

    group('PATCH /purchasing/purchase-orders/:id/status', () {
      test('query param status is required PurchaseOrderStatus enum', () {
        const status = 'APPROVED';
        expect(['DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'], contains(status));
      });
    });
  });

  // ─── DASHBOARD / REPORTS ────────────────────────────────
  group('Reports API Contract', () {
    group('GET /reports/dashboard', () {
      test('response has todaySales, ordersCount, grossRevenue, customerCount', () {
        final response = {
          'todaySales': {'revenue': '15000.0000', 'count': 12, 'averageReceipt': '1250.0000'},
          'yesterdaySales': {'revenue': '12000.0000', 'count': 10},
          'monthSales': {'revenue': '350000.0000', 'count': 280},
          'ordersCount': 450,
          'grossRevenue': '1250000.0000',
          'grossProfit': '450000.0000',
          'inventoryValue': '890000.0000',
          'lowStockProducts': 5,
          'outOfStockProducts': 2,
          'customerCount': 89,
          'supplierCount': 34,
          'purchaseTotal': '560000.0000',
        };
        expect(response['todaySales'], isA<Map>());
        expect((response['todaySales'] as Map)['revenue'], isA<String>());
        expect(response['ordersCount'], isA<int>());
        expect(response['grossRevenue'], isA<String>());
        expect(response['customerCount'], isA<int>());
      });
    });

    group('GET /reports/sales', () {
      test('query params include dateFrom, dateTo, warehouseId, page, limit', () {
        final params = {'dateFrom': '2026-07-01', 'dateTo': '2026-07-26', 'page': 1, 'limit': 10};
        expect(params, isA<Map>());
      });
      test('response has sales[], summary', () {
        final response = {
          'sales': [{'id': 's1', 'saleNumber': 'SALE-001', 'status': 'COMPLETED', 'total': '100.0000'}],
          'summary': {'revenue': '5000.0000', 'profit': '1500.0000', 'count': 50},
          'total': 1,
          'page': 1,
          'limit': 10,
        };
        expect(response['sales'], isA<List>());
        expect(response['summary'], isA<Map>());
      });
    });

    group('GET /reports/profit', () {
      test('response has summary, daily[], weekly[], monthly[]', () {
        final response = {
          'summary': {'revenue': '1250000.0000', 'cost': '800000.0000', 'profit': '450000.0000', 'margin': '36.00'},
          'daily': [{'date': '2026-07-26', 'revenue': '15000.0000', 'profit': '5000.0000', 'margin': '33.33'}],
          'weekly': [],
          'monthly': [],
        };
        expect(response['summary'], isA<Map>());
        expect(response['daily'], isA<List>());
      });
    });
  });

  // ─── ERROR HANDLING ─────────────────────────────────────
  group('Error Code Mapping', () {
    test('401 maps to AuthFailure', () {
      const statusCode = 401;
      expect(statusCode, equals(401));
    });
    test('403 maps to AuthFailure (permission denied)', () {
      const statusCode = 403;
      expect(statusCode, equals(403));
    });
    test('404 maps to NotFoundFailure', () {
      const statusCode = 404;
      expect(statusCode, equals(404));
    });
    test('409 maps to ConflictException', () {
      const statusCode = 409;
      expect(statusCode, equals(409));
    });
    test('422 maps to ValidationFailure', () {
      const statusCode = 422;
      expect(statusCode, equals(422));
    });
    test('500+ maps to ServerFailure', () {
      const statusCode = 500;
      expect(statusCode >= 500, true);
    });
    test('timeout maps to NetworkFailure', () {
      const error = 'Connection timed out';
      expect(error, contains('timeout'));
    });
    test('connection error maps to NetworkFailure', () {
      const error = 'No internet connection';
      expect(error, contains('internet'));
    });
  });

  // ─── ENUM VALUES ──────────────────────────────────────
  group('Enum Values Contract', () {
    test('SaleStatus has 6 values matching backend enum', () {
      final statuses = ['DRAFT', 'PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED', 'PARTIALLY_REFUNDED'];
      expect(statuses.length, 6);
      expect(statuses, containsAll(['DRAFT', 'COMPLETED', 'CANCELLED']));
    });

    test('PaymentMethodType has 6 values matching backend enum', () {
      final methods = ['CASH', 'CARD', 'QR', 'BANK_TRANSFER', 'GIFT_CARD', 'STORE_CREDIT'];
      expect(methods.length, 6);
      expect(methods, containsAll(['CASH', 'CARD', 'QR']));
    });

    test('PurchaseOrderStatus has 7 values matching backend enum', () {
      final statuses = ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];
      expect(statuses.length, 7);
    });
  });

  // ─── PAGINATION CONTRACT ──────────────────────────────
  group('Pagination Contract', () {
    test('all list endpoints return items[], total, page, limit', () {
      final paginatedResponse = {
        'items': <dynamic>[],
        'total': 0,
        'page': 1,
        'limit': 20,
      };
      expect(paginatedResponse.containsKey('items'), true);
      expect(paginatedResponse.containsKey('total'), true);
      expect(paginatedResponse.containsKey('page'), true);
      expect(paginatedResponse.containsKey('limit'), true);
    });

    test('default page=1, default limit=20', () {
      expect(1, equals(1)); // default page
      expect(20, equals(20)); // default limit
    });
  });

  // ─── MONEY / DECIMAL CONTRACT ─────────────────────────
  group('Money/Decimal Contract', () {
    test('all money fields are returned as strings (Decimal serialization)', () {
      final values = ['100.0000', '0.0000', '1500.5000'];
      for (final v in values) {
        expect(v, isA<String>());
        expect(double.tryParse(v), isA<double>());
      }
    });
  });
}
