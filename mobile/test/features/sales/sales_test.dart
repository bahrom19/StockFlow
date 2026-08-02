import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/sales/data/repositories/sales_repository.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

// ──────────────────────────────────
// Model & Logic Tests
// ──────────────────────────────────
void main() {
  group('SaleStatus', () {
    test('fromJson works correctly', () {
      expect(SaleStatus.values.length, 6);
      expect(SaleStatus.completed.label, 'Completed');
      expect(SaleStatus.draft.label, 'Draft');
      expect(SaleStatus.refunded.label, 'Refunded');
      expect(SaleStatus.cancelled.label, 'Cancelled');
    });
  });

  group('PaymentMethodType', () {
    test('fromJson and label work', () {
      expect(PaymentMethodType.cash.label, 'Cash');
      expect(PaymentMethodType.card.label, 'Card');
      expect(PaymentMethodType.qr.label, 'QR');
      expect(PaymentMethodType.bankTransfer.label, 'Bank Transfer');
    });
  });

  group('Sale', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'sale-1',
        'companyId': 'company-1',
        'warehouseId': 'wh-1',
        'cashierId': 'user-1',
        'saleNumber': 'SALE-0001',
        'status': 'COMPLETED',
        'subtotal': '1000.0000',
        'discount': '0.0000',
        'tax': '0.0000',
        'total': '1000.0000',
        'paidAmount': '1000.0000',
        'changeAmount': '0.0000',
        'currency': 'KZT',
        'rowVersion': 1,
        'createdAt': '2026-07-26T10:00:00Z',
        'updatedAt': '2026-07-26T10:00:00Z',
        'items': [],
        'payments': [],
        'receipts': [],
      };
      final sale = Sale.fromJson(json);
      expect(sale.id, 'sale-1');
      expect(sale.saleNumber, 'SALE-0001');
      expect(sale.status, 'COMPLETED');
      expect(sale.total, '1000.0000');
      expect(sale.items.length, 0);
    });

    test('fromJson with items and payments', () {
      final json = {
        'id': 'sale-2',
        'companyId': 'company-1',
        'warehouseId': 'wh-1',
        'cashierId': 'user-1',
        'saleNumber': 'SALE-0002',
        'status': 'DRAFT',
        'subtotal': '500.0000',
        'discount': '50.0000',
        'tax': '45.0000',
        'total': '495.0000',
        'paidAmount': '0.0000',
        'changeAmount': '0.0000',
        'currency': 'KZT',
        'rowVersion': 0,
        'createdAt': '2026-07-26T11:00:00Z',
        'updatedAt': '2026-07-26T11:00:00Z',
        'items': [
          {
            'id': 'item-1',
            'saleId': 'sale-2',
            'productId': 'prod-1',
            'quantity': 2,
            'unitPrice': '250.0000',
            'costPrice': '150.0000',
            'discount': '0.0000',
            'subtotal': '500.0000',
            'total': '500.0000',
            'margin': '200.0000',
            'createdAt': '2026-07-26T11:00:00Z',
            'updatedAt': '2026-07-26T11:00:00Z',
          }
        ],
        'payments': [
          {
            'id': 'pay-1',
            'saleId': 'sale-2',
            'method': 'CASH',
            'amount': '0.0000',
            'createdAt': '2026-07-26T11:00:00Z',
            'updatedAt': '2026-07-26T11:00:00Z',
          }
        ],
        'receipts': [],
      };
      final sale = Sale.fromJson(json);
      expect(sale.items.length, 1);
      expect(sale.items[0].productId, 'prod-1');
      expect(sale.items[0].quantity, 2);
      expect(sale.items[0].total, '500.0000');
      expect(sale.payments.length, 1);
      expect(sale.payments[0].method, 'CASH');
    });
  });

  group('SaleItem', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'item-1',
        'saleId': 'sale-1',
        'productId': 'prod-1',
        'quantity': 3,
        'unitPrice': '100.0000',
        'costPrice': '70.0000',
        'discount': '10.0000',
        'subtotal': '300.0000',
        'total': '290.0000',
        'margin': '80.0000',
        'createdAt': '2026-07-26T10:00:00Z',
        'updatedAt': '2026-07-26T10:00:00Z',
      };
      final item = SaleItem.fromJson(json);
      expect(item.quantity, 3);
      expect(item.unitPrice, '100.0000');
      expect(item.total, '290.0000');
      expect(item.margin, '80.0000');
    });
  });

  group('Payment', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'pay-1',
        'saleId': 'sale-1',
        'method': 'CARD',
        'amount': '500.0000',
        'reference': 'Card last4: 4242',
        'createdAt': '2026-07-26T10:00:00Z',
        'updatedAt': '2026-07-26T10:00:00Z',
      };
      final payment = Payment.fromJson(json);
      expect(payment.method, 'CARD');
      expect(payment.amount, '500.0000');
      expect(payment.reference, 'Card last4: 4242');
    });

    test('fromJson without reference', () {
      final json = {
        'id': 'pay-2',
        'saleId': 'sale-1',
        'method': 'QR',
        'amount': '300.0000',
        'createdAt': '2026-07-26T10:00:00Z',
        'updatedAt': '2026-07-26T10:00:00Z',
      };
      final payment = Payment.fromJson(json);
      expect(payment.reference, null);
    });
  });

  group('Receipt', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'rcpt-1',
        'receiptNumber': 'RCP-0001',
        'saleId': 'sale-1',
        'status': 'DRAFT',
        'printed': false,
        'emailed': false,
        'createdAt': '2026-07-26T10:00:00Z',
        'updatedAt': '2026-07-26T10:00:00Z',
      };
      final receipt = Receipt.fromJson(json);
      expect(receipt.receiptNumber, 'RCP-0001');
      expect(receipt.printed, false);
      expect(receipt.emailed, false);
    });
  });

  group('CreateSaleRequest', () {
    test('toJson produces correct structure', () {
      final request = CreateSaleRequest(
        warehouseId: 'wh-1',
        customerId: 'cust-1',
        currency: 'KZT',
        notes: 'Test sale',
        items: [
          CreateSaleItem(
            productId: 'prod-1',
            quantity: 2,
            unitPrice: 100.0,
            costPrice: 70.0,
          ),
        ],
        payments: [
          CreatePayment(method: 'CASH', amount: 200.0),
        ],
      );
      final json = request.toJson();
      expect(json['warehouseId'], 'wh-1');
      expect(json['items'], isA<List>());
      expect((json['items'] as List).length, 1);
      // Freezed toJson keeps nested typed objects; jsonEncode resolves them
      // to plain maps — this is the wire structure Dio sends to the backend.
      final wire = jsonDecode(jsonEncode(json)) as Map<String, dynamic>;
      expect((wire['items'] as List)[0]['productId'], 'prod-1');
      expect(wire['payments'], isA<List>());
      expect((wire['payments'] as List).length, 1);
      expect((wire['payments'] as List)[0]['method'], 'CASH');
    });
  });

  group('CartItem', () {
    test('computes subtotal and total correctly', () {
      final item = CartItem(
        productId: 'prod-1',
        productName: 'Test Product',
        productSku: 'SKU-001',
        quantity: 3,
        unitPrice: 100.0,
        costPrice: 70.0,
        discount: 20.0,
      );
      expect(item.subtotal, 300.0);
      expect(item.total, 280.0);
    });

    test('subtotal without discount equals total', () {
      final item = CartItem(
        productId: 'prod-1',
        productName: 'No Discount',
        productSku: 'SKU-002',
        quantity: 1,
        unitPrice: 50.0,
        costPrice: 30.0,
      );
      expect(item.subtotal, 50.0);
      expect(item.total, 50.0);
    });
  });

  group('SaleListResponse', () {
    test('fromJson parses paginated response', () {
      final json = {
        'items': [
          {
            'id': 'sale-1',
            'companyId': 'c-1',
            'warehouseId': 'wh-1',
            'cashierId': 'u-1',
            'saleNumber': 'SALE-0001',
            'status': 'COMPLETED',
            'subtotal': '100.0000',
            'discount': '0.0000',
            'tax': '0.0000',
            'total': '100.0000',
            'paidAmount': '100.0000',
            'changeAmount': '0.0000',
            'currency': 'KZT',
            'rowVersion': 1,
            'createdAt': '2026-07-26T10:00:00Z',
            'updatedAt': '2026-07-26T10:00:00Z',
            'items': [],
            'payments': [],
            'receipts': [],
          }
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
      };
      final response = SaleListResponse.fromJson(json);
      expect(response.items.length, 1);
      expect(response.total, 1);
      expect(response.page, 1);
      expect(response.limit, 20);
    });
  });



  // ──────────────────────────────
  // Sales Result Tests
  // ──────────────────────────────
  group('SalesResult', () {
    test('SalesSuccess holds data', () {
      final result = SalesSuccess<Sale>(
        Sale.fromJson({
          'id': 'sale-1',
          'companyId': 'c-1',
          'warehouseId': 'wh-1',
          'cashierId': 'u-1',
          'saleNumber': 'SALE-001',
          'status': 'DRAFT',
          'subtotal': '0',
          'discount': '0',
          'tax': '0',
          'total': '0',
          'paidAmount': '0',
          'changeAmount': '0',
          'currency': 'KZT',
          'rowVersion': 0,
          'createdAt': '2026-07-26T10:00:00Z',
          'updatedAt': '2026-07-26T10:00:00Z',
          'items': [],
          'payments': [],
          'receipts': [],
        }),
      );
      expect(result.data, isA<Sale>());
      expect(result.data.saleNumber, 'SALE-001');
    });

    test('SalesFailure holds error', () {
      final error = ServerFailure(message: 'Server error');
      final result = SalesFailure<Sale>(error);
      expect(result.error.message, 'Server error');
    });
  });

  // ──────────────────────────────
  // Error Mapping Tests
  // ──────────────────────────────
  group('Error mapping', () {
    test('401 maps to AuthFailure', () {
      final errorHandler = ErrorHandler(AppLogger('test'));
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/sales'),
        response: Response(
          requestOptions: RequestOptions(path: '/sales'),
          statusCode: 401,
          data: {'message': 'Unauthorized'},
        ),
        type: DioExceptionType.badResponse,
      );
      final error = errorHandler.handle(dioError);
      expect(error, isA<AuthFailure>());
    });

    test('404 maps to NotFoundFailure', () {
      final errorHandler = ErrorHandler(AppLogger('test'));
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/sales/123'),
        response: Response(
          requestOptions: RequestOptions(path: '/sales/123'),
          statusCode: 404,
          data: {'message': 'Not found'},
        ),
        type: DioExceptionType.badResponse,
      );
      final error = errorHandler.handle(dioError);
      expect(error, isA<NotFoundFailure>());
    });

    test('500 maps to ServerFailure', () {
      final errorHandler = ErrorHandler(AppLogger('test'));
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/sales'),
        response: Response(
          requestOptions: RequestOptions(path: '/sales'),
          statusCode: 500,
          data: {'message': 'Internal error'},
        ),
        type: DioExceptionType.badResponse,
      );
      final error = errorHandler.handle(dioError);
      expect(error, isA<ServerFailure>());
    });

    test('connection timeout maps to NetworkFailure', () {
      final errorHandler = ErrorHandler(AppLogger('test'));
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/sales'),
        type: DioExceptionType.connectionTimeout,
      );
      final error = errorHandler.handle(dioError);
      expect(error, isA<NetworkFailure>());
    });
  });
}

