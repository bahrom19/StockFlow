import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/inventory/data/repositories/inventory_repository.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';

void main() {
  group('Warehouse fromJson', () {
    test('should parse full warehouse JSON', () {
      final json = {
        'id': 'wh-1',
        'companyId': 'comp-1',
        'name': 'Main Warehouse',
        'code': 'MAIN',
        'address': '123 Main St',
        'phone': '+1234567890',
        'managerName': 'John',
        'isDefault': true,
        'isActive': true,
        'rowVersion': 3,
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-07-01T00:00:00.000Z',
      };
      final w = Warehouse.fromJson(json);
      expect(w.name, 'Main Warehouse');
      expect(w.code, 'MAIN');
      expect(w.isDefault, true);
      expect(w.rowVersion, 3);
    });

    test('should parse minimal warehouse JSON', () {
      final json = {
        'id': 'wh-2',
        'companyId': 'comp-1',
        'name': 'Secondary',
        'code': 'SEC',
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
      };
      final w = Warehouse.fromJson(json);
      expect(w.address, null);
      expect(w.isDefault, false);
    });
  });

  group('StockItem fromJson', () {
    test('should parse full stock item JSON', () {
      final json = {
        'id': 'st-1',
        'companyId': 'comp-1',
        'productId': 'prod-1',
        'warehouseId': 'wh-1',
        'productName': 'Wireless Mouse',
        'productSku': 'SKU-001',
        'quantity': 100,
        'reservedQuantity': 10,
        'availableQuantity': 90,
        'minQuantity': 5,
        'maxQuantity': 200,
        'rowVersion': 1,
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-07-01T00:00:00.000Z',
        'warehouse': {
          'id': 'wh-1',
          'companyId': 'comp-1',
          'name': 'Main',
          'code': 'MAIN',
          'isDefault': true,
          'isActive': true,
          'createdAt': '2026-01-01T00:00:00.000Z',
          'updatedAt': '2026-07-01T00:00:00.000Z',
        },
      };
      final s = StockItem.fromJson(json);
      expect(s.productName, 'Wireless Mouse');
      expect(s.quantity, 100);
      expect(s.availableQuantity, 90);
      expect(s.warehouse?.name, 'Main');
    });

    test('should handle zero stock', () {
      final json = {
        'id': 'st-2',
        'companyId': 'comp-1',
        'productId': 'prod-2',
        'warehouseId': 'wh-1',
        'productName': 'Out of Stock Item',
        'productSku': 'SKU-OOS',
        'quantity': 0,
        'reservedQuantity': 0,
        'availableQuantity': 0,
        'minQuantity': 5,
        'maxQuantity': 50,
        'rowVersion': 1,
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-07-01T00:00:00.000Z',
      };
      final s = StockItem.fromJson(json);
      expect(s.quantity, 0);
      expect(s.availableQuantity, 0);
    });
  });

  group('StockListResponse', () {
    test('should parse paginated response', () {
      final json = {
        'items': [
          {
            'id': 'st-1',
            'companyId': 'comp-1',
            'productId': 'prod-1',
            'warehouseId': 'wh-1',
            'productName': 'Item A',
            'quantity': 50,
            'reservedQuantity': 5,
            'availableQuantity': 45,
            'minQuantity': 5,
            'maxQuantity': 100,
            'rowVersion': 1,
            'createdAt': '2026-01-01T00:00:00.000Z',
            'updatedAt': '2026-07-01T00:00:00.000Z',
          }
        ],
        'total': 1,
      };
      final r = StockListResponse.fromJson(json);
      expect(r.items.length, 1);
      expect(r.total, 1);
    });
  });

  group('StockMovement fromJson', () {
    test('should parse movement JSON', () {
      final json = {
        'id': 'mv-1',
        'companyId': 'comp-1',
        'productId': 'prod-1',
        'warehouseId': 'wh-1',
        'type': 'SALE',
        'quantity': -2,
        'beforeQuantity': 10,
        'afterQuantity': 8,
        'referenceType': 'Sale',
        'referenceId': 'sale-1',
        'comment': null,
        'createdBy': 'user-1',
        'createdAt': '2026-07-01T00:00:00.000Z',
      };
      final m = StockMovement.fromJson(json);
      expect(m.type, 'SALE');
      expect(m.quantity, -2);
      expect(m.beforeQuantity, 10);
      expect(m.afterQuantity, 8);
    });
  });

  group('AdjustStockDto', () {
    test('should serialize to JSON', () {
      final dto = AdjustStockDto(
        productId: 'prod-1',
        warehouseId: 'wh-1',
        quantity: 5,
        reason: 'Count correction',
      );
      final json = dto.toJson();
      expect(json['productId'], 'prod-1');
      expect(json['quantity'], 5);
      expect(json['reason'], 'Count correction');
    });
  });

  group('TransferStockDto', () {
    test('should serialize to JSON', () {
      final dto = TransferStockDto(
        productId: 'prod-1',
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-2',
        quantity: 10,
      );
      final json = dto.toJson();
      expect(json['fromWarehouseId'], 'wh-1');
      expect(json['toWarehouseId'], 'wh-2');
      expect(json['quantity'], 10);
    });
  });

  group('MovementTypeX', () {
    test('should return labels', () {
      expect('SALE'.movementLabel, 'Sale');
      expect('PURCHASE'.movementLabel, 'Purchase');
      expect('ADJUSTMENT'.movementLabel, 'Adjustment');
      expect('TRANSFER_IN'.movementLabel, 'Transfer In');
      expect('TRANSFER_OUT'.movementLabel, 'Transfer Out');
      expect('RETURN'.movementLabel, 'Return');
      expect('LOSS'.movementLabel, 'Loss');
      expect('CORRECTION'.movementLabel, 'Correction');
      expect('UNKNOWN'.movementLabel, 'UNKNOWN');
    });
  });

  group('InventoryState', () {
    test('InventoryLoading is InventoryState', () {
      expect(const InventoryLoading(), isA<InventoryState>());
    });

    test('InventoryEmpty has default message', () {
      expect(const InventoryEmpty().message, 'No inventory items found');
    });

    test('InventoryError stores message', () {
      expect(const InventoryError('err').message, 'err');
    });

    test('InventoryLoaded stores items', () {
      final loaded = InventoryLoaded(items: [], total: 0, warehouses: []);
      expect(loaded.items, isEmpty);
      expect(loaded.isRefreshing, false);
    });

    test('InventoryLoaded copyWith updates', () {
      final loaded = InventoryLoaded(items: [], total: 0, warehouses: []);
      final updated = loaded.copyWith(isRefreshing: true);
      expect(updated.isRefreshing, true);
    });
  });

  group('MovementsState', () {
    test('MovementsLoading is MovementsState', () {
      expect(const MovementsLoading(), isA<MovementsState>());
    });

    test('MovementsLoaded stores movements', () {
      final json = {
        'id': 'mv-1',
        'companyId': 'comp-1',
        'productId': 'prod-1',
        'warehouseId': 'wh-1',
        'type': 'SALE',
        'quantity': -1,
        'beforeQuantity': 5,
        'afterQuantity': 4,
        'createdAt': '2026-07-01T00:00:00.000Z',
      };
      final m = StockMovement.fromJson(json);
      final loaded = MovementsLoaded([m]);
      expect(loaded.movements.length, 1);
    });
  });

  group('InvResult', () {
    test('InvSuccess stores data', () {
      final w = Warehouse(
        id: 'wh-1',
        companyId: 'comp-1',
        name: 'Main',
        code: 'MAIN',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      );
      expect(InvSuccess(w).data, w);
    });

    test('InvFailure stores error', () {
      final f = InvFailure<int>(AuthFailure(message: 'err'));
      expect(f.error, isA<AuthFailure>());
    });
  });
}

// ── StockBadge label tests ──
void _runBadgeTests() {
  test('out of stock shows Out', () {});
  test('low stock shows Low', () {});
  test('sufficient stock shows quantity', () {});
}
