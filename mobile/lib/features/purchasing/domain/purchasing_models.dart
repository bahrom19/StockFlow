import 'package:freezed_annotation/freezed_annotation.dart';

part 'purchasing_models.freezed.dart';
part 'purchasing_models.g.dart';

// ──────────────────────────────────
// Enums
// ──────────────────────────────────
enum PurchaseOrderStatus {
  @JsonValue('DRAFT')
  draft,
  @JsonValue('PENDING')
  pending,
  @JsonValue('APPROVED')
  approved,
  @JsonValue('ORDERED')
  ordered,
  @JsonValue('PARTIALLY_RECEIVED')
  partiallyReceived,
  @JsonValue('RECEIVED')
  received,
  @JsonValue('CANCELLED')
  cancelled;

  String get label {
    switch (this) {
      case PurchaseOrderStatus.draft:
        return 'Draft';
      case PurchaseOrderStatus.pending:
        return 'Pending';
      case PurchaseOrderStatus.approved:
        return 'Approved';
      case PurchaseOrderStatus.ordered:
        return 'Ordered';
      case PurchaseOrderStatus.partiallyReceived:
        return 'Partially Received';
      case PurchaseOrderStatus.received:
        return 'Received';
      case PurchaseOrderStatus.cancelled:
        return 'Cancelled';
    }
  }
}

// ──────────────────────────────────
// Purchase Order
// ──────────────────────────────────
@freezed
class PurchaseOrder with _$PurchaseOrder {
  const factory PurchaseOrder({
    required String id,
    required String companyId,
    required String supplierId,
    required String orderNumber,
    required DateTime orderDate,
    DateTime? expectedDate,
    required String status,
    required String subtotal,
    required String discountAmount,
    required String taxAmount,
    required String grandTotal,
    required String paidAmount,
    String? notes,
    String? approvedBy,
    DateTime? approvedAt,
    String? cancelledBy,
    DateTime? cancelledAt,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
    @Default([]) List<PurchaseOrderItem> items,
  }) = _PurchaseOrder;

  factory PurchaseOrder.fromJson(Map<String, dynamic> json) =>
      _$PurchaseOrderFromJson(json);
}

