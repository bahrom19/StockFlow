import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/notifications/domain/notification_models.dart';

void main() {
  group('AppNotification', () {
    test('fromJson parses valid notification', () {
      final json = {
        'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'type': 'LOW_STOCK',
        'titleKey': 'notificationTypeLowStockTitle',
        'bodyKey': 'notificationTypeLowStockBody',
        'params': {'productName': 'Widget', 'quantity': 3},
        'entityType': 'Product',
        'entityId': 'prod-1',
        'readAt': null,
        'createdAt': '2026-09-06T10:00:00Z',
      };

      final n = AppNotification.fromJson(json);
      expect(n.id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(n.type, 'LOW_STOCK');
      expect(n.titleKey, 'notificationTypeLowStockTitle');
      expect(n.bodyKey, 'notificationTypeLowStockBody');
      expect(n.params, {'productName': 'Widget', 'quantity': 3});
      expect(n.entityType, 'Product');
      expect(n.entityId, 'prod-1');
      expect(n.readAt, isNull);
      expect(n.isRead, false);
      expect(n.createdAt, '2026-09-06T10:00:00Z');
    });

    test('fromJson handles nullable params', () {
      final json = {
        'id': 'test-id',
        'type': 'PURCHASE_ORDER_STATUS_CHANGED',
        'titleKey': 'title',
        'bodyKey': null,
        'params': null,
        'entityType': null,
        'entityId': null,
        'readAt': null,
        'createdAt': '2026-09-06T10:00:00Z',
      };

      final n = AppNotification.fromJson(json);
      expect(n.params, isNull);
      expect(n.bodyKey, isNull);
      expect(n.entityType, isNull);
      expect(n.entityId, isNull);
    });

    test('readAt present → isRead true', () {
      final json = {
        'id': 'test-id',
        'type': 'LOW_STOCK',
        'titleKey': 'title',
        'readAt': '2026-09-06T11:00:00Z',
        'createdAt': '2026-09-06T10:00:00Z',
      };

      final n = AppNotification.fromJson(json);
      expect(n.isRead, true);
    });

    test('readAt null → isRead false', () {
      final json = {
        'id': 'test-id',
        'type': 'LOW_STOCK',
        'titleKey': 'title',
        'readAt': null,
        'createdAt': '2026-09-06T10:00:00Z',
      };

      final n = AppNotification.fromJson(json);
      expect(n.isRead, false);
    });

    test('unknown type does not crash', () {
      final json = {
        'id': 'test-id',
        'type': 'UNKNOWN_TYPE',
        'titleKey': 'title',
        'createdAt': '2026-09-06T10:00:00Z',
      };

      final n = AppNotification.fromJson(json);
      expect(n.type, 'UNKNOWN_TYPE');
      expect(n.isRead, false);
    });
  });

  group('NotificationListResponse', () {
    test('fromJson parses pagination', () {
      final json = {
        'items': [
          {
            'id': 'n1',
            'type': 'LOW_STOCK',
            'titleKey': 't',
            'createdAt': '2026-09-06T10:00:00Z',
          },
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
      };

      final r = NotificationListResponse.fromJson(json);
      expect(r.items.length, 1);
      expect(r.total, 1);
      expect(r.page, 1);
      expect(r.limit, 20);
    });

    test('empty items list', () {
      final json = {
        'items': <dynamic>[],
        'total': 0,
        'page': 1,
        'limit': 20,
      };

      final r = NotificationListResponse.fromJson(json);
      expect(r.items, isEmpty);
      expect(r.total, 0);
    });
  });

  group('NotificationType', () {
    test('fromApi maps known types', () {
      expect(NotificationType.fromApi('LOW_STOCK'), NotificationType.lowStock);
      expect(
        NotificationType.fromApi('SUPPLIER_PAYMENT_OVERDUE'),
        NotificationType.supplierPaymentOverdue,
      );
      expect(
        NotificationType.fromApi('PURCHASE_ORDER_STATUS_CHANGED'),
        NotificationType.purchaseOrderStatusChanged,
      );
    });

    test('fromApi returns safe default for unknown', () {
      expect(NotificationType.fromApi('UNKNOWN'), NotificationType.lowStock);
      expect(NotificationType.fromApi(null), NotificationType.lowStock);
      expect(NotificationType.fromApi(''), NotificationType.lowStock);
    });
  });
}
