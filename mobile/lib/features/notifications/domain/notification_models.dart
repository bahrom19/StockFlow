import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification_models.freezed.dart';
part 'notification_models.g.dart';

// ──────────────────────────────────
// NotificationType enum (backend: LOW_STOCK | SUPPLIER_PAYMENT_OVERDUE | PURCHASE_ORDER_STATUS_CHANGED)
// ──────────────────────────────────
enum NotificationType {
  @JsonValue('LOW_STOCK')
  lowStock,
  @JsonValue('SUPPLIER_PAYMENT_OVERDUE')
  supplierPaymentOverdue,
  @JsonValue('PURCHASE_ORDER_STATUS_CHANGED')
  purchaseOrderStatusChanged;

  /// Graceful fallback for unknown backend values — never crash.
  static NotificationType fromApi(String? value) {
    switch (value) {
      case 'LOW_STOCK':
        return NotificationType.lowStock;
      case 'SUPPLIER_PAYMENT_OVERDUE':
        return NotificationType.supplierPaymentOverdue;
      case 'PURCHASE_ORDER_STATUS_CHANGED':
        return NotificationType.purchaseOrderStatusChanged;
      default:
        return NotificationType.lowStock; // safe default
    }
  }
}

// ──────────────────────────────────
// Notification (matches backend GET /notifications response items)
// ──────────────────────────────────
@freezed
class AppNotification with _$AppNotification {
  const AppNotification._();

  const factory AppNotification({
    required String id,
    required String type,
    required String titleKey,
    String? bodyKey,
    Map<String, dynamic>? params,
    String? entityType,
    String? entityId,
    String? readAt,
    required String createdAt,
  }) = _AppNotification;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      _$AppNotificationFromJson(json);

  /// Whether this notification has been read.
  bool get isRead => readAt != null;
}

// ──────────────────────────────────
// NotificationListResponse (matches backend pagination wrapper)
// ──────────────────────────────────
@freezed
class NotificationListResponse with _$NotificationListResponse {
  const factory NotificationListResponse({
    required List<AppNotification> items,
    required int total,
    required int page,
    required int limit,
  }) = _NotificationListResponse;

  factory NotificationListResponse.fromJson(Map<String, dynamic> json) =>
      _$NotificationListResponseFromJson(json);
}

// ──────────────────────────────────
// UnreadCountResponse (matches backend GET /notifications/unread-count)
// ──────────────────────────────────
@freezed
class UnreadCountResponse with _$UnreadCountResponse {
  const factory UnreadCountResponse({
    required int count,
  }) = _UnreadCountResponse;

  factory UnreadCountResponse.fromJson(Map<String, dynamic> json) =>
      _$UnreadCountResponseFromJson(json);
}
