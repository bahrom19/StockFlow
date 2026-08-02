import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/purchasing/data/repositories/purchasing_repository.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';

void main() {
  // ── PurchaseOrderStatus ──
  group('PurchaseOrderStatus', () {
    test('has correct number of values', () {
      expect(PurchaseOrderStatus.values.length, 7);
    });
    test('labels are correct', () {
      expect(PurchaseOrderStatus.draft.label, 'Draft');
      expect(PurchaseOrderStatus.pending.label, 'Pending');
      expect(PurchaseOrderStatus.approved.label, 'Approved');
      expect(PurchaseOrderStatus.ordered.label, 'Ordered');
      expect(PurchaseOrderStatus.partiallyReceived.label, 'Partially Received');
      expect(PurchaseOrderStatus.received.label, 'Received');
      expect(PurchaseOrderStatus.cancelled.label, 'Cancelled');
    });
  });

  // ── Supplier ──
  group('Supplier', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 's-1', 'companyId': 'c-1', 'companyName': 'Acme Supplies',
        'bin': '123456789012', 'email': 'acme@example.com', 'phone': '+77001234567',
        'isActive': true,
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
      };
      final supplier = Supplier.fromJson(json);
      expect(supplier.companyName, 'Acme Supplies');
      expect(supplier.email, 'acme@example.com');
      expect(supplier.isActive, true);
    });
  });

  group('SupplierListResponse', () {
    test('fromJson parses paginated response', () {
      final json = {
        'items': [{'id': 's-1', 'companyId': 'c-1', 'companyName': 'Acme', 'isActive': true, 'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z'}],
        'total': 1, 'page': 1, 'limit': 20,
      };
      final resp = SupplierListResponse.fromJson(json);
      expect(resp.items.length, 1);
      expect(resp.total, 1);
    });
  });

  group('CreateSupplierRequest', () {
    test('toJson produces correct structure', () {
      final req = CreateSupplierRequest(companyName: 'New Co', email: 'test@test.com');
      final json = req.toJson();
      expect(json['companyName'], 'New Co');
      expect(json['email'], 'test@test.com');
    });
  });

  // ── PurchaseOrder ──
  group('PurchaseOrder', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'po-1', 'companyId': 'c-1', 'supplierId': 's-1',
        'orderNumber': 'PO-0001', 'orderDate': '2026-07-26T10:00:00Z',
        'status': 'DRAFT',
        'subtotal': '1000.0000', 'discountAmount': '0.0000', 'taxAmount': '0.0000',
        'grandTotal': '1000.0000', 'paidAmount': '0.0000',
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
        'items': [],
      };
      final po = PurchaseOrder.fromJson(json);
      expect(po.orderNumber, 'PO-0001');
      expect(po.status, 'DRAFT');
      expect(po.grandTotal, '1000.0000');
    });

    test('fromJson with items', () {
      final json = {
        'id': 'po-2', 'companyId': 'c-1', 'supplierId': 's-1',
        'orderNumber': 'PO-0002', 'orderDate': '2026-07-26T10:00:00Z',
        'status': 'RECEIVED',
        'subtotal': '500.0000', 'discountAmount': '25.0000', 'taxAmount': '47.5000',
        'grandTotal': '522.5000', 'paidAmount': '522.5000',
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
        'items': [{
          'id': 'poi-1', 'purchaseOrderId': 'po-2', 'productId': 'prod-1',
          'quantity': 10, 'receivedQuantity': 10,
          'unitCost': '50.0000', 'discountAmount': '0.0000', 'taxAmount': '0.0000',
          'subtotal': '500.0000', 'total': '500.0000',
          'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
        }],
      };
      final po = PurchaseOrder.fromJson(json);
      expect(po.status, 'RECEIVED');
      expect(po.items.length, 1);
      expect(po.items[0].quantity, 10);
      expect(po.items[0].receivedQuantity, 10);
      expect(po.items[0].unitCost, '50.0000');
    });
  });

  group('PurchaseOrderItem', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'poi-1', 'purchaseOrderId': 'po-1', 'productId': 'prod-1',
        'quantity': 5, 'receivedQuantity': 2,
        'unitCost': '100.0000', 'discountAmount': '0.0000', 'taxAmount': '0.0000',
        'subtotal': '500.0000', 'total': '500.0000',
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
      };
      final item = PurchaseOrderItem.fromJson(json);
      expect(item.quantity, 5);
      expect(item.receivedQuantity, 2);
      expect(item.unitCost, '100.0000');
    });
  });

  group('PurchaseOrderListResponse', () {
    test('fromJson parses paginated response', () {
      final json = {
        'items': [{'id': 'po-1', 'companyId': 'c-1', 'supplierId': 's-1', 'orderNumber': 'PO-0001', 'orderDate': '2026-07-26T10:00:00Z', 'status': 'DRAFT', 'subtotal': '0', 'discountAmount': '0', 'taxAmount': '0', 'grandTotal': '0', 'paidAmount': '0', 'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z', 'items': []}],
        'total': 1, 'page': 1, 'limit': 20,
      };
      final resp = PurchaseOrderListResponse.fromJson(json);
      expect(resp.items.length, 1);
    });
  });

  group('CreatePurchaseOrderRequest', () {
    test('toJson produces correct structure', () {
      final req = CreatePurchaseOrderRequest(
        supplierId: 's-1',
        items: [CreatePurchaseOrderItem(productId: 'p-1', quantity: 10, unitCost: 50.0)],
      );
      final json = req.toJson();
      expect(json['supplierId'], 's-1');
      expect((json['items'] as List).length, 1);
      // Freezed toJson keeps nested typed objects; jsonEncode resolves them
      // to plain maps — this is the wire structure Dio sends to the backend.
      final wire = jsonDecode(jsonEncode(json)) as Map<String, dynamic>;
      expect((wire['items'] as List)[0]['quantity'], 10);
    });
  });

  // ── GoodsReceipt ──
  group('GoodsReceipt', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'gr-1', 'companyId': 'c-1', 'purchaseOrderId': 'po-1',
        'receiptNumber': 'GR-0001', 'receiptDate': '2026-07-26T10:00:00Z',
        'warehouseId': 'wh-1', 'status': 'COMPLETED',
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
        'items': [],
      };
      final gr = GoodsReceipt.fromJson(json);
      expect(gr.receiptNumber, 'GR-0001');
      expect(gr.status, 'COMPLETED');
    });
  });

  group('GoodsReceiptItem', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'gri-1', 'goodsReceiptId': 'gr-1', 'purchaseOrderItemId': 'poi-1',
        'productId': 'prod-1', 'quantity': 10,
        'unitCost': '50.0000', 'subtotal': '500.0000',
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
      };
      final item = GoodsReceiptItem.fromJson(json);
      expect(item.quantity, 10);
      expect(item.unitCost, '50.0000');
    });
  });

  group('CreateGoodsReceiptRequest', () {
    test('toJson produces correct structure', () {
      final req = CreateGoodsReceiptRequest(
        purchaseOrderId: 'po-1', warehouseId: 'wh-1',
        items: [CreateGoodsReceiptItem(purchaseOrderItemId: 'poi-1', productId: 'p-1', quantity: 5, unitCost: 50.0)],
      );
      final json = req.toJson();
      expect(json['purchaseOrderId'], 'po-1');
      expect((json['items'] as List).length, 1);
    });
  });

  // ── PurchaseReturn ──
  group('PurchaseReturn', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'pr-1', 'companyId': 'c-1', 'supplierId': 's-1',
        'returnNumber': 'PR-0001', 'returnDate': '2026-07-26T10:00:00Z',
        'warehouseId': 'wh-1', 'status': 'COMPLETED',
        'subtotal': '500.0000', 'discountAmount': '0.0000', 'taxAmount': '0.0000',
        'grandTotal': '500.0000',
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
        'items': [],
      };
      final pr = PurchaseReturn.fromJson(json);
      expect(pr.returnNumber, 'PR-0001');
      expect(pr.status, 'COMPLETED');
    });
  });

  group('PurchaseReturnItem', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'pri-1', 'purchaseReturnId': 'pr-1', 'productId': 'prod-1',
        'quantity': 3, 'unitCost': '50.0000', 'discountAmount': '0.0000', 'taxAmount': '0.0000',
        'subtotal': '150.0000', 'total': '150.0000',
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
      };
      final item = PurchaseReturnItem.fromJson(json);
      expect(item.quantity, 3);
      expect(item.total, '150.0000');
    });
  });

  // ── Sealed Results ──
  group('PurchasingResult', () {
    test('PurchasingSuccess holds data', () {
      final po = PurchaseOrder.fromJson({
        'id': 'po-1', 'companyId': 'c-1', 'supplierId': 's-1',
        'orderNumber': 'PO-001', 'orderDate': '2026-07-26T10:00:00Z',
        'status': 'DRAFT', 'subtotal': '0', 'discountAmount': '0', 'taxAmount': '0',
        'grandTotal': '0', 'paidAmount': '0',
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
        'items': [],
      });
      final result = PurchasingSuccess<PurchaseOrder>(po);
      expect(result.data.orderNumber, 'PO-001');
    });

    test('SuppliersSuccess holds data', () {
      final s = Supplier.fromJson({
        'id': 's-1', 'companyId': 'c-1', 'companyName': 'Test',
        'isActive': true,
        'createdAt': '2026-07-26T10:00:00Z', 'updatedAt': '2026-07-26T10:00:00Z',
      });
      final result = SuppliersSuccess<Supplier>(s);
      expect(result.data.companyName, 'Test');
    });
  });
}