@freezed
class PurchaseOrderItem with _$PurchaseOrderItem {
  const factory PurchaseOrderItem({
    required String id,
    required String purchaseOrderId,
    required String productId,
    required int quantity,
    @Default(0) int receivedQuantity,
    required String unitCost,
    String? discountPercent,
    required String discountAmount,
    String? taxPercent,
    required String taxAmount,
    required String subtotal,
    required String total,
    String? notes,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _PurchaseOrderItem;

  factory PurchaseOrderItem.fromJson(Map<String, dynamic> json) =>
      _$PurchaseOrderItemFromJson(json);
}

@freezed
class PurchaseOrderListResponse with _$PurchaseOrderListResponse {
  const factory PurchaseOrderListResponse({
    required List<PurchaseOrder> items,
    required int total,
    required int page,
    required int limit,
  }) = _PurchaseOrderListResponse;

  factory PurchaseOrderListResponse.fromJson(Map<String, dynamic> json) =>
      _$PurchaseOrderListResponseFromJson(json);
}

@freezed
class CreatePurchaseOrderRequest with _$CreatePurchaseOrderRequest {
  const factory CreatePurchaseOrderRequest({
    required String supplierId,
    String? orderNumber,
    String? orderDate,
    String? expectedDate,
    String? notes,
    required List<CreatePurchaseOrderItem> items,
  }) = _CreatePurchaseOrderRequest;

  factory CreatePurchaseOrderRequest.fromJson(Map<String, dynamic> json) =>
      _$CreatePurchaseOrderRequestFromJson(json);
}

@freezed
class CreatePurchaseOrderItem with _$CreatePurchaseOrderItem {
  const factory CreatePurchaseOrderItem({
    required String productId,
    required int quantity,
    required double unitCost,
    @Default(0) double discountPercent,
    @Default(0) double taxPercent,
    String? notes,
  }) = _CreatePurchaseOrderItem;

  factory CreatePurchaseOrderItem.fromJson(Map<String, dynamic> json) =>
      _$CreatePurchaseOrderItemFromJson(json);
}

// ──────────────────────────────────
// Goods Receipt
// ──────────────────────────────────
@freezed
class GoodsReceipt with _$GoodsReceipt {
  const factory GoodsReceipt({
    required String id,
    required String companyId,
    required String purchaseOrderId,
    required String receiptNumber,
    required DateTime receiptDate,
    required String warehouseId,
    required String status,
    String? notes,
    String? receivedBy,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
    @Default([]) List<GoodsReceiptItem> items,
  }) = _GoodsReceipt;

  factory GoodsReceipt.fromJson(Map<String, dynamic> json) =>
      _$GoodsReceiptFromJson(json);
}

@freezed
class GoodsReceiptItem with _$GoodsReceiptItem {
  const factory GoodsReceiptItem({
    required String id,
    required String goodsReceiptId,
    required String purchaseOrderItemId,
    required String productId,
    required int quantity,
    required String unitCost,
    required String subtotal,
    String? notes,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _GoodsReceiptItem;

  factory GoodsReceiptItem.fromJson(Map<String, dynamic> json) =>
      _$GoodsReceiptItemFromJson(json);
}

@freezed
class CreateGoodsReceiptRequest with _$CreateGoodsReceiptRequest {
  const factory CreateGoodsReceiptRequest({
    required String purchaseOrderId,
    required String warehouseId,
    String? notes,
    required List<CreateGoodsReceiptItem> items,
  }) = _CreateGoodsReceiptRequest;

  factory CreateGoodsReceiptRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateGoodsReceiptRequestFromJson(json);
}

@freezed
class CreateGoodsReceiptItem with _$CreateGoodsReceiptItem {
  const factory CreateGoodsReceiptItem({
    required String purchaseOrderItemId,
    required String productId,
    required int quantity,
    required double unitCost,
    String? notes,
  }) = _CreateGoodsReceiptItem;

  factory CreateGoodsReceiptItem.fromJson(Map<String, dynamic> json) =>
      _$CreateGoodsReceiptItemFromJson(json);
}

// ──────────────────────────────────
// Purchase Return
// ──────────────────────────────────
@freezed
class PurchaseReturn with _$PurchaseReturn {
  const factory PurchaseReturn({
    required String id,
    required String companyId,
    required String supplierId,
    required String returnNumber,
    required DateTime returnDate,
    required String warehouseId,
    required String status,
    required String subtotal,
    required String discountAmount,
    required String taxAmount,
    required String grandTotal,
    String? notes,
    String? approvedBy,
    DateTime? approvedAt,
    String? cancelledBy,
    DateTime? cancelledAt,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
    @Default([]) List<PurchaseReturnItem> items,
  }) = _PurchaseReturn;

  factory PurchaseReturn.fromJson(Map<String, dynamic> json) =>
      _$PurchaseReturnFromJson(json);
}

@freezed
class PurchaseReturnItem with _$PurchaseReturnItem {
  const factory PurchaseReturnItem({
    required String id,
    required String purchaseReturnId,
    required String productId,
    required int quantity,
    required String unitCost,
    String? discountPercent,
    required String discountAmount,
    String? taxPercent,
    required String taxAmount,
    required String subtotal,
    required String total,
    String? notes,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _PurchaseReturnItem;

  factory PurchaseReturnItem.fromJson(Map<String, dynamic> json) =>
      _$PurchaseReturnItemFromJson(json);
}

@freezed
class PurchaseReturnListResponse with _$PurchaseReturnListResponse {
  const factory PurchaseReturnListResponse({
    required List<PurchaseReturn> items,
    required int total,
    required int page,
    required int limit,
  }) = _PurchaseReturnListResponse;

  factory PurchaseReturnListResponse.fromJson(Map<String, dynamic> json) =>
      _$PurchaseReturnListResponseFromJson(json);
}
